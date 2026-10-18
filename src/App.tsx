import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { apiRequest, AuthSession, clearStoredSession, fileToCompressedDataUrl, getStoredSession, loginWithPassword } from './lib/api'

type View = 'overview' | 'shops' | 'routes' | 'orders' | 'payments' | 'kpi' | 'reports'
type IconName = 'grid' | 'store' | 'route' | 'cart' | 'wallet' | 'target' | 'file' | 'plus' | 'refresh' | 'search' | 'map' | 'camera' | 'calendar' | 'chevron' | 'download' | 'check' | 'menu' | 'close' | 'trend' | 'users' | 'settings'

type DashboardData = {
  shopCount: number
  visitCount: number
  orderCount: number
  quantityKg: number
  revenue: number
  paid: number
  debt: number
  kpiCompletion: number
  series: Array<{ label: string; revenue: number; quantityKg: number; orders: number; visits: number }>
}

type Shop = {
  shop_id: string
  shop_name: string
  address?: string
  phone?: string
  contact_name?: string
  current_supplier?: string
  notes?: string
  latitude?: number | string
  longitude?: number | string
  salesperson_name?: string
  salesperson_id?: string
  revenue?: number
  avg_monthly_revenue?: number
  avg_monthly_orders?: number
  last_order_at?: string
  last_visit_at?: string
  status?: string
  gps_locked?: boolean | string
  gps_edit_granted?: boolean | string
  gps_edit_requested?: boolean | string
  photo_file_id?: string
  photo_url?: string
  photo_thumbnail_url?: string
  photo_direct_url?: string
}

type Order = {
  order_id: string
  shop_id: string
  shop_name?: string
  salesperson_id?: string
  salesperson_name?: string
  product_type: string
  quantity_kg: number
  total_amount?: number
  order_date?: string
  payment_status?: string
}

type Kpi = {
  kpi_id: string
  kpi_name: string
  unit: string
  calculation_type: string
  active: boolean | string
}

type KpiProgress = Kpi & {
  target_value?: number
  actual_value?: number
  progress?: number
  target_count?: number
}

type KpiTarget = {
  target_id: string
  kpi_id: string
  user_id?: string
  role?: string
  period_type?: string
  start_date?: string
  end_date?: string
  target_value?: number
}

type User = { user_id: string; username?: string; full_name: string; email?: string; role: string; phone?: string; active?: boolean | string }

const emptyDashboard: DashboardData = {
  shopCount: 0, visitCount: 0, orderCount: 0, quantityKg: 0, revenue: 0, paid: 0, debt: 0, kpiCompletion: 0, series: [],
}

const navItems: Array<{ id: View; label: string; icon: IconName; group?: string }> = [
  { id: 'overview', label: 'Tổng quan', icon: 'grid' },
  { id: 'shops', label: 'Danh sách quán', icon: 'store' },
  { id: 'routes', label: 'Đi tuyến', icon: 'route' },
  { id: 'orders', label: 'Đơn hàng', icon: 'cart' },
  { id: 'payments', label: 'Thanh toán', icon: 'wallet' },
  { id: 'kpi', label: 'KPI & mục tiêu', icon: 'target' },
  { id: 'reports', label: 'Báo cáo', icon: 'file' },
]

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    store: <><path d="M3 10h18"/><path d="M5 10v10h14V10"/><path d="M4 10 6 4h12l2 6"/><path d="M9 20v-5h6v5"/></>,
    route: <><circle cx="6" cy="19" r="2"/><circle cx="18" cy="5" r="2"/><path d="M8 19c4 0 1-7 6-8 4-.8 2-6 2-6"/></>,
    cart: <><path d="M3 4h2l2.5 11h10l3-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/></>,
    wallet: <><path d="M4 7h15a2 2 0 0 1 2 2v9H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14"/><path d="M16 13h5"/><circle cx="16" cy="13" r=".5" fill="currentColor"/></>,
    target: <><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="m15 9 3-3"/><path d="m18 6 1.5.5L19 8"/></>,
    file: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    refresh: <><path d="M20 11a8 8 0 0 0-14.5-4L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.5 4L20 15"/><path d="M20 20v-5h-5"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
    camera: <><path d="M4 7h3l1.5-2h7L17 7h3v12H4z"/><circle cx="12" cy="13" r="3.5"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    download: <><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    trend: <><path d="m4 16 5-5 4 3 7-8"/><path d="M15 6h5v5"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M18 15c2 .4 3 2 3 4"/></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="m19.4 15 .1.1a2 2 0 0 1-2.8 2.8l-.1-.1a2 2 0 0 0-3.4 1.4v.2a2 2 0 0 1-4 0v-.2A2 2 0 0 0 5.8 17l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A2 2 0 0 0 1.6 11H1.5a2 2 0 0 1 0-4h.2A2 2 0 0 0 3 3.6l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1A2 2 0 0 0 9.2 0h.2a2 2 0 0 1 4 0v.2a2 2 0 0 0 3.4.7l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A2 2 0 0 0 20.8 7h.2a2 2 0 0 1 0 4h-.2a2 2 0 0 0-1.4 4Z" transform="scale(.85) translate(2 2)"/></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function formatCurrency(value = 0) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Number(value) || 0)
}

function parseUserNumber(value?: number | string) {
  let text = String(value ?? '').trim().replace(/\s/g, '')
  if (!text) return Number.NaN
  const commaIndex = text.lastIndexOf(',')
  const dotIndex = text.lastIndexOf('.')
  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) text = text.replace(/\./g, '').replace(',', '.')
    else text = text.replace(/,/g, '')
  } else if (commaIndex >= 0) {
    text = text.replace(',', '.')
  }
  const number = Number(text)
  return Number.isFinite(number) ? number : Number.NaN
}

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function parseCoordinate(value?: number | string) {
  let text = String(value ?? '').trim().replace(/[^0-9,.-]/g, '')
  if (!text) return Number.NaN
  const negative = text.startsWith('-')
  text = text.replace(/^[+-]/, '')
  const dotParts = text.split('.')
  const commaParts = text.split(',')
  if (dotParts.length > 2 && dotParts.slice(1).every((part) => part.length === 3)) text = `${dotParts[0]}.${dotParts.slice(1).join('')}`
  else if (commaParts.length > 2 && commaParts.slice(1).every((part) => part.length === 3)) text = `${commaParts[0]}.${commaParts.slice(1).join('')}`
  else if (text.includes(',') && !text.includes('.')) text = text.replace(',', '.')
  else if (text.includes(',') && text.includes('.')) {
    const decimalIndex = Math.max(text.lastIndexOf('.'), text.lastIndexOf(','))
    text = `${text.slice(0, decimalIndex).replace(/[.,]/g, '')}.${text.slice(decimalIndex + 1).replace(/[.,]/g, '')}`
  }
  const number = Number(`${negative ? '-' : ''}${text}`)
  return Number.isFinite(number) ? number : Number.NaN
}

function shopMapUrl(shop: Shop) {
  const latitude = parseCoordinate(shop.latitude)
  const longitude = parseCoordinate(shop.longitude)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ''
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`
}

function shopThumbnailUrl(shop: Shop) {
  if (shop.photo_thumbnail_url) return shop.photo_thumbnail_url
  if (shop.photo_file_id) return `https://drive.google.com/thumbnail?id=${encodeURIComponent(shop.photo_file_id)}&sz=w240`
  return shop.photo_url || ''
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function normalizeRole(role?: string) { return String(role || '').trim().toLowerCase() }
function roleLabel(role?: string) { const normalized = normalizeRole(role); return normalized === 'admin' ? 'Admin' : normalized === 'sales' ? 'Sales' : 'Kế toán' }

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredSession())
  const [activeView, setActiveView] = useState<View>(() => normalizeRole(getStoredSession()?.user.role) === 'accountant' || normalizeRole(getStoredSession()?.user.role) === 'kế toán' ? 'payments' : 'overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [dateFrom, setDateFrom] = useState(getDateDaysAgo(7))
  const [dateTo, setDateTo] = useState(todayInput())
  const [salesFilter, setSalesFilter] = useState('all')
  const [paymentDateFrom, setPaymentDateFrom] = useState(getDateDaysAgo(30))
  const [paymentDateTo, setPaymentDateTo] = useState(todayInput())
  const [paymentSalesFilter, setPaymentSalesFilter] = useState('all')
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard)
  const [shops, setShops] = useState<Shop[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [kpiProgress, setKpiProgress] = useState<KpiProgress[]>([])
  const [kpiTargets, setKpiTargets] = useState<KpiTarget[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [modal, setModal] = useState<'shop' | 'visit' | 'order' | 'kpi' | 'kpi-target' | null>(null)
  const [editingShop, setEditingShop] = useState<Shop | null>(null)

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }

  const currentUser = session?.user as User
  const currentRole = normalizeRole(currentUser?.role)
  const isAdmin = currentRole === 'admin'
  const isAccountant = currentRole === 'accountant' || currentRole === 'kế toán'
  const isSales = currentRole === 'sales'

  const loadData = async () => {
    if (!session) return
    setLoading(true)
    try {
      if (isAccountant) {
        const ordersResult = await apiRequest<Order[]>('getOrders', { dateFrom: paymentDateFrom, dateTo: paymentDateTo, salespersonId: paymentSalesFilter === 'all' ? '' : paymentSalesFilter })
        setOrders(Array.isArray(ordersResult) ? ordersResult : [])
        setConnected(true)
        return
      }
      const selectedSales = isAdmin && salesFilter !== 'all' ? salesFilter : ''
      const orderDateFrom = activeView === 'payments' ? paymentDateFrom : dateFrom
      const orderDateTo = activeView === 'payments' ? paymentDateTo : dateTo
      const orderSalesFilter = activeView === 'payments' && isAdmin && paymentSalesFilter !== 'all' ? paymentSalesFilter : selectedSales
      const [dashboardResult, shopsResult, ordersResult, kpisResult, kpiProgressResult, usersResult, kpiTargetsResult] = await Promise.all([
        apiRequest<DashboardData>('getDashboard', { dateFrom, dateTo, salespersonId: selectedSales }),
        apiRequest<Shop[]>('getShops', { dateFrom, dateTo, salespersonId: selectedSales }),
        apiRequest<Order[]>('getOrders', { dateFrom: orderDateFrom, dateTo: orderDateTo, salespersonId: orderSalesFilter }),
        apiRequest<Kpi[]>('getKpis', {}),
        apiRequest<KpiProgress[]>('getKpiProgress', { dateFrom, dateTo, salespersonId: selectedSales }),
        apiRequest<User[]>('getUsers', {}),
        apiRequest<KpiTarget[]>('getKpiTargets', {}),
      ])
      setDashboard({ ...emptyDashboard, ...dashboardResult })
      setShops(Array.isArray(shopsResult) ? shopsResult : [])
      setOrders(Array.isArray(ordersResult) ? ordersResult : [])
      setKpis(Array.isArray(kpisResult) ? kpisResult : [])
      setKpiProgress(Array.isArray(kpiProgressResult) ? kpiProgressResult : [])
      setKpiTargets(Array.isArray(kpiTargetsResult) ? kpiTargetsResult : [])
      setUsers(Array.isArray(usersResult) ? usersResult : [])
      setConnected(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu'
      if (/phiên đăng nhập/i.test(message)) {
        clearStoredSession()
        setSession(null)
      } else {
        setConnected(false)
        showToast(message, 'info')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) void loadData()
  }, [session?.token, activeView, dateFrom, dateTo, salesFilter, paymentDateFrom, paymentDateTo, paymentSalesFilter])

  const salesUsers = useMemo(() => {
    const result = users.filter((user) => normalizeRole(user.role) === 'sales' && String(user.active) !== 'false')
    return result.length || !currentUser || !isSales ? result : [currentUser]
  }, [users, currentUser, isSales])

  const paymentSalesUsers = useMemo(() => {
    if (salesUsers.length) return salesUsers
    const byId: Record<string, User> = {}
    orders.forEach((order) => {
      const userId = order.salesperson_id || order.salesperson_name
      if (userId) byId[userId] = { user_id: userId, full_name: order.salesperson_name || userId, role: 'sales', active: true }
    })
    return Object.values(byId)
  }, [salesUsers, orders])

  const visibleNavItems = navItems.filter((item) => {
    if (isAccountant) return item.id === 'payments'
    if (item.id === 'payments') return isAdmin
    return true
  })
  const title = navItems.find((item) => item.id === activeView)?.label || 'Tổng quan'

  const onNavigate = (view: View) => {
    if (!visibleNavItems.some((item) => item.id === view)) return
    setActiveView(view)
    setMobileNav(false)
  }

  const onLogin = (nextSession: AuthSession) => {
    setSession(nextSession)
    setActiveView(normalizeRole(nextSession.user.role) === 'accountant' || normalizeRole(nextSession.user.role) === 'kế toán' ? 'payments' : 'overview')
  }

  const onLogout = () => {
    void apiRequest('logout').catch(() => undefined)
    clearStoredSession()
    setSession(null)
  }

  if (!session) return <LoginScreen onLoggedIn={onLogin} />

  const saveShop = () => { setModal(null); setEditingShop(null); void loadData(); showToast(editingShop ? 'Đã cập nhật hồ sơ quán' : 'Đã tạo hồ sơ quán') }
  const grantGpsEdit = async (shop: Shop) => {
    try { await apiRequest('grantGpsEdit', { shop_id: shop.shop_id }); showToast('Đã cấp quyền sửa GPS một lần cho quán'); void loadData() }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể cấp quyền sửa GPS', 'error') }
  }
  const requestGpsEdit = async (shop: Shop) => {
    try { await apiRequest('requestGpsEdit', { shop_id: shop.shop_id }); showToast('Đã gửi yêu cầu sửa GPS cho Admin'); void loadData() }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể gửi yêu cầu sửa GPS', 'error') }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">CN</div>
          <div><div className="brand-title">Cao Nguyên</div><div className="brand-subtitle">Vina Coffee</div></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Đóng menu"><Icon name="close" /></button>
        </div>
        <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav className="nav-list">
          {visibleNavItems.map((item) => (
            <button key={item.id} className={`nav-item ${activeView === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
              <Icon name={item.icon} /><span>{item.label}</span>
              {item.id === 'shops' && shops.length > 0 && <span className="nav-count">{shops.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="data-status"><span className={`status-dot ${connected ? 'online' : 'offline'}`} /><div><div className="status-title">{connected ? 'Sẵn sàng kết nối' : 'Chưa kết nối API'}</div><div className="status-caption">Google Sheets database</div></div></div>
          <div className="profile-card"><div className="avatar">{currentUser.full_name.slice(0, 2).toUpperCase()}</div><div className="profile-copy"><strong>{currentUser.full_name}</strong><span>{roleLabel(currentUser.role)}</span></div><button className="logout-link" onClick={onLogout}>Thoát</button></div>
        </div>
      </aside>

      {mobileNav && <button className="sidebar-overlay" onClick={() => setMobileNav(false)} aria-label="Đóng menu" />}

      <main className="main-content">
        <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Icon name="menu" /></button><div><div className="eyebrow">QUẢN TRỊ VẬN HÀNH</div><h1>{title}</h1></div></div><div className="topbar-actions"><div className={`connection-pill ${connected ? 'connected' : 'disconnected'}`}><span className="status-dot" /> {connected ? 'Đã kết nối' : 'Offline'}</div><button className="icon-button" onClick={() => void loadData()} disabled={loading} aria-label="Làm mới"><Icon name="refresh" /></button><div className="topbar-date"><Icon name="calendar" size={16} /> <span>{formatDate(todayInput())}</span></div></div></header>
        <div className="content-wrap">
          {activeView === 'overview' && <Overview dashboard={dashboard} kpiProgress={kpiProgress} dateFrom={dateFrom} dateTo={dateTo} salesFilter={salesFilter} salesUsers={salesUsers} canFilterSales={isAdmin} onDateFrom={setDateFrom} onDateTo={setDateTo} onSales={setSalesFilter} onOpenRoute={() => onNavigate('routes')} onOpenOrder={() => onNavigate('orders')} />}
          {activeView === 'shops' && <ShopsView shops={shops} salesUsers={salesUsers} isAdmin={isAdmin} onAdd={() => { setEditingShop(null); setModal('shop') }} onEdit={(shop) => { setEditingShop(shop); setModal('shop') }} onGrantGps={grantGpsEdit} onRequestGps={requestGpsEdit} onVisit={() => setModal('visit')} />}
          {activeView === 'routes' && <RoutesView shops={shops} salesUsers={salesUsers} currentUser={currentUser} isAdmin={isAdmin} onSaved={() => { setModal(null); void loadData() }} showToast={showToast} />}
          {activeView === 'orders' && <OrdersView orders={orders} shops={shops} canCreate={isAdmin || isSales} onAdd={() => setModal('order')} />}
          {activeView === 'payments' && <PaymentsView orders={orders} salesUsers={paymentSalesUsers} dateFrom={paymentDateFrom} dateTo={paymentDateTo} salesFilter={paymentSalesFilter} onDateFrom={setPaymentDateFrom} onDateTo={setPaymentDateTo} onSales={setPaymentSalesFilter} onConfirm={async (order) => { try { await apiRequest('confirmPayment', { order_id: order.order_id, amount: order.total_amount, payment_method: 'Chuyển khoản' }); showToast('Đã xác nhận thanh toán'); void loadData() } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xác nhận thanh toán', 'error') } }} />}
          {activeView === 'kpi' && <KpiView kpis={kpis} kpiTargets={kpiTargets} canManage={isAdmin} onAdd={() => setModal('kpi')} onAssign={() => setModal('kpi-target')} />}
          {activeView === 'reports' && <ReportsView dateFrom={dateFrom} dateTo={dateTo} salesFilter={isAdmin ? salesFilter : 'all'} showToast={showToast} />}
        </div>
      </main>

      {modal === 'shop' && <ShopModal shop={editingShop || undefined} salesUsers={salesUsers} currentUser={currentUser} isAdmin={isAdmin} onClose={() => { setModal(null); setEditingShop(null) }} onSaved={saveShop} showToast={showToast} />}
      {modal === 'visit' && <VisitModal shops={shops} salesUsers={salesUsers} currentUser={currentUser} isAdmin={isAdmin} onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã ghi nhận check-in hợp lệ') }} showToast={showToast} />}
      {modal === 'order' && <OrderModal shops={shops} onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã tạo đơn hàng') }} showToast={showToast} />}
      {modal === 'kpi' && <KpiModal onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã tạo KPI mới') }} showToast={showToast} />}
      {modal === 'kpi-target' && <KpiTargetModal kpis={kpis} users={users} onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã giao KPI') }} showToast={showToast} />}
      {toast && <div className={`toast toast-${toast.type}`}><span className="toast-icon"><Icon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'close' : 'trend'} size={16} /></span>{toast.message}</div>}
    </div>
  )
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (session: AuthSession) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try { onLoggedIn(await loginWithPassword(username, password)) }
    catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Không thể đăng nhập') }
    finally { setLoading(false) }
  }
  return <main className="login-shell"><section className="login-card"><div className="login-brand"><div className="brand-mark">CN</div><div><strong>Cao Nguyên</strong><span>Vina Coffee ERP</span></div></div><div className="section-eyebrow">KHU VỰC NỘI BỘ</div><h1>Đăng nhập hệ thống</h1><p>Nhập tài khoản đã được cấp trong sheet USERS.</p><form onSubmit={submit} className="login-form"><label className="field"><span>Tên đăng nhập</span><input autoFocus value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Ví dụ: admin" autoComplete="username" /></label><label className="field"><span>Mật khẩu</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" /></label>{error && <div className="login-error">{error}</div>}<button className="primary-button" disabled={loading}>{loading ? 'Đang kiểm tra...' : 'Đăng nhập'}</button></form><small className="login-note">Dữ liệu được phân quyền theo vai trò Admin, Sales và Kế toán.</small></section></main>
}

function PageIntro({ eyebrow, title, description, action, actionLabel, actionIcon = 'plus' as IconName }: { eyebrow: string; title: string; description: string; action?: () => void; actionLabel?: string; actionIcon?: IconName }) {
  return <div className="page-intro"><div><div className="section-eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div>{action && actionLabel && <button className="primary-button" onClick={action}><Icon name={actionIcon} size={17} /> {actionLabel}</button>}</div>
}

function FilterBar({ dateFrom, dateTo, salesFilter, salesUsers, canFilterSales, onDateFrom, onDateTo, onSales }: { dateFrom: string; dateTo: string; salesFilter: string; salesUsers: User[]; canFilterSales: boolean; onDateFrom: (value: string) => void; onDateTo: (value: string) => void; onSales: (value: string) => void }) {
  return <div className="filter-bar"><div className="filter-label"><Icon name="calendar" size={16} /> Kỳ báo cáo</div><input aria-label="Từ ngày" type="date" value={dateFrom} onChange={(event) => onDateFrom(event.target.value)} /><span className="date-separator">đến</span><input aria-label="Đến ngày" type="date" value={dateTo} onChange={(event) => onDateTo(event.target.value)} />{canFilterSales && <><div className="filter-spacer" /><label className="select-with-icon"><Icon name="users" size={16} /><select value={salesFilter} onChange={(event) => onSales(event.target.value)}><option value="all">Tất cả Sales</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select><Icon name="chevron" size={14} /></label></>}</div>
}

function Overview({ dashboard, kpiProgress, dateFrom, dateTo, salesFilter, salesUsers, canFilterSales, onDateFrom, onDateTo, onSales, onOpenRoute, onOpenOrder }: { dashboard: DashboardData; kpiProgress: KpiProgress[]; dateFrom: string; dateTo: string; salesFilter: string; salesUsers: User[]; canFilterSales: boolean; onDateFrom: (value: string) => void; onDateTo: (value: string) => void; onSales: (value: string) => void; onOpenRoute: () => void; onOpenOrder: () => void }) {
  const cards = [
    { label: 'Tổng doanh thu', value: `${formatCurrency(dashboard.revenue)} đ`, meta: 'Trong kỳ đã chọn', icon: 'trend' as IconName, tone: 'green' },
    { label: 'Sản lượng bán', value: `${dashboard.quantityKg || 0} kg`, meta: 'Tổng khối lượng', icon: 'cart' as IconName, tone: 'orange' },
    { label: 'Lượt ghé quán', value: dashboard.visitCount, meta: 'Đã ghi nhận', icon: 'route' as IconName, tone: 'blue' },
    { label: 'Hoàn thành KPI', value: `${dashboard.kpiCompletion || 0}%`, meta: 'Theo mục tiêu hiện tại', icon: 'target' as IconName, tone: 'purple' },
  ]
  return <>
    <PageIntro eyebrow="TỔNG QUAN DOANH NGHIỆP" title="Bức tranh kinh doanh" description="Theo dõi hoạt động bán hàng và hiệu suất đội ngũ theo thời gian thực." />
    <FilterBar dateFrom={dateFrom} dateTo={dateTo} salesFilter={salesFilter} salesUsers={salesUsers} canFilterSales={canFilterSales} onDateFrom={onDateFrom} onDateTo={onDateTo} onSales={onSales} />
    <div className="metrics-grid">{cards.map((card) => <div className="metric-card" key={card.label}><div className={`metric-icon ${card.tone}`}><Icon name={card.icon} size={20} /></div><div className="metric-copy"><span>{card.label}</span><strong>{card.value}</strong><small>{card.meta}</small></div><div className="metric-menu">•••</div></div>)}</div>
    <div className="overview-grid">
      <div className="panel chart-panel"><div className="panel-heading"><div><h3>Nhịp vận hành</h3><span>Doanh thu và sản lượng trong kỳ</span></div><span className="legend"><i className="legend-dot revenue" /> Doanh thu <i className="legend-dot kg" /> Sản lượng</span></div><ActivityChart series={dashboard.series} /></div>
      <div className="panel quick-panel"><div className="panel-heading"><div><h3>Thao tác nhanh</h3><span>Cập nhật dữ liệu tại hiện trường</span></div></div><button className="quick-action" onClick={onOpenRoute}><span className="quick-icon route-bg"><Icon name="route" /></span><span><strong>Ghi nhận đi tuyến</strong><small>Check-in tại quán bằng GPS</small></span><Icon name="chevron" size={17} /></button><button className="quick-action" onClick={onOpenOrder}><span className="quick-icon order-bg"><Icon name="cart" /></span><span><strong>Tạo đơn hàng mới</strong><small>Ghi nhận sản lượng bán</small></span><Icon name="chevron" size={17} /></button></div>
    </div>
    <div className="overview-grid bottom-grid"><div className="panel kpi-overview-panel"><div className="panel-heading"><div><h3>Hoàn thành KPI</h3><span>Toàn bộ chỉ số KPI đã khai báo trong hệ thống</span></div><a className="text-link">Xem chi tiết <Icon name="chevron" size={14} /></a></div><KpiProgressList items={kpiProgress} /></div><div className="panel"><div className="panel-heading"><div><h3>Hoạt động gần đây</h3><span>Các cập nhật mới nhất</span></div><a className="text-link">Xem tất cả <Icon name="chevron" size={14} /></a></div><EmptyState icon="file" title="Chưa có hoạt động" description="Dữ liệu sẽ xuất hiện sau khi có lượt ghé hoặc đơn hàng." /></div></div>
  </>
}

function ActivityChart({ series }: { series: DashboardData['series'] }) {
  if (!series.length) return <div className="chart-empty"><div className="empty-chart-icon"><Icon name="trend" size={24} /></div><strong>Chưa có dữ liệu trong kỳ</strong><span>Khi có đơn hàng hoặc lượt đi tuyến, biểu đồ sẽ cập nhật tự động.</span></div>
  const max = Math.max(...series.map((item) => Math.max(item.revenue, item.quantityKg)), 1)
  return <div className="chart-area"><div className="y-axis"><span>{formatCurrency(max)}</span><span>{formatCurrency(max / 2)}</span><span>0</span></div><div className="bars">{series.map((item) => <div className="bar-group" key={item.label}><div className="bar-pair"><div className="bar revenue-bar" style={{ height: `${Math.max(4, item.revenue / max * 100)}%` }} /><div className="bar kg-bar" style={{ height: `${Math.max(4, item.quantityKg / max * 100)}%` }} /></div><span>{item.label}</span></div>)}</div></div>
}

function EmptyState({ icon, title, description, action, actionLabel }: { icon: IconName; title: string; description: string; action?: () => void; actionLabel?: string }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={24} /></div><strong>{title}</strong><span>{description}</span>{action && actionLabel && <button className="secondary-button" onClick={action}>{actionLabel}</button>}</div>
}

function KpiProgressList({ items }: { items: KpiProgress[] }) {
  if (!items.length) return <EmptyState icon="target" title="Chưa có KPI khai báo" description="Admin hãy tạo KPI trong Menu KPI & mục tiêu." />
  return <div className="kpi-progress-list">{items.map((item) => <div className="kpi-progress-row" key={item.kpi_id}><div className="kpi-progress-copy"><strong>{item.kpi_name}</strong><span>{item.actual_value || 0} / {item.target_value || 0} {item.unit || ''}{item.target_count ? ` · ${item.target_count} mục tiêu` : ' · Chưa giao mục tiêu'}</span></div><div className="kpi-progress-track"><span style={{ width: `${Math.min(100, Number(item.progress || 0))}%` }} /></div><strong className="kpi-progress-value">{Number(item.progress || 0)}%</strong></div>)}</div>
}

function ShopsView({ shops, salesUsers, isAdmin, onAdd, onEdit, onGrantGps, onRequestGps, onVisit }: { shops: Shop[]; salesUsers: User[]; isAdmin: boolean; onAdd: () => void; onEdit: (shop: Shop) => void; onGrantGps: (shop: Shop) => void; onRequestGps: (shop: Shop) => void; onVisit: () => void }) {
  return <>
    <PageIntro eyebrow="KHÁCH HÀNG" title="Danh sách quán" description="Hồ sơ quán, GPS cố định, ảnh nhận diện và giá trị kinh doanh theo từng điểm bán." action={onAdd} actionLabel="Thêm quán" />
    <div className="table-toolbar"><div className="search-field"><Icon name="search" size={17} /><input placeholder="Tìm theo tên quán, địa chỉ..." /><span>{shops.length} kết quả</span></div><button className="secondary-button" onClick={onVisit}><Icon name="route" size={16} /> Ghi nhận check-in</button></div>
    <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Tên quán</th><th>Địa chỉ / tọa độ</th><th>Ảnh quán</th><th>Salesperson</th><th>Doanh thu kỳ lọc</th><th>Đơn TB/tháng</th><th>Đặt hàng gần nhất</th><th>Visit gần nhất</th><th /></tr></thead><tbody>{shops.map((shop) => {
      const mapUrl = shopMapUrl(shop)
      const thumbnailUrl = shopThumbnailUrl(shop)
      const photoUrl = shop.photo_direct_url || shop.photo_url || thumbnailUrl
      const gpsLocked = String(shop.gps_locked) === 'true'
      const gpsGranted = String(shop.gps_edit_granted) === 'true'
      const gpsRequested = String(shop.gps_edit_requested) === 'true'
      return <tr key={shop.shop_id}>
        <td><div className="shop-cell"><div className="shop-avatar">{shop.shop_name?.slice(0, 1).toUpperCase() || 'Q'}</div><div><strong>{shop.shop_name || 'Chưa đặt tên'}</strong><small>{shop.status || 'Đang hoạt động'}{String(shop.gps_locked) === 'true' ? ' · GPS đã khóa' : ' · Chưa có GPS'}</small></div></div></td>
        <td><div className="address-cell">{shop.address || 'Chưa cập nhật'}{mapUrl && <a href={mapUrl} target="_blank" rel="noreferrer"><Icon name="map" size={13} /> Mở bản đồ</a>}</div></td>
        <td>{thumbnailUrl ? <a className="photo-preview" href={photoUrl} target="_blank" rel="noreferrer" title="Mở ảnh quán"><img className="photo-thumb" src={thumbnailUrl} alt={`Ảnh ${shop.shop_name || 'quán'}`} loading="lazy" onError={(event) => { event.currentTarget.classList.add('photo-thumb-error') }} /><span>Xem ảnh</span></a> : <span className="photo-missing">Chưa có</span>}</td>
        <td>{shop.salesperson_name || salesUsers.find((user) => user.user_id === shop.salesperson_id)?.full_name || 'Chưa phân công'}</td><td>{formatCurrency(shop.revenue)} đ</td><td>{shop.avg_monthly_orders || 0}</td><td>{formatDate(shop.last_order_at)}</td><td>{formatDate(shop.last_visit_at)}</td>
        <td className="shop-actions"><button className="table-action" onClick={() => onEdit(shop)}>Sửa</button>{isAdmin && gpsLocked && !gpsGranted && gpsRequested && <button className="table-action gps-grant" onClick={() => onGrantGps(shop)}>Phê duyệt GPS</button>}{isAdmin && gpsLocked && !gpsGranted && !gpsRequested && <span className="gps-not-requested">Chưa xin</span>}{!isAdmin && gpsLocked && !gpsGranted && !gpsRequested && <button className="table-action gps-request" onClick={() => onRequestGps(shop)}>Xin sửa GPS</button>}{!isAdmin && gpsRequested && <span className="gps-requested">Đã gửi yêu cầu</span>}{gpsGranted && <span className="gps-granted">Đã cấp</span>}</td>
      </tr>
    })}</tbody></table>{shops.length === 0 && <EmptyState icon="store" title="Chưa có hồ sơ quán" description="Hãy tạo quán đầu tiên để bắt đầu quản lý tuyến bán hàng." action={onAdd} actionLabel="Thêm quán đầu tiên" />}</div></div>
  </>
}

function RoutesView({ shops, salesUsers, currentUser, isAdmin, onSaved, showToast }: { shops: Shop[]; salesUsers: User[]; currentUser: User; isAdmin: boolean; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [shopId, setShopId] = useState('')
  const [salespersonId, setSalespersonId] = useState(isAdmin ? '' : currentUser.user_id)
  const [visitDate, setVisitDate] = useState(todayInput())
  const [reportDateFrom, setReportDateFrom] = useState(getDateDaysAgo(7))
  const [reportDateTo, setReportDateTo] = useState(todayInput())
  const [reportVisitCount, setReportVisitCount] = useState(0)
  const [reportLoading, setReportLoading] = useState(false)
  const [reportRefresh, setReportRefresh] = useState(0)
  const [saving, setSaving] = useState(false)
  const selectedShop = shops.find((shop) => shop.shop_id === shopId)
  const reportSalespersonId = isAdmin ? salespersonId : currentUser.user_id

  useEffect(() => {
    let active = true
    setReportLoading(true)
    void apiRequest<{ visits?: unknown[] }>('getReports', { dateFrom: reportDateFrom, dateTo: reportDateTo, salespersonId: reportSalespersonId }).then((report) => {
      if (active) setReportVisitCount(Array.isArray(report?.visits) ? report.visits.length : 0)
    }).catch(() => {
      if (active) setReportVisitCount(0)
    }).finally(() => {
      if (active) setReportLoading(false)
    })
    return () => { active = false }
  }, [reportDateFrom, reportDateTo, reportSalespersonId, reportRefresh])

  const checkIn = () => {
    if (!shopId || (isAdmin && !salespersonId)) return showToast('Vui lòng chọn quán và Sales', 'error')
    if (!navigator.geolocation) return showToast('Thiết bị không hỗ trợ GPS', 'error')
    setSaving(true)
    let finished = false
    let timeoutId = 0
    const finish = (callback: () => void) => {
      if (finished) return
      finished = true
      window.clearTimeout(timeoutId)
      setSaving(false)
      callback()
    }
    timeoutId = window.setTimeout(() => {
      finish(() => showToast('Lấy GPS hoặc kết nối API quá thời gian. Hãy kiểm tra quyền vị trí và thử lại.', 'error'))
    }, 25000)
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (finished) return
      try {
        const result = await apiRequest<{ distance_meters?: number }>('checkIn', { shop_id: shopId, salesperson_id: salespersonId, visit_date: visitDate, latitude: position.coords.latitude, longitude: position.coords.longitude })
        finish(() => {
          showToast(`Check-in hợp lệ${result?.distance_meters !== undefined ? ` · cách quán ${result.distance_meters} m` : ''}`)
          setReportRefresh((value) => value + 1)
          onSaved()
        })
      } catch (error) {
        finish(() => showToast(error instanceof Error ? error.message : 'Không thể check-in', 'error'))
      }
    }, () => {
      finish(() => showToast('Không lấy được vị trí. Hãy cấp quyền GPS cho trình duyệt.', 'error'))
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 })
  }
  const savedLatitude = parseCoordinate(selectedShop?.latitude)
  const savedLongitude = parseCoordinate(selectedShop?.longitude)
  return <>
    <PageIntro eyebrow="HIỆN TRƯỜNG" title="Đi tuyến" description="Check-in chỉ được ghi nhận khi Sales đứng trong bán kính 50 m quanh GPS đã khóa của quán." />
    <div className="route-report panel"><div className="route-report-heading"><div><h3>Báo cáo đi tuyến</h3><span>Lọc số lượt check-in đã xác minh</span></div><div className="route-report-total"><strong>{reportLoading ? '…' : reportVisitCount}</strong><span>Tổng lượt check-in</span></div></div><div className="route-report-filters"><label className="field"><span>Từ ngày</span><input type="date" value={reportDateFrom} onChange={(event) => setReportDateFrom(event.target.value)} /></label><label className="field"><span>Đến ngày</span><input type="date" value={reportDateTo} onChange={(event) => setReportDateTo(event.target.value)} /></label>{isAdmin && <label className="field"><span>Sales</span><select value={salespersonId} onChange={(event) => setSalespersonId(event.target.value)}><option value="">Tất cả Sales</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select></label>}</div></div>
    <div className="route-layout"><form className="panel form-panel" onSubmit={(event) => { event.preventDefault(); checkIn() }}><div className="panel-heading"><div><h3>Phiếu check-in tuyến</h3><span>Hệ thống tự lấy GPS hiện tại và đối chiếu với GPS quán</span></div><span className="form-step">50 m</span></div><div className="form-grid"><label className="field wide"><span>Quán <b>*</b></span><select value={shopId} onChange={(event) => setShopId(event.target.value)}><option value="">Chọn quán cần ghé</option>{shops.map((shop) => <option key={shop.shop_id} value={shop.shop_id}>{shop.shop_name}</option>)}</select></label><label className="field"><span>Sales phụ trách <b>*</b></span><select value={isAdmin ? salespersonId : currentUser.user_id} disabled={!isAdmin} onChange={(event) => setSalespersonId(event.target.value)}><option value="">Chọn Sales</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select></label><label className="field"><span>Ngày ghé</span><input type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} /></label><div className="field wide"><span>GPS quán đã lưu</span><div className="gps-readonly">{Number.isFinite(savedLatitude) && Number.isFinite(savedLongitude) ? `${savedLatitude.toFixed(6)}, ${savedLongitude.toFixed(6)}` : 'Quán chưa có GPS — cập nhật tại Danh sách quán'}</div></div><div className="field wide"><span>Điều kiện ghi nhận</span><div className="checkin-rule"><Icon name="map" size={17} /> Bấm “Check-in tại vị trí hiện tại”; hệ thống sẽ từ chối nếu vượt quá 50 m.</div></div></div><div className="form-actions"><span><Icon name="check" size={15} /> Không nhập GPS, ảnh, nhà cung cấp hoặc ghi chú tại đây</span><button type="submit" className="primary-button" disabled={saving || !selectedShop}>{saving ? 'Đang kiểm tra vị trí...' : 'Check-in tại vị trí hiện tại'}</button></div></form><div className="panel route-aside"><div className="aside-illustration"><Icon name="map" size={38} /></div><h3>Chống check-in hộ</h3><p>GPS quán được khóa sau lần ghi nhận đầu tiên. KPI đi tuyến chỉ tăng khi hệ thống xác minh khoảng cách không quá 50 m.</p><div className="aside-list"><div><span className="aside-number">01</span><span>Chọn đúng quán trong tuyến</span></div><div><span className="aside-number">02</span><span>Cho phép trình duyệt lấy vị trí</span></div><div><span className="aside-number">03</span><span>Check-in tại quán</span></div></div></div></div>
  </>
}

function OrdersView({ orders, shops, canCreate, onAdd }: { orders: Order[]; shops: Shop[]; canCreate: boolean; onAdd: () => void }) {
  const totalSold = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0)
  return <>
    <PageIntro eyebrow="BÁN HÀNG" title="Đơn hàng" description="Theo dõi sản lượng Flamen theo từng quán và nhân viên Sales." action={canCreate ? onAdd : undefined} actionLabel="Tạo đơn hàng" actionIcon="cart" />
    <div className="summary-strip order-summary"><div><span>Tổng đơn trong kỳ</span><strong>{orders.length}</strong></div><div><span>Tổng sản lượng</span><strong>{orders.reduce((sum, order) => sum + Number(order.quantity_kg || 0), 0)} kg</strong></div><div><span>Tổng tiền đã bán</span><strong>{formatCurrency(totalSold)} đ</strong></div><div><span>Đã thanh toán</span><strong>{formatCurrency(orders.filter((order) => order.payment_status === 'Đã thanh toán').reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} đ</strong></div><div><span>Chờ thanh toán</span><strong>{orders.filter((order) => order.payment_status !== 'Đã thanh toán').length}</strong></div></div>
    <div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Mã đơn</th><th>Quán</th><th>Sales bán</th><th>Sản phẩm</th><th>Số lượng</th><th>Thành tiền</th><th>Ngày đặt</th><th>Thanh toán</th></tr></thead><tbody>{orders.map((order) => <tr key={order.order_id}><td><span className="mono">{order.order_id}</span></td><td>{order.shop_name || shops.find((shop) => shop.shop_id === order.shop_id)?.shop_name || '—'}</td><td>{order.salesperson_name || '—'}</td><td>{order.product_type}</td><td><strong>{order.quantity_kg} kg</strong></td><td>{formatCurrency(order.total_amount)} đ</td><td>{formatDate(order.order_date)}</td><td><StatusBadge status={order.payment_status || 'Chờ xác nhận'} /></td></tr>)}</tbody></table>{orders.length === 0 && <EmptyState icon="cart" title="Chưa có đơn hàng" description="Các đơn hàng do Sales ghi nhận sẽ hiển thị tại đây." action={canCreate ? onAdd : undefined} actionLabel="Tạo đơn hàng đầu tiên" />}</div></div>
  </>
}

function PaymentsView({ orders, salesUsers, dateFrom, dateTo, salesFilter, onDateFrom, onDateTo, onSales, onConfirm }: { orders: Order[]; salesUsers: User[]; dateFrom: string; dateTo: string; salesFilter: string; onDateFrom: (value: string) => void; onDateTo: (value: string) => void; onSales: (value: string) => void; onConfirm: (order: Order) => void }) {
  const unpaid = orders.filter((order) => order.payment_status !== 'Đã thanh toán')
  const salesStats = Object.values(orders.reduce<Record<string, { name: string; orderCount: number; paid: number; unpaid: number }>>((result, order) => {
    const key = order.salesperson_id || order.salesperson_name || 'unassigned'
    const stat = result[key] || { name: order.salesperson_name || order.salesperson_id || 'Chưa xác định', orderCount: 0, paid: 0, unpaid: 0 }
    stat.orderCount += 1
    if (order.payment_status === 'Đã thanh toán') stat.paid += Number(order.total_amount || 0)
    else stat.unpaid += Number(order.total_amount || 0)
    result[key] = stat
    return result
  }, {}))
  return <>
    <PageIntro eyebrow="TÀI CHÍNH" title="Xác nhận thanh toán" description="Kế toán xác nhận tiền về và cập nhật công nợ theo từng đơn hàng." />
    <FilterBar dateFrom={dateFrom} dateTo={dateTo} salesFilter={salesFilter} salesUsers={salesUsers} canFilterSales onDateFrom={onDateFrom} onDateTo={onDateTo} onSales={onSales} />
    <div className="summary-strip payment-summary"><div><span>Đơn chờ xác nhận</span><strong>{unpaid.length}</strong></div><div><span>Giá trị chờ thu</span><strong>{formatCurrency(unpaid.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} đ</strong></div><div><span>Đã thu trong kỳ</span><strong>{formatCurrency(orders.filter((order) => order.payment_status === 'Đã thanh toán').reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} đ</strong></div></div>
    <div className="panel payment-sales-panel"><div className="panel-heading"><div><h3>Thống kê theo Sales</h3><span>Đã thu và còn chờ thu trong kỳ đã chọn</span></div></div>{salesStats.length === 0 ? <EmptyState icon="users" title="Chưa có dữ liệu thanh toán" description="Thay đổi thời gian hoặc Sales để xem thống kê." /> : <div className="table-wrap"><table><thead><tr><th>Sales</th><th>Số đơn</th><th>Đã thanh toán</th><th>Chờ thanh toán</th></tr></thead><tbody>{salesStats.map((stat) => <tr key={stat.name}><td><strong>{stat.name}</strong></td><td>{stat.orderCount}</td><td>{formatCurrency(stat.paid)} đ</td><td>{formatCurrency(stat.unpaid)} đ</td></tr>)}</tbody></table></div>}</div>
    <div className="panel"><div className="panel-heading"><div><h3>Danh sách cần xử lý</h3><span>Cập nhật trạng thái thanh toán sau khi đối soát</span></div></div>{unpaid.length === 0 ? <EmptyState icon="wallet" title="Chưa có khoản cần xác nhận" description="Khi có đơn hàng chưa thanh toán, Kế toán sẽ xử lý tại đây." /> : <div className="table-wrap"><table><thead><tr><th>Mã đơn</th><th>Quán</th><th>Sales</th><th>Ngày đặt</th><th>Số tiền</th><th>Trạng thái</th><th /></tr></thead><tbody>{unpaid.map((order) => <tr key={order.order_id}><td className="mono">{order.order_id}</td><td>{order.shop_name || order.shop_id}</td><td>{order.salesperson_name || order.salesperson_id || '—'}</td><td>{formatDate(order.order_date)}</td><td>{formatCurrency(order.total_amount)} đ</td><td><StatusBadge status={order.payment_status || 'Chờ xác nhận'} /></td><td><button className="table-action" onClick={() => onConfirm(order)}><Icon name="check" size={15} /> Xác nhận</button></td></tr>)}</tbody></table></div>}</div>
  </>
}

function KpiView({ kpis, kpiTargets, canManage, onAdd, onAssign }: { kpis: Kpi[]; kpiTargets: KpiTarget[]; canManage: boolean; onAdd: () => void; onAssign: () => void }) {
  return <><PageIntro eyebrow="HIỆU SUẤT" title="KPI & mục tiêu" description="Thiết lập chỉ tiêu linh hoạt cho Sales, nhóm hoặc toàn công ty." action={canManage ? onAdd : undefined} actionLabel="Tạo KPI" actionIcon="target" /><div className="kpi-info"><div className="kpi-info-icon"><Icon name="target" size={20} /></div><div><strong>KPI được thiết kế mở rộng</strong><span>Sales chỉ xem KPI của mình; Admin có quyền tạo và giao mục tiêu.</span></div>{canManage && <button className="secondary-button" onClick={onAssign}><Icon name="users" size={15} /> Giao KPI cho Sales</button>}</div><div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Tên KPI</th><th>Đơn vị</th><th>Cách tính</th><th>Trạng thái</th><th>Đã giao</th><th>Mục tiêu kỳ hiện tại</th><th /></tr></thead><tbody>{kpis.map((kpi) => { const targets = kpiTargets.filter((target) => target.kpi_id === kpi.kpi_id); return <tr key={kpi.kpi_id}><td><div className="kpi-name"><span className="kpi-bullet" /><strong>{kpi.kpi_name}</strong></div></td><td>{kpi.unit}</td><td><span className="formula-badge">{kpi.calculation_type}</span></td><td><StatusBadge status={String(kpi.active) === 'false' ? 'Tạm tắt' : 'Đang áp dụng'} /></td><td>{targets.length ? `${targets.length} người` : 'Chưa giao'}</td><td>{targets.length ? targets.map((target) => `${target.target_value || 0} ${kpi.unit}`).join(', ') : '—'}</td><td><button className="row-more">•••</button></td></tr> })}</tbody></table>{kpis.length === 0 && <EmptyState icon="target" title="Chưa có KPI" description="Admin cần tạo KPI để bắt đầu đo lường hiệu suất đội ngũ." action={canManage ? onAdd : undefined} actionLabel="Tạo KPI đầu tiên" />}</div></div></>
}

function ReportsView({ dateFrom, dateTo, salesFilter, showToast }: { dateFrom: string; dateTo: string; salesFilter: string; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [exporting, setExporting] = useState('')
  const reportTypes = [{ id: 'sales', title: 'Báo cáo doanh thu', description: 'Doanh thu, sản lượng và số đơn theo kỳ', icon: 'trend' as IconName }, { id: 'routes', title: 'Báo cáo đi tuyến', description: 'Lượt ghé, quán và tỷ lệ hoàn thành tuyến', icon: 'route' as IconName }, { id: 'kpi', title: 'Báo cáo KPI', description: 'Mục tiêu và kết quả theo từng Sales', icon: 'target' as IconName }, { id: 'debt', title: 'Báo cáo công nợ', description: 'Đơn hàng, thanh toán và số tiền còn lại', icon: 'wallet' as IconName }]
  const exportReport = async (reportType: string) => {
    setExporting(reportType)
    try {
      const result = await apiRequest<{ downloadUrl?: string }>('exportReportXlsx', { reportType, dateFrom, dateTo, salespersonId: salesFilter === 'all' ? '' : salesFilter })
      if (result?.downloadUrl) window.open(result.downloadUrl, '_blank')
      showToast('Đã tạo báo cáo XLSX')
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể xuất báo cáo', 'error') } finally { setExporting('') }
  }
  return <><PageIntro eyebrow="PHÂN TÍCH" title="Báo cáo" description="Xuất báo cáo vận hành theo ngày, tuần hoặc tháng dưới định dạng XLSX." /><div className="report-filter-note"><Icon name="calendar" size={16} /> Kỳ đang chọn: <strong>{formatDate(dateFrom)}</strong> đến <strong>{formatDate(dateTo)}</strong><span>Thay đổi kỳ tại bộ lọc của menu Tổng quan.</span></div><div className="report-grid">{reportTypes.map((report) => <div className="report-card" key={report.id}><div className={`report-icon report-${report.id}`}><Icon name={report.icon} size={21} /></div><div className="report-copy"><strong>{report.title}</strong><span>{report.description}</span></div><button className="icon-button report-download" onClick={() => void exportReport(report.id)} disabled={exporting === report.id} aria-label={`Xuất ${report.title}`}><Icon name="download" size={17} /></button></div>)}</div><div className="panel report-help"><div className="aside-illustration small"><Icon name="file" size={28} /></div><div><h3>Xuất báo cáo theo nhu cầu</h3><p>File XLSX được tạo từ dữ liệu Google Sheets trong kỳ lọc, không sử dụng dữ liệu bộ nhớ trình duyệt.</p></div></div></>
}

function StatusBadge({ status }: { status: string }) { const normalized = status.toLowerCase(); const className = normalized.includes('thanh toán') || normalized.includes('áp dụng') ? 'success' : normalized.includes('tắt') || normalized.includes('hủy') ? 'muted' : 'warning'; return <span className={`status-badge ${className}`}><i />{status}</span> }

function Modal({ title, eyebrow, children, onClose }: { title: string; eyebrow: string; children: ReactNode; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><div><div className="section-eyebrow">{eyebrow}</div><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng"><Icon name="close" /></button></div>{children}</div></div> }

function ShopModal({ shop, salesUsers, currentUser, isAdmin, onClose, onSaved, showToast }: { shop?: Shop; salesUsers: User[]; currentUser: User; isAdmin: boolean; onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({ shop_name: shop?.shop_name || '', address: shop?.address || '', phone: shop?.phone || '', contact_name: shop?.contact_name || '', salesperson_id: shop?.salesperson_id || (isAdmin ? '' : currentUser.user_id), current_supplier: shop?.current_supplier || '', notes: shop?.notes || '', latitude: String(shop?.latitude || ''), longitude: String(shop?.longitude || '') })
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const gpsLocked = String(shop?.gps_locked) === 'true'
  const gpsGranted = String(shop?.gps_edit_granted) === 'true'
  const gpsDisabled = Boolean(shop && gpsLocked && !gpsGranted)
  const locate = () => {
    if (gpsDisabled) return showToast('GPS đã khóa. Hãy nhờ Admin cấp quyền sửa một lần.', 'info')
    if (!navigator.geolocation) return showToast('Thiết bị không hỗ trợ GPS', 'error')
    navigator.geolocation.getCurrentPosition((position) => setForm((current) => ({ ...current, latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6) })), () => showToast('Không lấy được GPS. Hãy cấp quyền vị trí.', 'error'), { enableHighAccuracy: true, timeout: 15000 })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.shop_name) return showToast('Vui lòng nhập tên quán', 'error')
    if (!form.latitude || !form.longitude) return showToast('Vui lòng bấm Lấy GPS tại quán', 'error')
    setSaving(true)
    try {
      const result = shop ? await apiRequest<Shop>('updateShop', { ...form, shop_id: shop.shop_id }) : await apiRequest<Shop>('createShop', form)
      const shopId = shop?.shop_id || result.shop_id
      if (file && shopId) await apiRequest('uploadShopPhoto', { shop_id: shopId, file_name: file.name, mime_type: file.type, data_url: await fileToCompressedDataUrl(file) })
      onSaved()
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể lưu hồ sơ quán', 'error') } finally { setSaving(false) }
  }
  return <Modal eyebrow="KHÁCH HÀNG" title={shop ? 'Sửa hồ sơ quán' : 'Thêm hồ sơ quán'} onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field wide"><span>Tên quán <b>*</b></span><input autoFocus value={form.shop_name} onChange={(event) => setForm({ ...form, shop_name: event.target.value })} placeholder="Ví dụ: Quán cà phê..." /></label><label className="field wide"><span>Địa chỉ</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Số nhà, đường, phường/xã..." /></label><div className="form-grid"><label className="field"><span>Người liên hệ</span><input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label><label className="field"><span>Số điện thoại</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="field wide"><span>Sales phụ trách</span><select disabled={!isAdmin} value={form.salesperson_id} onChange={(event) => setForm({ ...form, salesperson_id: event.target.value })}><option value="">Chưa phân công</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select></label><div className="field wide"><span>GPS quán <b>*</b></span><div className="gps-row"><input placeholder="Vĩ độ" value={form.latitude} disabled={gpsDisabled} onChange={(event) => setForm({ ...form, latitude: event.target.value })} /><input placeholder="Kinh độ" value={form.longitude} disabled={gpsDisabled} onChange={(event) => setForm({ ...form, longitude: event.target.value })} /><button type="button" className="secondary-button gps-button" onClick={locate}><Icon name="map" size={16} /> {gpsDisabled ? 'GPS đã khóa' : 'Lấy GPS'}</button></div><small className="field-hint">{gpsDisabled ? 'Muốn sửa GPS, Admin cần cấp quyền một lần tại Danh sách quán.' : gpsGranted ? 'Đã được Admin cấp quyền sửa GPS; lần lưu này sẽ khóa lại.' : 'GPS sẽ khóa ngay sau khi lưu.'}</small></div><label className="field wide"><span>Nhà cung cấp hiện tại</span><input value={form.current_supplier} onChange={(event) => setForm({ ...form, current_supplier: event.target.value })} /></label><label className="field wide"><span>Ghi chú</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><label className="upload-box wide"><input type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="upload-icon"><Icon name="camera" size={22} /></span><strong>{file ? file.name : shop?.photo_url ? 'Đã có ảnh · chọn ảnh mới để thay' : 'Chụp hoặc tải ảnh quán'}</strong><small>Ảnh lưu vào Google Drive theo thư mục mã quán</small></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ quán'}</button></div></form></Modal>
}

function VisitModal({ shops, salesUsers, currentUser, isAdmin, onClose, onSaved, showToast }: { shops: Shop[]; salesUsers: User[]; currentUser: User; isAdmin: boolean; onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) { return <Modal eyebrow="HIỆN TRƯỜNG" title="Check-in đi tuyến" onClose={onClose}><RoutesView shops={shops} salesUsers={salesUsers} currentUser={currentUser} isAdmin={isAdmin} onSaved={onSaved} showToast={showToast} /></Modal> }

function OrderModal({ shops, onClose, onSaved, showToast }: { shops: Shop[]; onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({ shop_id: '', product_type: 'Flamen pha máy', quantity_kg: '', unit_price: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const quantity = parseUserNumber(form.quantity_kg)
  const unitPrice = parseUserNumber(form.unit_price)
  const amount = (Number.isFinite(quantity) ? quantity : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.shop_id) return showToast('Vui lòng chọn quán', 'error')
    if (!Number.isFinite(quantity) || quantity <= 0) return showToast('Số lượng Kg phải là số lớn hơn 0', 'error')
    setSaving(true)
    try { await apiRequest('createOrder', { ...form, quantity_kg: quantity, unit_price: Number.isFinite(unitPrice) ? unitPrice : 0, total_amount: amount }); onSaved() }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể tạo đơn', 'error') }
    finally { setSaving(false) }
  }
  return <Modal eyebrow="BÁN HÀNG" title="Tạo đơn hàng" onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field wide"><span>Quán <b>*</b></span><select autoFocus value={form.shop_id} onChange={(event) => setForm({ ...form, shop_id: event.target.value })}><option value="">Chọn quán</option>{shops.map((shop) => <option key={shop.shop_id} value={shop.shop_id}>{shop.shop_name}</option>)}</select></label><div className="form-grid"><label className="field wide"><span>Loại cafe <b>*</b></span><select value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })}><option>Flamen pha máy</option><option>Flamen pha phin</option></select></label><label className="field"><span>Số lượng (Kg) <b>*</b></span><input type="text" inputMode="decimal" minLength={1} value={form.quantity_kg} onChange={(event) => setForm({ ...form, quantity_kg: event.target.value })} placeholder="Ví dụ: 10 hoặc 10,5" /></label><label className="field"><span>Đơn giá</span><input type="text" inputMode="decimal" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} placeholder="Nhập đơn giá" /></label><label className="field wide"><span>Tổng tiền dự kiến</span><div className="amount-preview">{formatCurrency(amount)} đ</div></label><label className="field wide"><span>Ghi chú</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu đơn hàng'}</button></div></form></Modal>
}

function KpiModal({ onClose, onSaved, showToast }: { onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({ kpi_name: '', kpi_code: '', description: '', unit: 'lần', data_source: 'VISITS', calculation_type: 'COUNT', active: true }); const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!form.kpi_name) return showToast('Vui lòng nhập tên KPI', 'error'); setSaving(true); try { await apiRequest('createKpi', form); onSaved() } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể tạo KPI', 'error') } finally { setSaving(false) } }
  return <Modal eyebrow="HIỆU SUẤT" title="Tạo KPI mới" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="field wide"><span>Tên KPI <b>*</b></span><input autoFocus value={form.kpi_name} onChange={(event) => setForm({ ...form, kpi_name: event.target.value })} placeholder="Ví dụ: Số lượt ghé quán" /></label><label className="field"><span>Mã KPI</span><input value={form.kpi_code} onChange={(event) => setForm({ ...form, kpi_code: event.target.value.toUpperCase() })} placeholder="VISIT_COUNT" /></label><label className="field"><span>Đơn vị</span><input value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value })} /></label><label className="field"><span>Nguồn dữ liệu</span><select value={form.data_source} onChange={(event) => setForm({ ...form, data_source: event.target.value })}><option>VISITS</option><option>ORDERS</option><option>SHOPS</option><option>MANUAL</option></select></label><label className="field"><span>Cách tính</span><select value={form.calculation_type} onChange={(event) => setForm({ ...form, calculation_type: event.target.value })}><option>COUNT</option><option>SUM</option><option>AVG</option><option>DISTINCT_COUNT</option><option>MANUAL</option></select></label><label className="field wide"><span>Mô tả</span><textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Tạo KPI'}</button></div></form></Modal>
}

function KpiTargetModal({ kpis, users, onClose, onSaved, showToast }: { kpis: Kpi[]; users: User[]; onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const salesUsers = users.filter((user) => String(user.role).toLowerCase() === 'sales' && String(user.active) !== 'false')
  const [form, setForm] = useState({ kpi_id: '', user_id: '', role: 'SALES', period_type: 'MONTH', start_date: todayInput(), end_date: todayInput(), target_value: '' })
  const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!form.kpi_id || !form.target_value) return showToast('Vui lòng chọn KPI và nhập chỉ tiêu', 'error')
    setSaving(true)
    try { await apiRequest('createKpiTarget', { ...form, target_value: Number(form.target_value) }); onSaved() }
    catch (error) { showToast(error instanceof Error ? error.message : 'Không thể giao KPI', 'error') }
    finally { setSaving(false) }
  }
  return <Modal eyebrow="HIỆU SUẤT" title="Giao KPI cho Sales" onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="form-grid"><label className="field wide"><span>KPI <b>*</b></span><select autoFocus value={form.kpi_id} onChange={(event) => setForm({ ...form, kpi_id: event.target.value })}><option value="">Chọn KPI</option>{kpis.map((kpi) => <option key={kpi.kpi_id} value={kpi.kpi_id}>{kpi.kpi_name} ({kpi.unit})</option>)}</select></label><label className="field wide"><span>Sales áp dụng</span><select value={form.user_id} onChange={(event) => setForm({ ...form, user_id: event.target.value })}><option value="">Toàn bộ Sales / theo vai trò</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select></label><label className="field"><span>Chu kỳ</span><select value={form.period_type} onChange={(event) => setForm({ ...form, period_type: event.target.value })}><option value="DAY">Ngày</option><option value="WEEK">Tuần</option><option value="MONTH">Tháng</option></select></label><label className="field"><span>Chỉ tiêu <b>*</b></span><input type="number" min="0" step="0.1" value={form.target_value} onChange={(event) => setForm({ ...form, target_value: event.target.value })} /></label><label className="field"><span>Từ ngày</span><input type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} /></label><label className="field"><span>Đến ngày</span><input type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu mục tiêu'}</button></div></form></Modal>
}

export default App

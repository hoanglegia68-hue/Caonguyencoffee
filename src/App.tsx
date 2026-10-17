import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react'
import { apiRequest, fileToCompressedDataUrl } from './lib/api'

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
}

type Order = {
  order_id: string
  shop_id: string
  shop_name?: string
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

type User = { user_id: string; full_name: string; email: string; role: string; active?: boolean | string }

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

function formatDate(value?: string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date)
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function getDateDaysAgo(days: number) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString().slice(0, 10)
}

function App() {
  const [activeView, setActiveView] = useState<View>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [dateFrom, setDateFrom] = useState(getDateDaysAgo(7))
  const [dateTo, setDateTo] = useState(todayInput())
  const [salesFilter, setSalesFilter] = useState('all')
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard)
  const [shops, setShops] = useState<Shop[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [kpis, setKpis] = useState<Kpi[]>([])
  const [kpiTargets, setKpiTargets] = useState<KpiTarget[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(true)
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [modal, setModal] = useState<'shop' | 'visit' | 'order' | 'kpi' | 'kpi-target' | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [dashboardResult, shopsResult, ordersResult, kpisResult, usersResult, kpiTargetsResult] = await Promise.all([
        apiRequest<DashboardData>('getDashboard', { dateFrom, dateTo, salespersonId: salesFilter === 'all' ? '' : salesFilter }),
        apiRequest<Shop[]>('getShops', { dateFrom, dateTo, salespersonId: salesFilter === 'all' ? '' : salesFilter }),
        apiRequest<Order[]>('getOrders', { dateFrom, dateTo, salespersonId: salesFilter === 'all' ? '' : salesFilter }),
        apiRequest<Kpi[]>('getKpis', {}),
        apiRequest<User[]>('getUsers', {}),
        apiRequest<KpiTarget[]>('getKpiTargets', {}),
      ])
      setDashboard({ ...emptyDashboard, ...dashboardResult })
      setShops(Array.isArray(shopsResult) ? shopsResult : [])
      setOrders(Array.isArray(ordersResult) ? ordersResult : [])
      setKpis(Array.isArray(kpisResult) ? kpisResult : [])
      setKpiTargets(Array.isArray(kpiTargetsResult) ? kpiTargetsResult : [])
      setUsers(Array.isArray(usersResult) ? usersResult : [])
      setConnected(true)
    } catch (error) {
      setConnected(false)
      showToast(error instanceof Error ? error.message : 'Không thể tải dữ liệu', 'info')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [dateFrom, dateTo, salesFilter])

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type })
    window.setTimeout(() => setToast(null), 4200)
  }

  const salesUsers = useMemo(() => users.filter((user) => String(user.role).toLowerCase() === 'sales' && String(user.active) !== 'false'), [users])
  const title = navItems.find((item) => item.id === activeView)?.label || 'Tổng quan'

  const onNavigate = (view: View) => {
    setActiveView(view)
    setMobileNav(false)
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark">CN</div>
          <div>
            <div className="brand-title">Cao Nguyên</div>
            <div className="brand-subtitle">Vina Coffee</div>
          </div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Đóng menu"><Icon name="close" /></button>
        </div>
        <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${activeView === item.id ? 'active' : ''}`} onClick={() => onNavigate(item.id)}>
              <Icon name={item.icon} /><span>{item.label}</span>
              {item.id === 'shops' && shops.length > 0 && <span className="nav-count">{shops.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="data-status">
            <span className={`status-dot ${connected ? 'online' : 'offline'}`} />
            <div>
              <div className="status-title">{connected ? 'Sẵn sàng kết nối' : 'Chưa kết nối API'}</div>
              <div className="status-caption">Google Sheets database</div>
            </div>
          </div>
          <div className="profile-card">
            <div className="avatar">CN</div>
            <div className="profile-copy"><strong>Quản trị hệ thống</strong><span>Admin workspace</span></div>
            <Icon name="settings" size={16} />
          </div>
        </div>
      </aside>

      {mobileNav && <button className="sidebar-overlay" onClick={() => setMobileNav(false)} aria-label="Đóng menu" />}

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Mở menu"><Icon name="menu" /></button>
            <div>
              <div className="eyebrow">QUẢN TRỊ VẬN HÀNH</div>
              <h1>{title}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <div className={`connection-pill ${connected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot" /> {connected ? 'Đã kết nối' : 'Offline'}
            </div>
            <button className="icon-button" onClick={() => void loadData()} disabled={loading} aria-label="Làm mới"><Icon name="refresh" /></button>
            <div className="topbar-date"><Icon name="calendar" size={16} /> <span>{formatDate(todayInput())}</span></div>
          </div>
        </header>

        <div className="content-wrap">
          {activeView === 'overview' && <Overview dashboard={dashboard} dateFrom={dateFrom} dateTo={dateTo} salesFilter={salesFilter} salesUsers={salesUsers} onDateFrom={setDateFrom} onDateTo={setDateTo} onSales={setSalesFilter} onOpenRoute={() => onNavigate('routes')} onOpenOrder={() => onNavigate('orders')} />}
          {activeView === 'shops' && <ShopsView shops={shops} salesUsers={salesUsers} onAdd={() => setModal('shop')} onVisit={() => setModal('visit')} />}
          {activeView === 'routes' && <RoutesView shops={shops} salesUsers={salesUsers} onSaved={() => { setModal(null); void loadData() }} showToast={showToast} />}
          {activeView === 'orders' && <OrdersView orders={orders} shops={shops} onAdd={() => setModal('order')} />}
          {activeView === 'payments' && <PaymentsView orders={orders} />}
          {activeView === 'kpi' && <KpiView kpis={kpis} kpiTargets={kpiTargets} onAdd={() => setModal('kpi')} onAssign={() => setModal('kpi-target')} />}
          {activeView === 'reports' && <ReportsView dateFrom={dateFrom} dateTo={dateTo} salesFilter={salesFilter} showToast={showToast} />}
        </div>
      </main>

      {modal === 'shop' && <ShopModal salesUsers={salesUsers} onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã tạo hồ sơ quán') }} showToast={showToast} />}
      {modal === 'visit' && <VisitModal shops={shops} salesUsers={salesUsers} onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã ghi nhận lượt đi tuyến') }} showToast={showToast} />}
      {modal === 'order' && <OrderModal shops={shops} onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã tạo đơn hàng') }} showToast={showToast} />}
      {modal === 'kpi' && <KpiModal onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã tạo KPI mới') }} showToast={showToast} />}
      {modal === 'kpi-target' && <KpiTargetModal kpis={kpis} users={users} onClose={() => setModal(null)} onSaved={() => { setModal(null); void loadData(); showToast('Đã giao KPI') }} showToast={showToast} />}
      {toast && <div className={`toast toast-${toast.type}`}><span className="toast-icon"><Icon name={toast.type === 'success' ? 'check' : toast.type === 'error' ? 'close' : 'trend'} size={16} /></span>{toast.message}</div>}
    </div>
  )
}

function PageIntro({ eyebrow, title, description, action, actionLabel, actionIcon = 'plus' as IconName }: { eyebrow: string; title: string; description: string; action?: () => void; actionLabel?: string; actionIcon?: IconName }) {
  return <div className="page-intro"><div><div className="section-eyebrow">{eyebrow}</div><h2>{title}</h2><p>{description}</p></div>{action && actionLabel && <button className="primary-button" onClick={action}><Icon name={actionIcon} size={17} /> {actionLabel}</button>}</div>
}

function FilterBar({ dateFrom, dateTo, salesFilter, salesUsers, onDateFrom, onDateTo, onSales }: { dateFrom: string; dateTo: string; salesFilter: string; salesUsers: User[]; onDateFrom: (value: string) => void; onDateTo: (value: string) => void; onSales: (value: string) => void }) {
  return <div className="filter-bar"><div className="filter-label"><Icon name="calendar" size={16} /> Kỳ báo cáo</div><input aria-label="Từ ngày" type="date" value={dateFrom} onChange={(event) => onDateFrom(event.target.value)} /><span className="date-separator">đến</span><input aria-label="Đến ngày" type="date" value={dateTo} onChange={(event) => onDateTo(event.target.value)} /><div className="filter-spacer" /><label className="select-with-icon"><Icon name="users" size={16} /><select value={salesFilter} onChange={(event) => onSales(event.target.value)}><option value="all">Tất cả Sales</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select><Icon name="chevron" size={14} /></label></div>
}

function Overview({ dashboard, dateFrom, dateTo, salesFilter, salesUsers, onDateFrom, onDateTo, onSales, onOpenRoute, onOpenOrder }: { dashboard: DashboardData; dateFrom: string; dateTo: string; salesFilter: string; salesUsers: User[]; onDateFrom: (value: string) => void; onDateTo: (value: string) => void; onSales: (value: string) => void; onOpenRoute: () => void; onOpenOrder: () => void }) {
  const cards = [
    { label: 'Tổng doanh thu', value: `${formatCurrency(dashboard.revenue)} đ`, meta: 'Trong kỳ đã chọn', icon: 'trend' as IconName, tone: 'green' },
    { label: 'Sản lượng bán', value: `${dashboard.quantityKg || 0} kg`, meta: 'Tổng khối lượng', icon: 'cart' as IconName, tone: 'orange' },
    { label: 'Lượt ghé quán', value: dashboard.visitCount, meta: 'Đã ghi nhận', icon: 'route' as IconName, tone: 'blue' },
    { label: 'Hoàn thành KPI', value: `${dashboard.kpiCompletion || 0}%`, meta: 'Theo mục tiêu hiện tại', icon: 'target' as IconName, tone: 'purple' },
  ]
  return <>
    <PageIntro eyebrow="TỔNG QUAN DOANH NGHIỆP" title="Bức tranh kinh doanh" description="Theo dõi hoạt động bán hàng và hiệu suất đội ngũ theo thời gian thực." />
    <FilterBar dateFrom={dateFrom} dateTo={dateTo} salesFilter={salesFilter} salesUsers={salesUsers} onDateFrom={onDateFrom} onDateTo={onDateTo} onSales={onSales} />
    <div className="metrics-grid">{cards.map((card) => <div className="metric-card" key={card.label}><div className={`metric-icon ${card.tone}`}><Icon name={card.icon} size={20} /></div><div className="metric-copy"><span>{card.label}</span><strong>{card.value}</strong><small>{card.meta}</small></div><div className="metric-menu">•••</div></div>)}</div>
    <div className="overview-grid">
      <div className="panel chart-panel"><div className="panel-heading"><div><h3>Nhịp vận hành</h3><span>Doanh thu và sản lượng trong kỳ</span></div><span className="legend"><i className="legend-dot revenue" /> Doanh thu <i className="legend-dot kg" /> Sản lượng</span></div><ActivityChart series={dashboard.series} /></div>
      <div className="panel quick-panel"><div className="panel-heading"><div><h3>Thao tác nhanh</h3><span>Cập nhật dữ liệu tại hiện trường</span></div></div><button className="quick-action" onClick={onOpenRoute}><span className="quick-icon route-bg"><Icon name="route" /></span><span><strong>Ghi nhận đi tuyến</strong><small>GPS, ảnh và thông tin quán</small></span><Icon name="chevron" size={17} /></button><button className="quick-action" onClick={onOpenOrder}><span className="quick-icon order-bg"><Icon name="cart" /></span><span><strong>Tạo đơn hàng mới</strong><small>Ghi nhận sản lượng bán</small></span><Icon name="chevron" size={17} /></button><button className="quick-action" onClick={() => window.open('https://drive.google.com/drive/folders/1xJsrPnZNltFQs4djPO-SM7_FrwoSxu8r', '_blank')}><span className="quick-icon drive-bg"><Icon name="camera" /></span><span><strong>Mở thư mục hình ảnh</strong><small>Google Drive lưu ảnh visit</small></span><Icon name="chevron" size={17} /></button></div>
    </div>
    <div className="overview-grid bottom-grid"><div className="panel"><div className="panel-heading"><div><h3>Hiệu suất KPI</h3><span>Tiến độ các chỉ tiêu đang áp dụng</span></div><a className="text-link">Xem chi tiết <Icon name="chevron" size={14} /></a></div><EmptyState icon="target" title="Chưa có dữ liệu KPI" description="Khi Admin thiết lập mục tiêu, tiến độ sẽ hiển thị tại đây." /></div><div className="panel"><div className="panel-heading"><div><h3>Hoạt động gần đây</h3><span>Các cập nhật mới nhất</span></div><a className="text-link">Xem tất cả <Icon name="chevron" size={14} /></a></div><EmptyState icon="file" title="Chưa có hoạt động" description="Dữ liệu sẽ xuất hiện sau khi có lượt ghé hoặc đơn hàng." /></div></div>
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

function ShopsView({ shops, salesUsers, onAdd, onVisit }: { shops: Shop[]; salesUsers: User[]; onAdd: () => void; onVisit: () => void }) {
  return <><PageIntro eyebrow="KHÁCH HÀNG" title="Danh sách quán" description="Quản lý hồ sơ, lịch sử ghé thăm và giá trị kinh doanh của từng điểm bán." action={onAdd} actionLabel="Thêm quán" /><div className="table-toolbar"><div className="search-field"><Icon name="search" size={17} /><input placeholder="Tìm theo tên quán, địa chỉ..." /><span>0 kết quả</span></div><button className="secondary-button" onClick={onVisit}><Icon name="route" size={16} /> Ghi nhận visit</button></div><div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Tên quán</th><th>Địa chỉ / tọa độ</th><th>Salesperson</th><th>Doanh thu kỳ lọc</th><th>Đơn TB/tháng</th><th>Đặt hàng gần nhất</th><th>Visit gần nhất</th><th /></tr></thead><tbody>{shops.map((shop) => <tr key={shop.shop_id}><td><div className="shop-cell"><div className="shop-avatar">{shop.shop_name?.slice(0, 1).toUpperCase() || 'Q'}</div><div><strong>{shop.shop_name || 'Chưa đặt tên'}</strong><small>{shop.status || 'Đang hoạt động'}</small></div></div></td><td><div className="address-cell">{shop.address || 'Chưa cập nhật'}{shop.latitude && shop.longitude && <a href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`} target="_blank" rel="noreferrer"><Icon name="map" size={13} /> Mở bản đồ</a>}</div></td><td>{shop.salesperson_name || salesUsers.find((user) => user.user_id === shop.salesperson_id)?.full_name || 'Chưa phân công'}</td><td>{formatCurrency(shop.revenue)} đ</td><td>{shop.avg_monthly_orders || 0}</td><td>{formatDate(shop.last_order_at)}</td><td>{formatDate(shop.last_visit_at)}</td><td><button className="row-more">•••</button></td></tr>)}</tbody></table>{shops.length === 0 && <EmptyState icon="store" title="Chưa có hồ sơ quán" description="Hãy tạo quán đầu tiên để bắt đầu quản lý tuyến bán hàng." action={onAdd} actionLabel="Thêm quán đầu tiên" />}</div></div></>
}

function RoutesView({ shops, salesUsers, onSaved, showToast }: { shops: Shop[]; salesUsers: User[]; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [shopId, setShopId] = useState('')
  const [salespersonId, setSalespersonId] = useState('')
  const [visitDate, setVisitDate] = useState(todayInput())
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [capturedAddress, setCapturedAddress] = useState('')
  const [supplier, setSupplier] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const locate = () => {
    if (!navigator.geolocation) return showToast('Thiết bị không hỗ trợ GPS', 'error')
    navigator.geolocation.getCurrentPosition((position) => { setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6)); showToast('Đã lấy tọa độ hiện tại') }, () => showToast('Không lấy được GPS. Hãy kiểm tra quyền vị trí.', 'error'), { enableHighAccuracy: true, timeout: 10000 })
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!shopId || !salespersonId) return showToast('Vui lòng chọn quán và Sales', 'error')
    setSaving(true)
    try {
      const result = await apiRequest<{ visit_id: string }>('createVisit', { shop_id: shopId, salesperson_id: salespersonId, visit_date: visitDate, latitude, longitude, captured_address: capturedAddress, current_supplier: supplier, notes })
      if (file && result?.visit_id) await apiRequest('uploadVisitPhoto', { visit_id: result.visit_id, shop_id: shopId, file_name: file.name, mime_type: file.type, data_url: await fileToCompressedDataUrl(file) })
      onSaved()
    } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể lưu visit', 'error') } finally { setSaving(false) }
  }
  return <><PageIntro eyebrow="HIỆN TRƯỜNG" title="Đi tuyến" description="Ghi nhận visit bằng GPS, hình ảnh và thông tin thực tế tại quán." /><div className="route-layout"><form className="panel form-panel" onSubmit={submit}><div className="panel-heading"><div><h3>Phiếu ghi nhận visit</h3><span>Dữ liệu sẽ lưu vào Google Sheets và Google Drive</span></div><span className="form-step">01 / 01</span></div><div className="form-grid"><label className="field wide"><span>Quán <b>*</b></span><select value={shopId} onChange={(event) => setShopId(event.target.value)}><option value="">Chọn quán cần ghé</option>{shops.map((shop) => <option key={shop.shop_id} value={shop.shop_id}>{shop.shop_name}</option>)}</select></label><label className="field"><span>Sales phụ trách <b>*</b></span><select value={salespersonId} onChange={(event) => setSalespersonId(event.target.value)}><option value="">Chọn Sales</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select></label><label className="field"><span>Ngày ghé</span><input type="date" value={visitDate} onChange={(event) => setVisitDate(event.target.value)} /></label><div className="field wide"><span>Vị trí GPS</span><div className="gps-row"><input placeholder="Vĩ độ" value={latitude} onChange={(event) => setLatitude(event.target.value)} /><input placeholder="Kinh độ" value={longitude} onChange={(event) => setLongitude(event.target.value)} /><button type="button" className="secondary-button gps-button" onClick={locate}><Icon name="map" size={16} /> Lấy GPS</button></div></div><label className="field wide"><span>Địa chỉ ghi nhận</span><input placeholder="Địa chỉ tại thời điểm ghé" value={capturedAddress} onChange={(event) => setCapturedAddress(event.target.value)} /></label><label className="field wide"><span>Nhà cung cấp hiện tại</span><input placeholder="Nhập tên nhà cung cấp nếu có" value={supplier} onChange={(event) => setSupplier(event.target.value)} /></label><label className="field wide"><span>Thông tin khác</span><textarea rows={4} placeholder="Ghi chú tình hình quán, nhu cầu, đối thủ..." value={notes} onChange={(event) => setNotes(event.target.value)} /></label><label className="upload-box wide"><input type="file" accept="image/*" capture="environment" onChange={(event) => setFile(event.target.files?.[0] || null)} /><span className="upload-icon"><Icon name="camera" size={22} /></span><strong>{file ? file.name : 'Chụp hoặc tải ảnh quán'}</strong><small>Ảnh sẽ được lưu vào thư mục Google Drive theo mã quán</small></label></div><div className="form-actions"><span><Icon name="settings" size={15} /> Có thể bổ sung trường visit trong cấu hình</span><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu lượt ghé'}</button></div></form><div className="panel route-aside"><div className="aside-illustration"><Icon name="map" size={38} /></div><h3>Ghi nhận chính xác</h3><p>Hãy bật quyền vị trí và camera để dữ liệu tuyến có đầy đủ bằng chứng tại hiện trường.</p><div className="aside-list"><div><span className="aside-number">01</span><span>Lấy tọa độ ngay tại quán</span></div><div><span className="aside-number">02</span><span>Chụp mặt tiền hoặc bảng hiệu</span></div><div><span className="aside-number">03</span><span>Nhập nhà cung cấp và ghi chú</span></div></div></div></div></>
}

function OrdersView({ orders, shops, onAdd }: { orders: Order[]; shops: Shop[]; onAdd: () => void }) {
  return <><PageIntro eyebrow="BÁN HÀNG" title="Đơn hàng" description="Theo dõi sản lượng Flamen theo từng quán và nhân viên Sales." action={onAdd} actionLabel="Tạo đơn hàng" actionIcon="cart" /><div className="summary-strip"><div><span>Tổng đơn trong kỳ</span><strong>{orders.length}</strong></div><div><span>Tổng sản lượng</span><strong>{orders.reduce((sum, order) => sum + Number(order.quantity_kg || 0), 0)} kg</strong></div><div><span>Đã thanh toán</span><strong>{orders.filter((order) => order.payment_status === 'Đã thanh toán').length}</strong></div><div><span>Chờ thanh toán</span><strong>{orders.filter((order) => order.payment_status !== 'Đã thanh toán').length}</strong></div></div><div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Mã đơn</th><th>Quán</th><th>Sản phẩm</th><th>Số lượng</th><th>Thành tiền</th><th>Ngày đặt</th><th>Thanh toán</th></tr></thead><tbody>{orders.map((order) => <tr key={order.order_id}><td><span className="mono">{order.order_id}</span></td><td>{order.shop_name || shops.find((shop) => shop.shop_id === order.shop_id)?.shop_name || '—'}</td><td>{order.product_type}</td><td><strong>{order.quantity_kg} kg</strong></td><td>{formatCurrency(order.total_amount)} đ</td><td>{formatDate(order.order_date)}</td><td><StatusBadge status={order.payment_status || 'Chờ xác nhận'} /></td></tr>)}</tbody></table>{orders.length === 0 && <EmptyState icon="cart" title="Chưa có đơn hàng" description="Các đơn hàng do Sales ghi nhận sẽ hiển thị tại đây." action={onAdd} actionLabel="Tạo đơn hàng đầu tiên" />}</div></div></>
}

function PaymentsView({ orders }: { orders: Order[] }) {
  const unpaid = orders.filter((order) => order.payment_status !== 'Đã thanh toán')
  return <><PageIntro eyebrow="TÀI CHÍNH" title="Xác nhận thanh toán" description="Kế toán xác nhận tiền về và cập nhật công nợ theo từng đơn hàng." /><div className="summary-strip payment-summary"><div><span>Đơn chờ xác nhận</span><strong>{unpaid.length}</strong></div><div><span>Giá trị chờ thu</span><strong>{formatCurrency(unpaid.reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} đ</strong></div><div><span>Đã thu trong kỳ</span><strong>{formatCurrency(orders.filter((order) => order.payment_status === 'Đã thanh toán').reduce((sum, order) => sum + Number(order.total_amount || 0), 0))} đ</strong></div></div><div className="panel"><div className="panel-heading"><div><h3>Danh sách cần xử lý</h3><span>Cập nhật trạng thái thanh toán sau khi đối soát</span></div><button className="secondary-button"><Icon name="download" size={16} /> Xuất đối soát</button></div>{unpaid.length === 0 ? <EmptyState icon="wallet" title="Chưa có khoản cần xác nhận" description="Khi có đơn hàng chưa thanh toán, Kế toán sẽ xử lý tại đây." /> : <div className="table-wrap"><table><thead><tr><th>Mã đơn</th><th>Quán</th><th>Ngày đặt</th><th>Số tiền</th><th>Trạng thái</th><th /></tr></thead><tbody>{unpaid.map((order) => <tr key={order.order_id}><td className="mono">{order.order_id}</td><td>{order.shop_name || order.shop_id}</td><td>{formatDate(order.order_date)}</td><td>{formatCurrency(order.total_amount)} đ</td><td><StatusBadge status={order.payment_status || 'Chờ xác nhận'} /></td><td><button className="table-action"><Icon name="check" size={15} /> Xác nhận</button></td></tr>)}</tbody></table></div>}</div></>
}

function KpiView({ kpis, kpiTargets, onAdd, onAssign }: { kpis: Kpi[]; kpiTargets: KpiTarget[]; onAdd: () => void; onAssign: () => void }) {
  return <><PageIntro eyebrow="HIỆU SUẤT" title="KPI & mục tiêu" description="Thiết lập chỉ tiêu linh hoạt cho Sales, nhóm hoặc toàn công ty." action={onAdd} actionLabel="Tạo KPI" actionIcon="target" /><div className="kpi-info"><div className="kpi-info-icon"><Icon name="target" size={20} /></div><div><strong>KPI được thiết kế mở rộng</strong><span>Thêm chỉ tiêu mới bằng các phép tính SUM, COUNT, AVG, DISTINCT_COUNT hoặc nhập thủ công.</span></div><button className="secondary-button" onClick={onAssign}><Icon name="users" size={15} /> Giao KPI cho Sales</button></div><div className="panel table-panel"><div className="table-wrap"><table><thead><tr><th>Tên KPI</th><th>Đơn vị</th><th>Cách tính</th><th>Trạng thái</th><th>Đã giao</th><th>Mục tiêu kỳ hiện tại</th><th /></tr></thead><tbody>{kpis.map((kpi) => { const targets = kpiTargets.filter((target) => target.kpi_id === kpi.kpi_id); return <tr key={kpi.kpi_id}><td><div className="kpi-name"><span className="kpi-bullet" /><strong>{kpi.kpi_name}</strong></div></td><td>{kpi.unit}</td><td><span className="formula-badge">{kpi.calculation_type}</span></td><td><StatusBadge status={String(kpi.active) === 'false' ? 'Tạm tắt' : 'Đang áp dụng'} /></td><td>{targets.length ? `${targets.length} người` : 'Chưa giao'}</td><td>{targets.length ? targets.map((target) => `${target.target_value || 0} ${kpi.unit}`).join(', ') : '—'}</td><td><button className="row-more">•••</button></td></tr> })}</tbody></table>{kpis.length === 0 && <EmptyState icon="target" title="Chưa có KPI" description="Tạo KPI đầu tiên để bắt đầu đo lường hiệu suất đội ngũ." action={onAdd} actionLabel="Tạo KPI đầu tiên" />}</div></div></>
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

function ShopModal({ salesUsers, onClose, onSaved, showToast }: { salesUsers: User[]; onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({ shop_name: '', address: '', phone: '', contact_name: '', salesperson_id: '', current_supplier: '', notes: '' }); const [saving, setSaving] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!form.shop_name) return showToast('Vui lòng nhập tên quán', 'error'); setSaving(true); try { await apiRequest('createShop', form); onSaved() } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể tạo quán', 'error') } finally { setSaving(false) } }
  return <Modal eyebrow="KHÁCH HÀNG" title="Thêm hồ sơ quán" onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field wide"><span>Tên quán <b>*</b></span><input autoFocus value={form.shop_name} onChange={(event) => setForm({ ...form, shop_name: event.target.value })} placeholder="Ví dụ: Quán cà phê..." /></label><label className="field wide"><span>Địa chỉ</span><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Số nhà, đường, phường/xã..." /></label><div className="form-grid"><label className="field"><span>Người liên hệ</span><input value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></label><label className="field"><span>Số điện thoại</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="field wide"><span>Sales phụ trách</span><select value={form.salesperson_id} onChange={(event) => setForm({ ...form, salesperson_id: event.target.value })}><option value="">Chưa phân công</option>{salesUsers.map((user) => <option key={user.user_id} value={user.user_id}>{user.full_name}</option>)}</select></label><label className="field wide"><span>Nhà cung cấp hiện tại</span><input value={form.current_supplier} onChange={(event) => setForm({ ...form, current_supplier: event.target.value })} /></label><label className="field wide"><span>Ghi chú</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ quán'}</button></div></form></Modal>
}

function VisitModal({ shops, salesUsers, onClose, onSaved, showToast }: { shops: Shop[]; salesUsers: User[]; onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) { return <Modal eyebrow="HIỆN TRƯỜNG" title="Ghi nhận visit nhanh" onClose={onClose}><RoutesView shops={shops} salesUsers={salesUsers} onSaved={onSaved} showToast={showToast} /></Modal> }

function OrderModal({ shops, onClose, onSaved, showToast }: { shops: Shop[]; onClose: () => void; onSaved: () => void; showToast: (message: string, type?: 'success' | 'error' | 'info') => void }) {
  const [form, setForm] = useState({ shop_id: '', product_type: 'Flamen pha máy', quantity_kg: '', unit_price: '', notes: '' }); const [saving, setSaving] = useState(false); const amount = Number(form.quantity_kg || 0) * Number(form.unit_price || 0)
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!form.shop_id || !form.quantity_kg) return showToast('Vui lòng chọn quán và nhập số lượng', 'error'); setSaving(true); try { await apiRequest('createOrder', { ...form, quantity_kg: Number(form.quantity_kg), unit_price: Number(form.unit_price), total_amount: amount }); onSaved() } catch (error) { showToast(error instanceof Error ? error.message : 'Không thể tạo đơn', 'error') } finally { setSaving(false) } }
  return <Modal eyebrow="BÁN HÀNG" title="Tạo đơn hàng" onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="field wide"><span>Quán <b>*</b></span><select autoFocus value={form.shop_id} onChange={(event) => setForm({ ...form, shop_id: event.target.value })}><option value="">Chọn quán</option>{shops.map((shop) => <option key={shop.shop_id} value={shop.shop_id}>{shop.shop_name}</option>)}</select></label><div className="form-grid"><label className="field wide"><span>Loại cafe <b>*</b></span><select value={form.product_type} onChange={(event) => setForm({ ...form, product_type: event.target.value })}><option>Flamen pha máy</option><option>Flamen pha phin</option></select></label><label className="field"><span>Số lượng (Kg) <b>*</b></span><input type="number" min="0" step="0.1" value={form.quantity_kg} onChange={(event) => setForm({ ...form, quantity_kg: event.target.value })} /></label><label className="field"><span>Đơn giá</span><input type="number" min="0" value={form.unit_price} onChange={(event) => setForm({ ...form, unit_price: event.target.value })} /></label><label className="field wide"><span>Tổng tiền dự kiến</span><div className="amount-preview">{formatCurrency(amount)} đ</div></label><label className="field wide"><span>Ghi chú</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Hủy</button><button className="primary-button" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu đơn hàng'}</button></div></form></Modal>
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

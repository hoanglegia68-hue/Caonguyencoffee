/**
 * Cao Nguyen Vina Coffee ERP - Google Apps Script API
 *
 * Deploy as Web app, execute as the owner, then place the deployment URL in
 * Vercel as APPS_SCRIPT_URL. This file intentionally creates headers only;
 * it never inserts demo or seed records.
 */

const APP = {
  spreadsheetId: '1dZyetpYCBm2qboEdrvFhPrq1DH4pIVmGrY5weTbTM08',
  driveRootFolderId: '1xJsrPnZNltFQs4djPO-SM7_FrwoSxu8r',
  timeZone: 'Asia/Ho_Chi_Minh',
  sheets: {
    USERS: ['user_id', 'email', 'full_name', 'role', 'phone', 'active', 'username', 'password', 'password_hash'],
    SHOPS: ['shop_id', 'shop_name', 'address', 'latitude', 'longitude', 'phone', 'contact_name', 'current_supplier', 'salesperson_id', 'status', 'notes', 'created_at', 'updated_at', 'gps_locked', 'gps_edit_granted', 'photo_file_id', 'photo_url'],
    VISITS: ['visit_id', 'shop_id', 'salesperson_id', 'visit_date', 'latitude', 'longitude', 'captured_address', 'current_supplier', 'photo_file_id', 'photo_url', 'notes', 'created_at', 'checkin_latitude', 'checkin_longitude', 'distance_meters', 'checkin_verified'],
    ORDERS: ['order_id', 'shop_id', 'salesperson_id', 'order_date', 'product_type', 'quantity_kg', 'unit_price', 'total_amount', 'payment_status', 'notes', 'created_at'],
    PAYMENTS: ['payment_id', 'order_id', 'shop_id', 'accountant_id', 'paid_date', 'amount', 'payment_method', 'status', 'notes'],
    KPI_DEFINITIONS: ['kpi_id', 'kpi_code', 'kpi_name', 'description', 'unit', 'data_source', 'calculation_type', 'active'],
    KPI_TARGETS: ['target_id', 'kpi_id', 'user_id', 'role', 'period_type', 'start_date', 'end_date', 'target_value'],
    KPI_RECORDS: ['record_id', 'kpi_id', 'user_id', 'shop_id', 'record_date', 'actual_value', 'source_id', 'notes'],
    CONFIG: ['config_key', 'config_value'],
    LOGS: ['log_id', 'email', 'action', 'entity_id', 'created_at', 'details']
  }
};

function doGet(e) {
  const payload = Object.assign({}, e && e.parameter ? e.parameter : {}, { action: (e && e.parameter && e.parameter.action) || 'getConfig' });
  return handleRequest_(payload);
}

function doPost(e) {
  return handleRequest_(parseBody_(e));
}

function handleRequest_(payload) {
  try {
    const action = String(payload && payload.action || '');
    if (!action) throw new Error('Thiếu action trong request.');
    ensureSchema_();
    const user = authorize_(action, payload);
    const scopedPayload = scopePayload_(payload, user);
    return jsonResponse({ success: true, data: route_(action, scopedPayload, user) });
  } catch (error) {
    logError_(payload && payload.action ? payload.action : 'REQUEST', error);
    return jsonResponse({ success: false, error: safeMessage_(error) });
  }
}

// Hàm công khai để chạy thủ công trong Apps Script Editor.
// Chỉ tạo các sheet và hàng tiêu đề, không tạo dữ liệu mẫu.
function initializeSchema() {
  return initializeSchema_();
}

function route_(action, payload, user) {
  switch (action) {
    case 'login': return login_(payload);
    case 'logout': return logout_(payload);
    case 'initializeSchema': return initializeSchema_();
    case 'getConfig': return getConfig_();
    case 'getUsers': return getUsers_(user);
    case 'getShops': return getShops_(payload);
    case 'getShopDetail': return getShopDetail_(payload);
    case 'createShop': return createShop_(payload, user);
    case 'updateShop': return updateShop_(payload, user);
    case 'grantGpsEdit': return grantGpsEdit_(payload);
    case 'uploadShopPhoto': return uploadShopPhoto_(payload, user);
    case 'checkIn': return checkIn_(payload, user);
    case 'createVisit': return createVisit_(payload, user);
    case 'uploadVisitPhoto': return uploadVisitPhoto_(payload, user);
    case 'getOrders': return getOrders_(payload);
    case 'createOrder': return createOrder_(payload, user);
    case 'updateOrder': return updateOrder_(payload, user);
    case 'confirmPayment': return confirmPayment_(payload);
    case 'getKpis': return getRows_('KPI_DEFINITIONS');
    case 'getKpiTargets': return getKpiTargets_(payload);
    case 'createKpi': return createKpi_(payload);
    case 'createKpiTarget': return createKpiTarget_(payload);
    case 'updateKpi': return updateRow_('KPI_DEFINITIONS', payload, 'kpi_id');
    case 'updateKpiTarget': return updateRow_('KPI_TARGETS', payload, 'target_id');
    case 'getDashboard': return getDashboard_(payload);
    case 'getReports': return getReports_(payload);
    case 'exportReportXlsx': return exportReportXlsx_(payload);
    default: throw new Error('Action không được hỗ trợ: ' + action);
  }
}

function authorize_(action, payload) {
  if (action === 'login' || action === 'initializeSchema') return { role: 'admin', email: '' };
  if (action === 'logout') return getSessionUser_(payload.session_token) || { role: 'admin', email: '' };
  if (action === 'getConfig') return getSessionUser_(payload.session_token) || { role: 'admin', email: '' };
  const user = getSessionUser_(payload && payload.session_token);
  if (!user) throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  const role = role_(user);
  const permissions = {
    getDashboard: ['admin', 'sales'], getShops: ['admin', 'sales'], getShopDetail: ['admin', 'sales'],
    getOrders: ['admin', 'sales', 'accountant', 'kế toán'], getKpis: ['admin', 'sales'],
    getKpiTargets: ['admin', 'sales'], getReports: ['admin', 'sales'], exportReportXlsx: ['admin', 'sales'],
    getUsers: ['admin', 'sales'], createShop: ['admin', 'sales'], updateShop: ['admin', 'sales'],
    grantGpsEdit: ['admin'], uploadShopPhoto: ['admin', 'sales'], checkIn: ['admin', 'sales'],
    createVisit: ['admin', 'sales'], uploadVisitPhoto: ['admin', 'sales'], createOrder: ['admin', 'sales'],
    updateOrder: ['admin', 'sales'], confirmPayment: ['admin', 'accountant', 'kế toán'],
    createKpi: ['admin'], createKpiTarget: ['admin'], updateKpi: ['admin'], updateKpiTarget: ['admin']
  };
  if (permissions[action] && permissions[action].indexOf(role) < 0) {
    if (role === 'accountant' || role === 'kế toán') throw new Error('Tài khoản Kế toán chỉ được sử dụng Menu Thanh toán.');
    throw new Error('Tài khoản không có quyền thực hiện thao tác này.');
  }
  return user;
}

function login_(payload) {
  const username = String(payload.username || '').trim().toLowerCase();
  const password = String(payload.password || '');
  if (!username || !password) throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu.');
  const user = getRows_('USERS').filter(function(row) {
    const login = String(row.username || row.email || '').trim().toLowerCase();
    return login === username && String(row.active) !== 'false';
  })[0];
  if (!user) throw new Error('Tên đăng nhập không tồn tại hoặc tài khoản đã bị khóa.');
  const plainMatch = String(user.password || '') === password;
  const hashMatch = String(user.password_hash || '') && String(user.password_hash) === hashPassword_(password, user.username || user.email);
  if (!plainMatch && !hashMatch) throw new Error('Mật khẩu không đúng.');
  const safeUser = sanitizeUser_(user);
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  CacheService.getScriptCache().put('SESSION_' + token, JSON.stringify(safeUser), 21600);
  return { token: token, user: safeUser };
}

function logout_(payload) {
  if (payload && payload.session_token) CacheService.getScriptCache().remove('SESSION_' + payload.session_token);
  return { logged_out: true };
}

function getSessionUser_(token) {
  if (!token) return null;
  const raw = CacheService.getScriptCache().get('SESSION_' + String(token));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

function sanitizeUser_(user) {
  return { user_id: user.user_id, username: user.username || user.email, email: user.email || '', full_name: user.full_name || user.username || user.email, role: user.role || 'sales', phone: user.phone || '', active: user.active !== 'false' };
}

function role_(user) { return String(user && user.role || '').trim().toLowerCase(); }

function scopePayload_(payload, user) {
  const scoped = Object.assign({}, payload || {});
  if (user && role_(user) === 'sales') {
    scoped.salespersonId = user.user_id;
    scoped.salesperson_id = user.user_id;
    scoped.user_id = user.user_id;
  }
  return scoped;
}

function initializeSchema_() {
  const spreadsheet = SpreadsheetApp.openById(APP.spreadsheetId);
  Object.keys(APP.sheets).forEach(function(name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    const headers = APP.sheets[name];
    const currentHeaders = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    if (currentHeaders.join('|') !== headers.join('|')) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
    headers.forEach(function(_, index) { sheet.autoResizeColumn(index + 1); });
  });
  return { initialized: true, sheets: Object.keys(APP.sheets) };
}

function ensureSchema_() {
  const cache = CacheService.getScriptCache();
  if (cache.get('SCHEMA_READY_V2') === '1') return;
  initializeSchema_();
  cache.put('SCHEMA_READY_V2', '1', 21600);
}

function getConfig_() {
  const rows = getRows_('CONFIG');
  const config = { spreadsheetId: APP.spreadsheetId, driveRootFolderId: APP.driveRootFolderId, timeZone: APP.timeZone };
  rows.forEach(function(row) { if (row.config_key) config[row.config_key] = row.config_value; });
  return config;
}

function getUsers_(user) {
  const users = getRows_('USERS').map(sanitizeUser_);
  return user && role_(user) === 'sales' ? users.filter(function(row) { return row.user_id === user.user_id; }) : users;
}

function getShops_(payload) {
  const shops = filterRows_(getRows_('SHOPS'), payload);
  const orders = getRows_('ORDERS');
  const visits = getRows_('VISITS');
  const users = indexBy_(getRows_('USERS'), 'user_id');
  return shops.map(function(shop) {
    const shopOrders = orders.filter(function(order) { return order.shop_id === shop.shop_id && inDateRange_(order.order_date, payload); });
    const shopVisits = visits.filter(function(visit) { return visit.shop_id === shop.shop_id && inDateRange_(visit.visit_date, payload); });
    const revenue = sum_(shopOrders, 'total_amount');
    return Object.assign({}, shop, {
      salesperson_name: users[shop.salesperson_id] ? users[shop.salesperson_id].full_name : '',
      revenue: revenue,
      avg_monthly_revenue: averageMonthly_(orders.filter(function(order) { return order.shop_id === shop.shop_id; }), 'total_amount'),
      avg_monthly_orders: averageMonthlyCount_(orders.filter(function(order) { return order.shop_id === shop.shop_id; })),
      last_order_at: latest_(orders.filter(function(order) { return order.shop_id === shop.shop_id; }), 'order_date'),
      last_visit_at: latest_(visits.filter(function(visit) { return visit.shop_id === shop.shop_id; }), 'visit_date'),
      visit_count: shopVisits.length
    });
  });
}

function getShopDetail_(payload) {
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (!shop) throw new Error('Không tìm thấy quán.');
  if (payload.salespersonId && shop.salesperson_id !== payload.salespersonId) throw new Error('Bạn không có quyền xem quán này.');
  return { shop: shop, visits: getRows_('VISITS').filter(function(row) { return row.shop_id === payload.shop_id; }), orders: getRows_('ORDERS').filter(function(row) { return row.shop_id === payload.shop_id; }), payments: getRows_('PAYMENTS').filter(function(row) { return row.shop_id === payload.shop_id; }) };
}

function createShop_(payload, user) {
  const row = normalize_(payload, APP.sheets.SHOPS);
  if (!row.latitude || !row.longitude) throw new Error('Hãy lấy GPS quán trước khi lưu hồ sơ.');
  if (user && role_(user) === 'sales') row.salesperson_id = user.user_id;
  row.shop_id = row.shop_id || id_('SHOP');
  row.status = row.status || 'Đang hoạt động';
  row.gps_locked = true;
  row.gps_edit_granted = false;
  row.created_at = now_();
  row.updated_at = now_();
  appendRow_('SHOPS', row);
  audit_('createShop', row.shop_id, row);
  return row;
}

function updateShop_(payload, user) {
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (!shop) throw new Error('Không tìm thấy quán.');
  if (role_(user) === 'sales' && shop.salesperson_id !== user.user_id) throw new Error('Bạn chỉ được sửa quán do mình phụ trách.');
  const gpsChanged = (payload.latitude !== undefined && String(payload.latitude) !== String(shop.latitude || '')) || (payload.longitude !== undefined && String(payload.longitude) !== String(shop.longitude || ''));
  if (gpsChanged && String(shop.gps_locked) === 'true' && String(shop.gps_edit_granted) !== 'true') throw new Error('GPS đã khóa. Hãy nhờ Admin cấp quyền sửa GPS một lần.');
  const changes = Object.assign({}, payload, { updated_at: now_() });
  if (role_(user) === 'sales') changes.salesperson_id = user.user_id;
  if (gpsChanged) { changes.gps_locked = true; changes.gps_edit_granted = false; }
  return updateRow_('SHOPS', changes, 'shop_id');
}

function grantGpsEdit_(payload) {
  if (!payload.shop_id) throw new Error('Thiếu shop_id.');
  return updateRow_('SHOPS', { shop_id: payload.shop_id, gps_edit_granted: true }, 'shop_id');
}

function checkIn_(payload, user) {
  if (!payload.shop_id || !payload.latitude || !payload.longitude) throw new Error('Thiếu quán hoặc vị trí GPS hiện tại.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (!shop) throw new Error('Không tìm thấy quán.');
  if (!shop.latitude || !shop.longitude) throw new Error('Quán chưa có GPS. Hãy cập nhật GPS tại Danh sách quán.');
  if (role_(user) === 'sales' && shop.salesperson_id !== user.user_id) throw new Error('Bạn chỉ được check-in quán do mình phụ trách.');
  const distance = distanceMeters_(Number(shop.latitude), Number(shop.longitude), Number(payload.latitude), Number(payload.longitude));
  if (distance > 50) throw new Error('Check-in không hợp lệ: bạn đang cách quán ' + Math.round(distance) + ' m, vượt bán kính 50 m.');
  const row = normalize_(payload, APP.sheets.VISITS);
  row.visit_id = id_('VISIT');
  row.shop_id = shop.shop_id;
  row.salesperson_id = role_(user) === 'sales' ? user.user_id : (payload.salesperson_id || shop.salesperson_id || '');
  row.visit_date = payload.visit_date || date_();
  row.latitude = Number(payload.latitude);
  row.longitude = Number(payload.longitude);
  row.checkin_latitude = Number(payload.latitude);
  row.checkin_longitude = Number(payload.longitude);
  row.distance_meters = Math.round(distance * 10) / 10;
  row.checkin_verified = true;
  row.created_at = now_();
  appendRow_('VISITS', row);
  audit_('checkIn', row.visit_id, row);
  return row;
}

function createVisit_(payload, user) {
  return checkIn_(payload, user);
}

function uploadShopPhoto_(payload, user) {
  if (!payload.data_url || !payload.shop_id) throw new Error('Thiếu ảnh hoặc mã quán.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (!shop) throw new Error('Không tìm thấy quán.');
  if (role_(user) === 'sales' && shop.salesperson_id !== user.user_id) throw new Error('Bạn chỉ được cập nhật ảnh quán do mình phụ trách.');
  const match = String(payload.data_url).match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Ảnh không đúng định dạng data URL.');
  const folder = getOrCreateShopFolder_(shop.shop_id, shop.shop_name);
  const stamp = Utilities.formatDate(new Date(), APP.timeZone, 'yyyyMMdd_HHmmss');
  const fileName = (shop.shop_id + '_' + slug_(shop.shop_name) + '_' + stamp + '_Shop.jpg').replace(/_+/g, '_');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], fileName));
  file.setDescription('Cao Nguyen Vina Coffee - Shop ' + shop.shop_id);
  updateRow_('SHOPS', { shop_id: shop.shop_id, photo_file_id: file.getId(), photo_url: file.getUrl(), updated_at: now_() }, 'shop_id');
  audit_('uploadShopPhoto', shop.shop_id, { fileId: file.getId(), name: fileName });
  return { file_id: file.getId(), file_url: file.getUrl(), file_name: fileName };
}

function uploadVisitPhoto_(payload, user) {
  if (!payload.data_url || !payload.visit_id) throw new Error('Thiếu ảnh hoặc mã visit.');
  const match = String(payload.data_url).match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Ảnh không đúng định dạng data URL.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (shop && role_(user) === 'sales' && shop.salesperson_id !== user.user_id) throw new Error('Bạn không có quyền cập nhật ảnh cho quán này.');
  const folder = getOrCreateShopFolder_(payload.shop_id, shop ? shop.shop_name : payload.shop_id);
  const safeShop = slug_(shop ? shop.shop_name : payload.shop_id);
  const stamp = Utilities.formatDate(new Date(), APP.timeZone, 'yyyyMMdd_HHmm');
  let fileName = (payload.shop_id + '_' + safeShop + '_' + stamp + '_Visit.jpg').replace(/_+/g, '_');
  const existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) fileName = fileName.replace('_Visit.jpg', '_Visit_' + payload.visit_id + '.jpg');
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], fileName);
  const file = folder.createFile(blob);
  file.setDescription('Cao Nguyen Vina Coffee - Visit ' + payload.visit_id);
  updateRow_('VISITS', { visit_id: payload.visit_id, photo_file_id: file.getId(), photo_url: file.getUrl() }, 'visit_id');
  audit_('uploadVisitPhoto', payload.visit_id, { fileId: file.getId(), name: fileName });
  return { file_id: file.getId(), file_url: file.getUrl(), file_name: fileName };
}

function getOrCreateShopFolder_(shopId, shopName) {
  const root = DriveApp.getFolderById(APP.driveRootFolderId);
  const folderName = shopId + '_' + slug_(shopName);
  const folders = root.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : root.createFolder(folderName);
}

function getOrders_(payload) {
  const orders = filterRows_(getRows_('ORDERS'), payload);
  const shops = indexBy_(getRows_('SHOPS'), 'shop_id');
  return orders.map(function(order) { return Object.assign({}, order, { shop_name: shops[order.shop_id] ? shops[order.shop_id].shop_name : '' }); });
}

function createOrder_(payload, user) {
  if (!payload.shop_id || !payload.product_type) throw new Error('Thiếu quán hoặc loại sản phẩm.');
  const quantity = Number(payload.quantity_kg || 0);
  if (quantity <= 0) throw new Error('Số lượng Kg phải lớn hơn 0.');
  const row = normalize_(payload, APP.sheets.ORDERS);
  if (user && role_(user) === 'sales') row.salesperson_id = user.user_id;
  row.order_id = row.order_id || id_('ORDER');
  row.quantity_kg = quantity;
  row.unit_price = Number(payload.unit_price || 0);
  row.total_amount = Number(payload.total_amount || row.quantity_kg * row.unit_price);
  row.order_date = row.order_date || date_();
  row.payment_status = row.payment_status || 'Chờ xác nhận';
  row.created_at = now_();
  appendRow_('ORDERS', row);
  audit_('createOrder', row.order_id, row);
  return row;
}

function updateOrder_(payload, user) {
  const order = getRows_('ORDERS').filter(function(row) { return row.order_id === payload.order_id; })[0];
  if (!order) throw new Error('Không tìm thấy đơn hàng.');
  if (role_(user) === 'sales' && order.salesperson_id !== user.user_id) throw new Error('Bạn chỉ được sửa đơn hàng của mình.');
  return updateRow_('ORDERS', payload, 'order_id');
}

function confirmPayment_(payload) {
  if (!payload.order_id) throw new Error('Thiếu order_id.');
  const orders = getRows_('ORDERS');
  const order = orders.filter(function(row) { return row.order_id === payload.order_id; })[0];
  if (!order) throw new Error('Không tìm thấy đơn hàng.');
  const payment = normalize_(payload, APP.sheets.PAYMENTS);
  payment.payment_id = payment.payment_id || id_('PAY');
  payment.shop_id = payment.shop_id || order.shop_id;
  payment.amount = Number(payment.amount || order.total_amount || 0);
  payment.paid_date = payment.paid_date || date_();
  payment.status = 'Đã thanh toán';
  appendRow_('PAYMENTS', payment);
  updateRow_('ORDERS', { order_id: order.order_id, payment_status: 'Đã thanh toán' }, 'order_id');
  audit_('confirmPayment', payment.payment_id, payment);
  return payment;
}

function createKpi_(payload) {
  const row = normalize_(payload, APP.sheets.KPI_DEFINITIONS);
  row.kpi_id = row.kpi_id || id_('KPI');
  row.kpi_code = row.kpi_code || slug_(row.kpi_name).toUpperCase();
  row.active = row.active === false || row.active === 'false' ? false : true;
  appendRow_('KPI_DEFINITIONS', row);
  audit_('createKpi', row.kpi_id, row);
  return row;
}

function createKpiTarget_(payload) {
  if (!payload.kpi_id || !payload.target_value) throw new Error('Thiếu KPI hoặc chỉ tiêu.');
  const row = normalize_(payload, APP.sheets.KPI_TARGETS);
  row.target_id = row.target_id || id_('TARGET');
  row.period_type = row.period_type || 'MONTH';
  row.start_date = row.start_date || date_();
  row.end_date = row.end_date || date_();
  row.target_value = Number(row.target_value);
  if (row.target_value <= 0) throw new Error('Chỉ tiêu phải lớn hơn 0.');
  appendRow_('KPI_TARGETS', row);
  audit_('createKpiTarget', row.target_id, row);
  return row;
}

function getDashboard_(payload) {
  const shops = filterRows_(getRows_('SHOPS'), payload);
  const visits = filterRows_(getRows_('VISITS'), payload);
  const orders = filterRows_(getRows_('ORDERS'), payload);
  const orderIds = indexBy_(orders, 'order_id');
  const payments = getRows_('PAYMENTS').filter(function(payment) { return inDateRange_(payment.paid_date, payload) && (!payload.salespersonId || orderIds[payment.order_id]); });
  const revenue = sum_(orders, 'total_amount');
  const paid = sum_(payments, 'amount');
  return { shopCount: shops.length, visitCount: visits.length, orderCount: orders.length, quantityKg: sum_(orders, 'quantity_kg'), revenue: revenue, paid: paid, debt: Math.max(0, revenue - paid), kpiCompletion: calculateKpiCompletion_(payload), series: buildSeries_(orders, visits, payload) };
}

function getReports_(payload) {
  const orders = getOrders_(payload);
  const orderIds = indexBy_(orders, 'order_id');
  return { dashboard: getDashboard_(payload), shops: getShops_(payload), orders: orders, visits: filterRows_(getRows_('VISITS'), payload), payments: getRows_('PAYMENTS').filter(function(row) { return inDateRange_(row.paid_date, payload) && (!payload.salespersonId || orderIds[row.order_id]); }), kpis: getRows_('KPI_DEFINITIONS') };
}

function exportReportXlsx_(payload) {
  const report = getReports_(payload);
  const reportType = payload.reportType || 'sales';
  const name = 'Bao_cao_' + reportType + '_' + (payload.dateFrom || date_()) + '_' + (payload.dateTo || date_());
  const temp = SpreadsheetApp.create(name);
  const sheet = temp.getSheets()[0];
  const rows = reportRows_(reportType, report);
  if (rows.length) sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.setFrozenRows(1);
  const blob = UrlFetchApp.fetch('https://docs.google.com/spreadsheets/d/' + temp.getId() + '/export?format=xlsx', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() } }).getBlob().setName(name + '.xlsx');
  const file = DriveApp.getFolderById(APP.driveRootFolderId).createFile(blob);
  DriveApp.getFileById(temp.getId()).setTrashed(true);
  return { downloadUrl: file.getUrl(), fileId: file.getId(), fileName: file.getName() };
}

function reportRows_(type, report) {
  if (type === 'routes') return toMatrix_(['visit_id', 'shop_id', 'salesperson_id', 'visit_date', 'latitude', 'longitude', 'captured_address', 'current_supplier', 'photo_url', 'notes'], report.visits);
  if (type === 'kpi') return toMatrix_(['kpi_id', 'kpi_code', 'kpi_name', 'unit', 'calculation_type', 'active'], report.kpis);
  if (type === 'debt') return toMatrix_(['order_id', 'shop_id', 'order_date', 'quantity_kg', 'total_amount', 'payment_status'], report.orders);
  return toMatrix_(['order_id', 'shop_id', 'salesperson_id', 'order_date', 'product_type', 'quantity_kg', 'unit_price', 'total_amount', 'payment_status'], report.orders);
}

function listRows_(sheetName, payload) { return filterRows_(getRows_(sheetName), payload); }

function getKpiTargets_(payload) {
  return getRows_('KPI_TARGETS').filter(function(row) {
    const ownerOk = !payload.salespersonId || !row.user_id || row.user_id === payload.salespersonId;
    const dateValue = row.start_date || row.end_date || row.created_at;
    return ownerOk && inDateRange_(dateValue, payload);
  });
}

function filterRows_(rows, payload) {
  return rows.filter(function(row) {
    const salesFilter = payload.salespersonId || payload.salesperson_id || '';
    const salespersonOk = !salesFilter || row.salesperson_id === salesFilter;
    const dateValue = row.order_date || row.visit_date || row.paid_date || row.created_at;
    return salespersonOk && inDateRange_(dateValue, payload);
  });
}

function updateRow_(sheetName, payload, key) {
  const sheet = SpreadsheetApp.openById(APP.spreadsheetId).getSheetByName(sheetName);
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  const keyIndex = headers.indexOf(key);
  const rowIndex = values.findIndex(function(row) { return String(row[keyIndex]) === String(payload[key]); });
  if (rowIndex < 0) throw new Error('Không tìm thấy bản ghi ' + payload[key]);
  const current = values[rowIndex];
  headers.forEach(function(header, index) { if (Object.prototype.hasOwnProperty.call(payload, header) && payload[header] !== undefined) current[index] = payload[header]; });
  sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([current]);
  audit_('update' + sheetName, payload[key], payload);
  return rowToObject_(headers, current);
}

function getRows_(sheetName) {
  const sheet = SpreadsheetApp.openById(APP.spreadsheetId).getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
  const headers = values.shift().map(String);
  return values.filter(function(row) { return row.some(function(value) { return value !== ''; }); }).map(function(row) { return rowToObject_(headers, row); });
}

function appendRow_(sheetName, object) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = SpreadsheetApp.openById(APP.spreadsheetId).getSheetByName(sheetName);
    const headers = APP.sheets[sheetName];
    sheet.appendRow(headers.map(function(header) { return object[header] === undefined ? '' : object[header]; }));
  } finally { lock.releaseLock(); }
}

function normalize_(payload, headers) { const object = {}; headers.forEach(function(header) { if (payload[header] !== undefined) object[header] = payload[header]; }); return object; }
function rowToObject_(headers, row) { const object = {}; headers.forEach(function(header, index) { object[header] = row[index] instanceof Date ? Utilities.formatDate(row[index], APP.timeZone, "yyyy-MM-dd'T'HH:mm:ss") : row[index]; }); return object; }
function indexBy_(rows, key) { return rows.reduce(function(acc, row) { if (row[key]) acc[row[key]] = row; return acc; }, {}); }
function sum_(rows, key) { return rows.reduce(function(total, row) { return total + (Number(row[key]) || 0); }, 0); }
function latest_(rows, key) { return rows.reduce(function(latest, row) { return !latest || String(row[key]) > String(latest) ? row[key] : latest; }, ''); }
function averageMonthly_(rows, key) { const months = {}; rows.forEach(function(row) { const keyMonth = String(row.order_date || row.created_at || '').slice(0, 7); if (keyMonth) months[keyMonth] = (months[keyMonth] || 0) + (Number(row[key]) || 0); }); const values = Object.keys(months).map(function(key) { return months[key]; }); return values.length ? Math.round(values.reduce(function(a, b) { return a + b; }, 0) / values.length) : 0; }
function averageMonthlyCount_(rows) { const months = {}; rows.forEach(function(row) { const keyMonth = String(row.order_date || row.created_at || '').slice(0, 7); if (keyMonth) months[keyMonth] = (months[keyMonth] || 0) + 1; }); const values = Object.keys(months).map(function(key) { return months[key]; }); return values.length ? Math.round(values.reduce(function(a, b) { return a + b; }, 0) / values.length * 10) / 10 : 0; }
function inDateRange_(value, payload) { if (!value) return true; const date = String(value).slice(0, 10); return (!payload.dateFrom || date >= payload.dateFrom) && (!payload.dateTo || date <= payload.dateTo); }
function buildSeries_(orders, visits, payload) { const map = {}; orders.forEach(function(order) { const key = String(order.order_date || '').slice(0, 10); if (!key || !inDateRange_(key, payload)) return; map[key] = map[key] || { label: key.slice(5), revenue: 0, quantityKg: 0, orders: 0, visits: 0 }; map[key].revenue += Number(order.total_amount) || 0; map[key].quantityKg += Number(order.quantity_kg) || 0; map[key].orders += 1; }); visits.forEach(function(visit) { const key = String(visit.visit_date || '').slice(0, 10); if (!key || !inDateRange_(key, payload)) return; map[key] = map[key] || { label: key.slice(5), revenue: 0, quantityKg: 0, orders: 0, visits: 0 }; map[key].visits += 1; }); return Object.keys(map).sort().map(function(key) { return map[key]; }).slice(-14); }
function calculateKpiCompletion_(payload) {
  const definitions = indexBy_(getRows_('KPI_DEFINITIONS'), 'kpi_id');
  const targets = getRows_('KPI_TARGETS').filter(function(target) {
    const dateOk = (!payload.dateFrom || !target.end_date || target.end_date >= payload.dateFrom) && (!payload.dateTo || !target.start_date || target.start_date <= payload.dateTo);
    const ownerOk = !payload.salespersonId || !target.user_id || target.user_id === payload.salespersonId;
    return dateOk && ownerOk && Number(target.target_value) > 0;
  });
  if (!targets.length) return 0;
  const orders = filterRows_(getRows_('ORDERS'), payload);
  const visits = filterRows_(getRows_('VISITS'), payload);
  const records = filterRows_(getRows_('KPI_RECORDS'), payload);
  let total = 0;
  targets.forEach(function(target) {
    const definition = definitions[target.kpi_id] || {};
    const actual = calculateKpiActual_(definition, target, orders, visits, records);
    total += Math.min(100, actual / Number(target.target_value) * 100);
  });
  return Math.round(total / targets.length);
}

function calculateKpiActual_(definition, target, orders, visits, records) {
  const source = String(definition.data_source || '').toUpperCase();
  const calculation = String(definition.calculation_type || 'COUNT').toUpperCase();
  if (calculation === 'MANUAL') return sum_(records.filter(function(record) { return record.kpi_id === target.kpi_id; }), 'actual_value');
  const rows = source === 'ORDERS' ? orders : source === 'VISITS' ? visits : source === 'KPI_RECORDS' ? records : [];
  const scopedRows = rows.filter(function(row) { return !target.user_id || row.salesperson_id === target.user_id || row.user_id === target.user_id; });
  if (calculation === 'DISTINCT_COUNT') return Object.keys(indexBy_(scopedRows, 'shop_id')).length;
  if (calculation === 'SUM') {
    const unit = String(definition.unit || '').toLowerCase();
    const code = String(definition.kpi_code || '').toLowerCase();
    if (unit.indexOf('kg') >= 0 || code.indexOf('kg') >= 0) return sum_(scopedRows, 'quantity_kg');
    if (unit.indexOf('đ') >= 0 || code.indexOf('revenue') >= 0 || code.indexOf('doanh') >= 0) return sum_(scopedRows, 'total_amount');
    return sum_(scopedRows, 'actual_value');
  }
  if (calculation === 'AVG') return scopedRows.length ? sum_(scopedRows, 'quantity_kg') / scopedRows.length : 0;
  return scopedRows.length;
}
function toMatrix_(headers, rows) { return [headers].concat(rows.map(function(row) { return headers.map(function(header) { return row[header] === undefined ? '' : row[header]; }); })); }
function parseBody_(e) { if (!e || !e.postData || !e.postData.contents) return {}; try { return JSON.parse(e.postData.contents); } catch (_) { return e.parameter || {}; } }
function now_() { return Utilities.formatDate(new Date(), APP.timeZone, "yyyy-MM-dd'T'HH:mm:ss"); }
function date_() { return Utilities.formatDate(new Date(), APP.timeZone, 'yyyy-MM-dd'); }
function id_(prefix) { return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase(); }
function slug_(value) { return String(value || 'NO_NAME').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase(); }
function hashPassword_(password, salt) { const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt || '') + ':' + String(password || '')); return bytes.map(function(byte) { const value = byte < 0 ? byte + 256 : byte; return ('0' + value.toString(16)).slice(-2); }).join(''); }
function distanceMeters_(lat1, lon1, lat2, lon2) { const radius = 6371000; const toRadians = function(value) { return value * Math.PI / 180; }; const dLat = toRadians(lat2 - lat1); const dLon = toRadians(lon2 - lon1); const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
function audit_(action, entityId, details) { try { appendRow_('LOGS', { log_id: id_('LOG'), email: Session.getActiveUser().getEmail() || '', action: action, entity_id: entityId, created_at: now_(), details: JSON.stringify(details).slice(0, 45000) }); } catch (_) {} }
function logError_(action, error) { try { audit_('ERROR_' + action, '', { error: safeMessage_(error) }); } catch (_) {} }
function safeMessage_(error) { return error && error.message ? error.message : String(error); }
function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }

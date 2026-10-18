/**
 * Cao Nguyen Vina Coffee ERP - Google Apps Script API
 *
 * Deploy as Web app, execute as the owner, then place the deployment URL in
 * Vercel as APPS_SCRIPT_URL. This file intentionally creates headers only;
 * it never inserts demo or seed records.
 */

const APP = {
  spreadsheetId: '1dZyetpYCBm2qboEdrvFhPrq1DH4pIVmGrY5weTbTM08',
  driveRootFolderId: '1yuK9MuHFWieUeyF0u5SbkcfQJirrqeWF',
  timeZone: 'Asia/Ho_Chi_Minh',
  sheets: {
    USERS: ['user_id', 'email', 'full_name', 'role', 'phone', 'active', 'username', 'password', 'password_hash', 'password_salt'],
    SHOPS: ['shop_id', 'shop_name', 'address', 'latitude', 'longitude', 'phone', 'contact_name', 'current_supplier', 'salesperson_id', 'status', 'notes', 'created_at', 'updated_at', 'gps_locked', 'gps_edit_granted', 'photo_file_id', 'photo_url', 'gps_edit_requested'],
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
  return jsonResponse({ success: false, error: 'Chỉ hỗ trợ POST.' });
}

function doPost(e) {
  return handleRequest_(parseBody_(e));
}

function handleRequest_(payload) {
  try {
    const action = String(payload && payload.action || '');
    if (!action) throw new Error('Thiếu action trong request.');
    // Login cần schema mới để có thể nâng cấp mật khẩu cũ sang hash + salt.
    // Các action khác chỉ được khởi tạo schema sau khi đã xác thực phiên.
    if (action === 'login') ensureSchema_();
    const user = authorize_(action, payload);
    if (action !== 'login') ensureSchema_();
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
    case 'getConfig': return getConfig_();
    case 'getUsers': return getUsers_(user);
    case 'getShops': return getShops_(payload);
    case 'getShopDetail': return getShopDetail_(payload);
    case 'createShop': return createShop_(payload, user);
    case 'updateShop': return updateShop_(payload, user);
    case 'requestGpsEdit': return requestGpsEdit_(payload, user);
    case 'grantGpsEdit': return grantGpsEdit_(payload);
    case 'uploadShopPhoto': return uploadShopPhoto_(payload, user);
    case 'checkIn': return checkIn_(payload, user);
    case 'createVisit': return createVisit_(payload, user);
    case 'uploadVisitPhoto': return uploadVisitPhoto_(payload, user);
    case 'getOrders': return getOrders_(payload);
    case 'createOrder': return createOrder_(payload, user);
    case 'updateOrder': return updateOrder_(payload, user);
    case 'confirmPayment': return confirmPayment_(payload, user);
    case 'getKpis': return getRows_('KPI_DEFINITIONS');
    case 'getKpiProgress': return getKpiProgress_(payload);
    case 'getKpiTargets': return getKpiTargets_(payload);
    case 'createKpi': return createKpi_(payload);
    case 'createKpiTarget': return createKpiTarget_(payload);
    case 'updateKpi': return updateKpi_(payload);
    case 'updateKpiTarget': return updateRow_('KPI_TARGETS', payload, 'target_id');
    case 'getDashboard': return getDashboard_(payload);
    case 'getReports': return getReports_(payload);
    case 'exportReportXlsx': return exportReportXlsx_(payload);
    default: throw new Error('Action không được hỗ trợ: ' + action);
  }
}

function authorize_(action, payload) {
  if (action === 'login') return { role: 'admin', email: '' };
  if (action === 'logout') return getSessionUser_(payload.session_token) || { role: 'admin', email: '' };
  const user = getSessionUser_(payload && payload.session_token);
  if (!user) throw new Error('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');
  const role = role_(user);
  const permissions = {
    getConfig: ['admin'], getDashboard: ['admin', 'sales'], getShops: ['admin', 'sales'], getShopDetail: ['admin', 'sales'],
    getOrders: ['admin', 'sales', 'accountant', 'kế toán'], getKpis: ['admin', 'sales'], getKpiProgress: ['admin', 'sales'],
    getKpiTargets: ['admin', 'sales'], getReports: ['admin', 'sales'], exportReportXlsx: ['admin', 'sales'],
    getUsers: ['admin', 'sales'], createShop: ['admin', 'sales'], updateShop: ['admin', 'sales'],
    requestGpsEdit: ['sales'], grantGpsEdit: ['admin'], uploadShopPhoto: ['admin', 'sales'], checkIn: ['admin', 'sales'],
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
  const failureKey = 'LOGIN_FAIL_' + hashPassword_(username, 'RATE').slice(0, 32);
  const failures = Number(CacheService.getScriptCache().get(failureKey) || 0);
  if (failures >= 5) throw new Error('Tài khoản tạm khóa đăng nhập 15 phút do nhập sai quá nhiều lần.');
  const user = getRows_('USERS').filter(function(row) {
    const login = String(row.username || row.email || '').trim().toLowerCase();
    return login === username && isActive_(row.active);
  })[0];
  if (!user) {
    CacheService.getScriptCache().put(failureKey, String(failures + 1), 900);
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
  }
  const plainMatch = String(user.password || '') === password;
  const hashMatch = String(user.password_hash || '') && String(user.password_hash) === hashPassword_(password, user.password_salt || user.username || user.email);
  if (!plainMatch && !hashMatch) {
    CacheService.getScriptCache().put(failureKey, String(failures + 1), 900);
    throw new Error('Tên đăng nhập hoặc mật khẩu không đúng.');
  }
  CacheService.getScriptCache().remove(failureKey);
  if (plainMatch || !user.password_salt) migratePassword_(user, password);
  const safeUser = sanitizeUser_(user);
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
  CacheService.getScriptCache().put('SESSION_' + token, JSON.stringify(safeUser), 7200);
  return { token: token, user: safeUser };
}

function migratePassword_(user, password) {
  const salt = Utilities.getUuid().replace(/-/g, '');
  updateRow_('USERS', { user_id: user.user_id, password: '', password_hash: hashPassword_(password, salt), password_salt: salt }, 'user_id');
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
  return { user_id: user.user_id, username: user.username || user.email, email: user.email || '', full_name: user.full_name || user.username || user.email, role: user.role || 'sales', phone: user.phone || '', active: isActive_(user.active) };
}

function role_(user) { return String(user && user.role || '').trim().toLowerCase(); }
function isActive_(value) { return value !== false && String(value).trim().toLowerCase() !== 'false' && String(value).trim() !== '0'; }
function isTrue_(value) { return value === true || String(value).trim().toLowerCase() === 'true' || String(value).trim() === '1'; }

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
  if (cache.get('SCHEMA_READY_V4') === '1') return;
  initializeSchema_();
  cache.put('SCHEMA_READY_V4', '1', 21600);
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
  const ordersByShop = groupBy_(orders, 'shop_id');
  const visitsByShop = groupBy_(visits, 'shop_id');
  return shops.map(function(shop) {
    if (shop.photo_file_id) ensurePhotoPreviewAccess_(shop.photo_file_id);
    const normalizedShop = Object.assign({}, shop);
    const latitude = parseCoordinate_(shop.latitude);
    const longitude = parseCoordinate_(shop.longitude);
    if (isFinite(latitude)) normalizedShop.latitude = latitude;
    if (isFinite(longitude)) normalizedShop.longitude = longitude;
    const allShopOrders = ordersByShop[shop.shop_id] || [];
    const allShopVisits = visitsByShop[shop.shop_id] || [];
    const shopOrders = allShopOrders.filter(function(order) { return inDateRange_(order.order_date, payload); });
    const shopVisits = allShopVisits.filter(function(visit) { return inDateRange_(visit.visit_date, payload); });
    const revenue = sum_(shopOrders, 'total_amount');
    return Object.assign({}, normalizedShop, {
      salesperson_name: users[shop.salesperson_id] ? users[shop.salesperson_id].full_name : '',
      photo_thumbnail_url: shop.photo_file_id ? driveThumbnailUrl_(shop.photo_file_id) : '',
      photo_direct_url: shop.photo_file_id ? driveViewUrl_(shop.photo_file_id) : '',
      revenue: revenue,
      avg_monthly_revenue: averageMonthly_(allShopOrders, 'total_amount'),
      avg_monthly_orders: averageMonthlyCount_(allShopOrders),
      last_order_at: latest_(allShopOrders, 'order_date'),
      last_visit_at: latest_(allShopVisits, 'visit_date'),
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
  row.latitude = requireCoordinate_(row.latitude, 'vĩ độ', -90, 90);
  row.longitude = requireCoordinate_(row.longitude, 'kinh độ', -180, 180);
  if (user && role_(user) === 'sales') row.salesperson_id = user.user_id;
  row.shop_id = row.shop_id || id_('SHOP');
  row.status = row.status || 'Đang hoạt động';
  row.gps_locked = true;
  row.gps_edit_granted = false;
  row.gps_edit_requested = false;
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
  const hasGpsPayload = payload.latitude !== undefined || payload.longitude !== undefined;
  const incomingLatitude = payload.latitude !== undefined ? requireCoordinate_(payload.latitude, 'vĩ độ', -90, 90) : parseCoordinate_(shop.latitude);
  const incomingLongitude = payload.longitude !== undefined ? requireCoordinate_(payload.longitude, 'kinh độ', -180, 180) : parseCoordinate_(shop.longitude);
  const existingLatitude = parseCoordinate_(shop.latitude);
  const existingLongitude = parseCoordinate_(shop.longitude);
  const gpsChanged = hasGpsPayload && (incomingLatitude !== existingLatitude || incomingLongitude !== existingLongitude);
  if (gpsChanged && String(shop.gps_locked) === 'true' && String(shop.gps_edit_granted) !== 'true') throw new Error('GPS đã khóa. Hãy nhờ Admin cấp quyền sửa GPS một lần.');
  const changes = { shop_id: shop.shop_id, updated_at: now_() };
  ['shop_name', 'address', 'phone', 'contact_name', 'current_supplier', 'status', 'notes'].forEach(function(field) {
    if (payload[field] !== undefined) changes[field] = String(payload[field]).slice(0, 2000);
  });
  if (role_(user) === 'admin' && payload.salesperson_id !== undefined) changes.salesperson_id = String(payload.salesperson_id);
  if (hasGpsPayload) {
    changes.latitude = incomingLatitude;
    changes.longitude = incomingLongitude;
  }
  if (role_(user) === 'sales') changes.salesperson_id = user.user_id;
  if (gpsChanged) { changes.gps_locked = true; changes.gps_edit_granted = false; changes.gps_edit_requested = false; }
  return updateRow_('SHOPS', changes, 'shop_id');
}

function requestGpsEdit_(payload, user) {
  if (!payload.shop_id) throw new Error('Thiếu shop_id.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (!shop) throw new Error('Không tìm thấy quán.');
  if (role_(user) !== 'sales' || shop.salesperson_id !== user.user_id) throw new Error('Bạn chỉ được xin sửa GPS quán do mình phụ trách.');
  if (String(shop.gps_locked) !== 'true') throw new Error('Quán này chưa khóa GPS, bạn có thể cập nhật GPS trực tiếp.');
  if (String(shop.gps_edit_granted) === 'true') throw new Error('Quán đã được Admin cấp quyền sửa GPS.');
  if (String(shop.gps_edit_requested) === 'true') throw new Error('Yêu cầu sửa GPS đã được gửi và đang chờ Admin phê duyệt.');
  const result = updateRow_('SHOPS', { shop_id: payload.shop_id, gps_edit_requested: true, updated_at: now_() }, 'shop_id');
  audit_('requestGpsEdit', payload.shop_id, { user_id: user.user_id });
  return result;
}

function grantGpsEdit_(payload) {
  if (!payload.shop_id) throw new Error('Thiếu shop_id.');
  return updateRow_('SHOPS', { shop_id: payload.shop_id, gps_edit_granted: true, gps_edit_requested: false, updated_at: now_() }, 'shop_id');
}

function checkIn_(payload, user) {
  if (!payload.shop_id || !payload.latitude || !payload.longitude) throw new Error('Thiếu quán hoặc vị trí GPS hiện tại.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (!shop) throw new Error('Không tìm thấy quán.');
  if (!shop.latitude || !shop.longitude) throw new Error('Quán chưa có GPS. Hãy cập nhật GPS tại Danh sách quán.');
  if (role_(user) === 'sales' && shop.salesperson_id !== user.user_id) throw new Error('Bạn chỉ được check-in quán do mình phụ trách.');
  const shopLatitude = requireCoordinate_(shop.latitude, 'GPS vĩ độ của quán', -90, 90);
  const shopLongitude = requireCoordinate_(shop.longitude, 'GPS kinh độ của quán', -180, 180);
  const currentLatitude = requireCoordinate_(payload.latitude, 'vĩ độ hiện tại', -90, 90);
  const currentLongitude = requireCoordinate_(payload.longitude, 'kinh độ hiện tại', -180, 180);
  const distance = distanceMeters_(shopLatitude, shopLongitude, currentLatitude, currentLongitude);
  if (distance > 50) throw new Error('Check-in không hợp lệ: bạn đang cách quán ' + Math.round(distance) + ' m, vượt bán kính 50 m.');
  const visitDate = String(payload.visit_date || date_()).slice(0, 10);
  const row = normalize_(payload, APP.sheets.VISITS);
  row.visit_id = id_('VISIT');
  row.shop_id = shop.shop_id;
  row.salesperson_id = role_(user) === 'sales' ? user.user_id : (payload.salesperson_id || shop.salesperson_id || '');
  row.visit_date = visitDate;
  row.latitude = currentLatitude;
  row.longitude = currentLongitude;
  row.checkin_latitude = currentLatitude;
  row.checkin_longitude = currentLongitude;
  row.distance_meters = Math.round(distance * 10) / 10;
  row.checkin_verified = true;
  row.created_at = now_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const alreadyCheckedIn = getRows_('VISITS').some(function(visit) {
      return visit.shop_id === shop.shop_id && String(visit.visit_date || '').slice(0, 10) === visitDate && isTrue_(visit.checkin_verified);
    });
    if (alreadyCheckedIn) throw new Error('Quán này đã được check-in hợp lệ trong ngày ' + visitDate + '.');
    appendRowUnlocked_('VISITS', row);
  } finally {
    lock.releaseLock();
  }
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
  validateImageData_(match);
  const folder = getOrCreateShopFolder_(shop.shop_id, shop.shop_name);
  const stamp = Utilities.formatDate(new Date(), APP.timeZone, 'yyyyMMdd_HHmmss');
  const fileName = (shop.shop_id + '_' + slug_(shop.shop_name) + '_' + stamp + '_Shop.jpg').replace(/_+/g, '_');
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], fileName));
  file.setDescription('Cao Nguyen Vina Coffee - Shop ' + shop.shop_id);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (_) {}
  updateRow_('SHOPS', { shop_id: shop.shop_id, photo_file_id: file.getId(), photo_url: file.getUrl(), updated_at: now_() }, 'shop_id');
  audit_('uploadShopPhoto', shop.shop_id, { fileId: file.getId(), name: fileName });
  return { file_id: file.getId(), file_url: driveViewUrl_(file.getId()), thumbnail_url: driveThumbnailUrl_(file.getId()), file_name: fileName };
}

function uploadVisitPhoto_(payload, user) {
  if (!payload.data_url || !payload.visit_id) throw new Error('Thiếu ảnh hoặc mã visit.');
  const match = String(payload.data_url).match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Ảnh không đúng định dạng data URL.');
  validateImageData_(match);
  const visit = getRows_('VISITS').filter(function(row) { return row.visit_id === payload.visit_id; })[0];
  if (!visit) throw new Error('Không tìm thấy lượt check-in.');
  if (payload.shop_id && payload.shop_id !== visit.shop_id) throw new Error('Lượt check-in không thuộc quán đã chọn.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === visit.shop_id; })[0];
  if (shop && role_(user) === 'sales' && shop.salesperson_id !== user.user_id) throw new Error('Bạn không có quyền cập nhật ảnh cho quán này.');
  const folder = getOrCreateShopFolder_(visit.shop_id, shop ? shop.shop_name : visit.shop_id);
  const safeShop = slug_(shop ? shop.shop_name : visit.shop_id);
  const stamp = Utilities.formatDate(new Date(), APP.timeZone, 'yyyyMMdd_HHmm');
  let fileName = (visit.shop_id + '_' + safeShop + '_' + stamp + '_Visit.jpg').replace(/_+/g, '_');
  const existing = folder.getFilesByName(fileName);
  if (existing.hasNext()) fileName = fileName.replace('_Visit.jpg', '_Visit_' + payload.visit_id + '.jpg');
  const blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], fileName);
  const file = folder.createFile(blob);
  file.setDescription('Cao Nguyen Vina Coffee - Visit ' + payload.visit_id);
  updateRow_('VISITS', { visit_id: visit.visit_id, photo_file_id: file.getId(), photo_url: file.getUrl() }, 'visit_id');
  audit_('uploadVisitPhoto', payload.visit_id, { fileId: file.getId(), name: fileName });
  return { file_id: file.getId(), file_url: file.getUrl(), file_name: fileName };
}

function getOrCreateShopFolder_(shopId, shopName) {
  const root = DriveApp.getFolderById(APP.driveRootFolderId);
  const folderName = shopId + '_' + slug_(shopName);
  const folders = root.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : root.createFolder(folderName);
}

function driveThumbnailUrl_(fileId) { return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(String(fileId)) + '&sz=w240'; }
function driveViewUrl_(fileId) { return 'https://drive.google.com/uc?export=view&id=' + encodeURIComponent(String(fileId)); }
function ensurePhotoPreviewAccess_(fileId) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'PHOTO_PUBLIC_' + String(fileId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 80);
  if (cache.get(cacheKey) === '1') return;
  try {
    DriveApp.getFileById(fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    cache.put(cacheKey, '1', 21600);
  } catch (_) {}
}

function getOrders_(payload) {
  const orders = filterRows_(getRows_('ORDERS'), payload);
  const shops = indexBy_(getRows_('SHOPS'), 'shop_id');
  const users = indexBy_(getRows_('USERS'), 'user_id');
  return orders.map(function(order) {
    return Object.assign({}, order, {
      shop_name: shops[order.shop_id] ? shops[order.shop_id].shop_name : '',
      salesperson_name: users[order.salesperson_id] ? users[order.salesperson_id].full_name : ''
    });
  });
}

function createOrder_(payload, user) {
  if (!payload.shop_id || !payload.product_type) throw new Error('Thiếu quán hoặc loại sản phẩm.');
  const productType = String(payload.product_type).trim();
  if (['FLAMEN_PHA_MAY', 'FLAMEN_PHA_PHIN'].indexOf(slug_(productType)) < 0) throw new Error('Loại cafe không hợp lệ. Chỉ chọn Flamen pha máy hoặc Flamen pha phin.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
  if (!shop) throw new Error('Không tìm thấy quán.');
  if (role_(user) === 'sales' && shop.salesperson_id !== user.user_id) throw new Error('Bạn chỉ được tạo đơn cho quán do mình phụ trách.');
  const quantity = parseNumber_(payload.quantity_kg);
  if (quantity <= 0) throw new Error('Số lượng Kg phải lớn hơn 0.');
  if (!Number.isInteger(quantity)) throw new Error('Số lượng Kg phải là số nguyên, ví dụ 10.');
  if (quantity > 100000) throw new Error('Số lượng Kg vượt giới hạn cho phép.');
  const row = normalize_(payload, APP.sheets.ORDERS);
  if (user && role_(user) === 'sales') row.salesperson_id = user.user_id;
  row.order_id = row.order_id || id_('ORDER');
  row.quantity_kg = quantity;
  row.unit_price = parseNumber_(payload.unit_price);
  if (row.unit_price < 0) throw new Error('Đơn giá không được âm.');
  row.product_type = productType;
  row.total_amount = row.quantity_kg * row.unit_price;
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
  if (String(order.payment_status || '').trim() === 'Đã thanh toán' && (payload.quantity_kg !== undefined || payload.unit_price !== undefined)) throw new Error('Không thể sửa số lượng hoặc đơn giá của đơn đã thanh toán.');
  const changes = { order_id: order.order_id };
  if (payload.notes !== undefined) changes.notes = String(payload.notes).slice(0, 2000);
  if (payload.payment_status !== undefined && role_(user) === 'admin') changes.payment_status = payload.payment_status;
  if (payload.quantity_kg !== undefined || payload.unit_price !== undefined) {
    const quantity = payload.quantity_kg === undefined ? parseNumber_(order.quantity_kg) : parseNumber_(payload.quantity_kg);
    const unitPrice = payload.unit_price === undefined ? parseNumber_(order.unit_price) : parseNumber_(payload.unit_price);
    if (quantity <= 0 || !Number.isInteger(quantity) || unitPrice < 0) throw new Error('Số lượng phải là số nguyên lớn hơn 0 và đơn giá không được âm.');
    changes.quantity_kg = quantity;
    changes.unit_price = unitPrice;
    changes.total_amount = quantity * unitPrice;
  }
  return updateRow_('ORDERS', changes, 'order_id');
}

function confirmPayment_(payload, user) {
  if (!payload.order_id) throw new Error('Thiếu order_id.');
  const orders = getRows_('ORDERS');
  const order = orders.filter(function(row) { return row.order_id === payload.order_id; })[0];
  if (!order) throw new Error('Không tìm thấy đơn hàng.');
  if (String(order.payment_status || '').trim() === 'Đã thanh toán') throw new Error('Đơn hàng này đã được xác nhận thanh toán.');
  const payment = normalize_(payload, APP.sheets.PAYMENTS);
  payment.payment_id = payment.payment_id || id_('PAY');
  payment.order_id = order.order_id;
  payment.shop_id = order.shop_id;
  payment.accountant_id = user && user.user_id ? user.user_id : '';
  payment.amount = parseNumber_(order.total_amount);
  if (payment.amount <= 0) throw new Error('Đơn hàng không có giá trị thanh toán hợp lệ.');
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
  row.data_source = normalizeKpiSource_(row.data_source || 'VISITS');
  row.calculation_type = String(row.calculation_type || 'COUNT').trim().toUpperCase();
  row.active = row.active === false || row.active === 'false' ? false : true;
  appendRow_('KPI_DEFINITIONS', row);
  audit_('createKpi', row.kpi_id, row);
  return row;
}

function updateKpi_(payload) {
  if (!payload.kpi_id) throw new Error('Thiếu kpi_id.');
  const row = normalize_(payload, APP.sheets.KPI_DEFINITIONS);
  if (row.data_source !== undefined) row.data_source = normalizeKpiSource_(row.data_source || 'VISITS');
  if (row.calculation_type !== undefined) row.calculation_type = String(row.calculation_type || 'COUNT').trim().toUpperCase();
  if (row.active !== undefined) row.active = row.active === false || row.active === 'false' ? false : true;
  return updateRow_('KPI_DEFINITIONS', row, 'kpi_id');
}

function createKpiTarget_(payload) {
  if (!payload.kpi_id || !payload.target_value) throw new Error('Thiếu KPI hoặc chỉ tiêu.');
  const row = normalize_(payload, APP.sheets.KPI_TARGETS);
  row.target_id = row.target_id || id_('TARGET');
  row.period_type = String(row.period_type || 'MONTH').trim().toUpperCase();
  row.start_date = row.start_date || date_();
  row.end_date = row.end_date || date_();
  if (String(row.start_date) > String(row.end_date)) throw new Error('Ngày bắt đầu KPI không được sau ngày kết thúc.');
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

function getKpiProgress_(payload) {
  const definitions = getRows_('KPI_DEFINITIONS');
  const allTargets = getRows_('KPI_TARGETS').filter(function(target) {
    const ownerOk = !payload.salespersonId || !target.user_id || target.user_id === payload.salespersonId;
    return ownerOk;
  });
  const targets = allTargets.filter(function(target) {
    const dateOk = (!payload.dateFrom || !target.end_date || target.end_date >= payload.dateFrom) && (!payload.dateTo || !target.start_date || target.start_date <= payload.dateTo);
    return dateOk;
  });
  const orders = getRows_('ORDERS');
  const visits = getRows_('VISITS');
  const records = getRows_('KPI_RECORDS');
  const shops = getRows_('SHOPS');
  return definitions.map(function(definition) {
    const definitionTargets = targets.filter(function(target) { return target.kpi_id === definition.kpi_id; });
    const allDefinitionTargets = allTargets.filter(function(target) { return target.kpi_id === definition.kpi_id; });
    const displayTargets = definitionTargets.length ? definitionTargets : allDefinitionTargets;
    const targetValue = displayTargets.reduce(function(total, target) { return total + (Number(target.target_value) || 0); }, 0);
    const target = displayTargets[0] || { kpi_id: definition.kpi_id, user_id: payload.salespersonId || '' };
    const actual = displayTargets.length ? displayTargets.reduce(function(total, targetRow) {
      return total + calculateKpiActualForTarget_(definition, targetRow, payload, orders, visits, records, shops);
    }, 0) : calculateKpiActual_(definition, target, filterRows_(orders, payload), filterRows_(visits, payload), filterRows_(records, payload), filterRows_(shops, payload));
    return Object.assign({}, definition, {
      target_value: targetValue,
      actual_value: Math.round(actual * 100) / 100,
      progress: definitionTargets.length && targetValue > 0 ? Math.min(100, Math.round(actual / targetValue * 100)) : 0,
      target_count: displayTargets.length,
      target_status: definitionTargets.length ? 'ACTIVE' : allDefinitionTargets.length ? 'OUTSIDE_PERIOD' : 'UNASSIGNED',
      target_start_date: target.start_date || '',
      target_end_date: target.end_date || ''
    });
  });
}

function filterRows_(rows, payload) {
  return rows.filter(function(row) {
    const salesFilter = payload.salespersonId || payload.salesperson_id || '';
    const rowOwner = row.salesperson_id || row.user_id;
    const salespersonOk = !salesFilter || rowOwner === salesFilter;
    const dateValue = row.order_date || row.visit_date || row.paid_date || row.record_date || row.created_at;
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
  headers.forEach(function(header, index) { if (Object.prototype.hasOwnProperty.call(payload, header) && payload[header] !== undefined) current[index] = safeCellValue_(header, payload[header]); });
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
    appendRowUnlocked_(sheetName, object);
  } finally { lock.releaseLock(); }
}

function appendRowUnlocked_(sheetName, object) {
  const sheet = SpreadsheetApp.openById(APP.spreadsheetId).getSheetByName(sheetName);
  const headers = APP.sheets[sheetName];
  sheet.appendRow(headers.map(function(header) { return object[header] === undefined ? '' : safeCellValue_(header, object[header]); }));
}

function normalize_(payload, headers) { const object = {}; headers.forEach(function(header) { if (payload[header] !== undefined) object[header] = safeCellValue_(header, payload[header]); }); return object; }
function safeCellValue_(header, value) {
  if (value === null || value === undefined || typeof value !== 'string') return value;
  const text = value.slice(0, 50000);
  const numeric = /^-?\d+(?:[.,]\d+)?$/.test(text.trim());
  if (/^[=+@-]/.test(text) && !numeric) return "'" + text;
  return text;
}
function rowToObject_(headers, row) { const object = {}; headers.forEach(function(header, index) { object[header] = row[index] instanceof Date ? Utilities.formatDate(row[index], APP.timeZone, "yyyy-MM-dd'T'HH:mm:ss") : row[index]; }); return object; }
function indexBy_(rows, key) { return rows.reduce(function(acc, row) { if (row[key]) acc[row[key]] = row; return acc; }, {}); }
function groupBy_(rows, key) { return rows.reduce(function(acc, row) { if (!row[key]) return acc; if (!acc[row[key]]) acc[row[key]] = []; acc[row[key]].push(row); return acc; }, {}); }
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
  const orders = getRows_('ORDERS');
  const visits = getRows_('VISITS');
  const records = getRows_('KPI_RECORDS');
  const shops = getRows_('SHOPS');
  let total = 0;
  targets.forEach(function(target) {
    const definition = definitions[target.kpi_id] || {};
    const actual = calculateKpiActualForTarget_(definition, target, payload, orders, visits, records, shops);
    total += Math.min(100, actual / Number(target.target_value) * 100);
  });
  return Math.round(total / targets.length);
}

function calculateKpiActual_(definition, target, orders, visits, records, shops) {
  const source = normalizeKpiSource_(definition.data_source);
  const calculation = String(definition.calculation_type || 'COUNT').trim().toUpperCase();
  const recordRows = records.filter(function(record) { return record.kpi_id === target.kpi_id && (!target.user_id || record.user_id === target.user_id); });
  if (calculation === 'MANUAL') return sum_(recordRows, 'actual_value');
  const rows = source === 'ORDERS' ? orders : source === 'VISITS' ? visits : source === 'SHOPS' ? shops : source === 'KPI_RECORDS' || source === 'MANUAL' ? records : [];
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
function calculateKpiActualForTarget_(definition, target, payload, orders, visits, records, shops) {
  const periodPayload = Object.assign({}, payload || {});
  if (target.start_date) periodPayload.dateFrom = String(target.start_date).slice(0, 10);
  if (target.end_date) periodPayload.dateTo = String(target.end_date).slice(0, 10);
  return calculateKpiActual_(definition, target, filterRows_(orders, periodPayload), filterRows_(visits, periodPayload), filterRows_(records, periodPayload), filterRows_(shops, periodPayload));
}
function normalizeKpiSource_(value) {
  const source = String(value || '').trim();
  const key = slug_(source);
  if (key === 'VISIT' || key === 'VISITS' || key === 'CHECKIN' || key === 'CHECK_IN' || key === 'DI_TUYEN') return 'VISITS';
  if (key === 'ORDER' || key === 'ORDERS' || key === 'DON_HANG') return 'ORDERS';
  if (key === 'SHOP' || key === 'SHOPS' || key === 'DANH_SACH_QUAN') return 'SHOPS';
  if (key === 'MANUAL' || key === 'KPI_RECORD' || key === 'KPI_RECORDS' || key === 'KPI_THU_CONG') return 'KPI_RECORDS';
  return source.toUpperCase();
}
function toMatrix_(headers, rows) { return [headers].concat(rows.map(function(row) { return headers.map(function(header) { return row[header] === undefined ? '' : row[header]; }); })); }
function parseBody_(e) { if (!e || !e.postData || !e.postData.contents) return {}; try { return JSON.parse(e.postData.contents); } catch (_) { return e.parameter || {}; } }
function now_() { return Utilities.formatDate(new Date(), APP.timeZone, "yyyy-MM-dd'T'HH:mm:ss"); }
function date_() { return Utilities.formatDate(new Date(), APP.timeZone, 'yyyy-MM-dd'); }
function id_(prefix) { return prefix + '_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase(); }
function slug_(value) { return String(value || 'NO_NAME').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toUpperCase(); }
function hashPassword_(password, salt) { const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(salt || '') + ':' + String(password || '')); return bytes.map(function(byte) { const value = byte < 0 ? byte + 256 : byte; return ('0' + value.toString(16)).slice(-2); }).join(''); }
function parseCoordinate_(value) {
  let text = String(value === undefined || value === null ? '' : value).trim().replace(/[^0-9,.-]/g, '');
  if (!text) return NaN;
  const negative = text.charAt(0) === '-';
  text = text.replace(/^[+-]/, '');
  const dotParts = text.split('.');
  const commaParts = text.split(',');
  if (dotParts.length > 2 && dotParts.slice(1).every(function(part) { return part.length === 3; })) {
    text = dotParts[0] + '.' + dotParts.slice(1).join('');
  } else if (commaParts.length > 2 && commaParts.slice(1).every(function(part) { return part.length === 3; })) {
    text = commaParts[0] + '.' + commaParts.slice(1).join('');
  } else if (text.indexOf(',') >= 0 && text.indexOf('.') < 0) {
    text = text.replace(',', '.');
  } else if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
    const lastDot = text.lastIndexOf('.');
    const lastComma = text.lastIndexOf(',');
    const decimalIndex = Math.max(lastDot, lastComma);
    text = text.slice(0, decimalIndex).replace(/[.,]/g, '') + '.' + text.slice(decimalIndex + 1).replace(/[.,]/g, '');
  }
  const number = Number((negative ? '-' : '') + text);
  return isFinite(number) ? number : NaN;
}
function parseNumber_(value) {
  let text = String(value === undefined || value === null ? '' : value).trim().replace(/\s/g, '');
  if (!text) return 0;
  const commaIndex = text.lastIndexOf(',');
  const dotIndex = text.lastIndexOf('.');
  if (commaIndex >= 0 && dotIndex >= 0) {
    if (commaIndex > dotIndex) text = text.replace(/\./g, '').replace(',', '.');
    else text = text.replace(/,/g, '');
  } else if (commaIndex >= 0) {
    text = text.replace(',', '.');
  }
  const number = Number(text);
  return isFinite(number) ? number : 0;
}
function requireCoordinate_(value, label, min, max) {
  const number = parseCoordinate_(value);
  if (!isFinite(number) || number < min || number > max) throw new Error('Tọa độ ' + label + ' không hợp lệ. Hãy dùng dạng số thập phân, ví dụ 10.989025.');
  return number;
}
function validateImageData_(match) {
  const mimeType = String(match[1] || '').toLowerCase();
  const encoded = String(match[2] || '');
  if (mimeType.indexOf('image/') !== 0 || ['image/jpeg', 'image/png', 'image/webp'].indexOf(mimeType) < 0) throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  if (!encoded || encoded.length > 8 * 1024 * 1024) throw new Error('Ảnh sau khi nén không được lớn hơn 8 MB.');
}
function distanceMeters_(lat1, lon1, lat2, lon2) { const radius = 6371000; const toRadians = function(value) { return value * Math.PI / 180; }; const dLat = toRadians(lat2 - lat1); const dLon = toRadians(lon2 - lon1); const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); }
function audit_(action, entityId, details) { try { appendRow_('LOGS', { log_id: id_('LOG'), email: Session.getActiveUser().getEmail() || '', action: action, entity_id: entityId, created_at: now_(), details: JSON.stringify(redactForLog_(details)).slice(0, 45000) }); } catch (_) {} }
function redactForLog_(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(redactForLog_);
  const output = {};
  Object.keys(value).forEach(function(key) {
    const normalizedKey = String(key).toLowerCase();
    output[key] = normalizedKey.indexOf('password') >= 0 || normalizedKey.indexOf('session') >= 0 || normalizedKey.indexOf('token') >= 0 || normalizedKey.indexOf('data_url') >= 0 || normalizedKey.indexOf('authorization') >= 0 ? '[REDACTED]' : redactForLog_(value[key]);
  });
  return output;
}
function logError_(action, error) { try { audit_('ERROR_' + action, '', { error: safeMessage_(error) }); } catch (_) {} }
function safeMessage_(error) { return error && error.message ? error.message : String(error); }
function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }

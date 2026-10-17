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
    USERS: ['user_id', 'email', 'full_name', 'role', 'phone', 'active'],
    SHOPS: ['shop_id', 'shop_name', 'address', 'latitude', 'longitude', 'phone', 'contact_name', 'current_supplier', 'salesperson_id', 'status', 'notes', 'created_at', 'updated_at'],
    VISITS: ['visit_id', 'shop_id', 'salesperson_id', 'visit_date', 'latitude', 'longitude', 'captured_address', 'current_supplier', 'photo_file_id', 'photo_url', 'notes', 'created_at'],
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
  try {
    const action = (e && e.parameter && e.parameter.action) || 'getConfig';
    return jsonResponse({ success: true, data: route_(action, e.parameter || {}) });
  } catch (error) {
    logError_('GET', error);
    return jsonResponse({ success: false, error: safeMessage_(error) });
  }
}

function doPost(e) {
  try {
    const payload = parseBody_(e);
    const action = payload.action;
    if (!action) throw new Error('Thiếu action trong request.');
    const result = route_(action, payload);
    return jsonResponse({ success: true, data: result });
  } catch (error) {
    logError_('POST', error);
    return jsonResponse({ success: false, error: safeMessage_(error) });
  }
}

// Hàm công khai để chạy thủ công trong Apps Script Editor.
// Chỉ tạo các sheet và hàng tiêu đề, không tạo dữ liệu mẫu.
function initializeSchema() {
  return initializeSchema_();
}

function route_(action, payload) {
  ensureSchema_();
  authorize_(action, payload);
  switch (action) {
    case 'initializeSchema': return initializeSchema_();
    case 'getConfig': return getConfig_();
    case 'getUsers': return listRows_('USERS', payload);
    case 'getShops': return getShops_(payload);
    case 'getShopDetail': return getShopDetail_(payload);
    case 'createShop': return createShop_(payload);
    case 'updateShop': return updateRow_('SHOPS', payload, 'shop_id');
    case 'createVisit': return createVisit_(payload);
    case 'uploadVisitPhoto': return uploadVisitPhoto_(payload);
    case 'getOrders': return getOrders_(payload);
    case 'createOrder': return createOrder_(payload);
    case 'updateOrder': return updateRow_('ORDERS', payload, 'order_id');
    case 'confirmPayment': return confirmPayment_(payload);
    case 'getKpis': return listRows_('KPI_DEFINITIONS', payload);
    case 'getKpiTargets': return listRows_('KPI_TARGETS', payload);
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
  const bootstrapActions = ['initializeSchema', 'getConfig'];
  if (bootstrapActions.indexOf(action) >= 0) return { role: 'Admin', email: '' };
  const users = getRows_('USERS');
  if (!users.length) return { role: 'Admin', email: '' };
  const sessionEmail = String((payload && payload.user_email) || Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!sessionEmail) throw new Error('Không xác định được tài khoản. Hãy triển khai Apps Script trong Google Workspace hoặc gửi user_email từ lớp đăng nhập đã xác thực.');
  const user = users.filter(function(row) { return String(row.email || '').trim().toLowerCase() === sessionEmail && String(row.active) !== 'false'; })[0];
  if (!user) throw new Error('Tài khoản chưa được cấp quyền trong sheet USERS.');
  const role = String(user.role || '').toLowerCase();
  const adminActions = ['createShop', 'updateShop', 'createKpi', 'createKpiTarget', 'updateKpi', 'updateKpiTarget', 'getUsers', 'getConfig'];
  const accountantActions = ['confirmPayment'];
  const salesActions = ['createVisit', 'uploadVisitPhoto', 'createOrder', 'updateOrder'];
  if (adminActions.indexOf(action) >= 0 && role !== 'admin') throw new Error('Chỉ Admin được thực hiện thao tác này.');
  if (accountantActions.indexOf(action) >= 0 && role !== 'admin' && role !== 'accountant' && role !== 'kế toán') throw new Error('Chỉ Kế toán hoặc Admin được xác nhận thanh toán.');
  if (salesActions.indexOf(action) >= 0 && role !== 'admin' && role !== 'sales') throw new Error('Chỉ Sales hoặc Admin được thực hiện thao tác này.');
  return user;
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
  if (cache.get('SCHEMA_READY') === '1') return;
  initializeSchema_();
  cache.put('SCHEMA_READY', '1', 21600);
}

function getConfig_() {
  const rows = getRows_('CONFIG');
  const config = { spreadsheetId: APP.spreadsheetId, driveRootFolderId: APP.driveRootFolderId, timeZone: APP.timeZone };
  rows.forEach(function(row) { if (row.config_key) config[row.config_key] = row.config_value; });
  return config;
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
  return { shop: shop, visits: getRows_('VISITS').filter(function(row) { return row.shop_id === payload.shop_id; }), orders: getRows_('ORDERS').filter(function(row) { return row.shop_id === payload.shop_id; }), payments: getRows_('PAYMENTS').filter(function(row) { return row.shop_id === payload.shop_id; }) };
}

function createShop_(payload) {
  const row = normalize_(payload, APP.sheets.SHOPS);
  row.shop_id = row.shop_id || id_('SHOP');
  row.status = row.status || 'Đang hoạt động';
  row.created_at = now_();
  row.updated_at = now_();
  appendRow_('SHOPS', row);
  audit_('createShop', row.shop_id, row);
  return row;
}

function createVisit_(payload) {
  if (!payload.shop_id) throw new Error('Thiếu shop_id.');
  const row = normalize_(payload, APP.sheets.VISITS);
  row.visit_id = row.visit_id || id_('VISIT');
  row.visit_date = row.visit_date || date_();
  row.created_at = now_();
  appendRow_('VISITS', row);
  audit_('createVisit', row.visit_id, row);
  return row;
}

function uploadVisitPhoto_(payload) {
  if (!payload.data_url || !payload.visit_id) throw new Error('Thiếu ảnh hoặc mã visit.');
  const match = String(payload.data_url).match(/^data:(.*?);base64,(.*)$/);
  if (!match) throw new Error('Ảnh không đúng định dạng data URL.');
  const shop = getRows_('SHOPS').filter(function(row) { return row.shop_id === payload.shop_id; })[0];
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

function createOrder_(payload) {
  if (!payload.shop_id || !payload.product_type) throw new Error('Thiếu quán hoặc loại sản phẩm.');
  const quantity = Number(payload.quantity_kg || 0);
  if (quantity <= 0) throw new Error('Số lượng Kg phải lớn hơn 0.');
  const row = normalize_(payload, APP.sheets.ORDERS);
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
  const payments = getRows_('PAYMENTS').filter(function(payment) { return inDateRange_(payment.paid_date, payload); });
  const revenue = sum_(orders, 'total_amount');
  const paid = sum_(payments, 'amount');
  return { shopCount: shops.length, visitCount: visits.length, orderCount: orders.length, quantityKg: sum_(orders, 'quantity_kg'), revenue: revenue, paid: paid, debt: Math.max(0, revenue - paid), kpiCompletion: calculateKpiCompletion_(payload), series: buildSeries_(orders, visits, payload) };
}

function getReports_(payload) {
  return { dashboard: getDashboard_(payload), shops: getShops_(payload), orders: getOrders_(payload), visits: filterRows_(getRows_('VISITS'), payload), payments: getRows_('PAYMENTS').filter(function(row) { return inDateRange_(row.paid_date, payload); }), kpis: listRows_('KPI_DEFINITIONS', payload) };
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
function audit_(action, entityId, details) { try { appendRow_('LOGS', { log_id: id_('LOG'), email: Session.getActiveUser().getEmail() || '', action: action, entity_id: entityId, created_at: now_(), details: JSON.stringify(details).slice(0, 45000) }); } catch (_) {} }
function logError_(action, error) { try { audit_('ERROR_' + action, '', { error: safeMessage_(error) }); } catch (_) {} }
function safeMessage_(error) { return error && error.message ? error.message : String(error); }
function jsonResponse(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }

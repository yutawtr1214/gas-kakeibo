const SHEET_NAME = 'kakeibo';
const TIMEZONE = 'Asia/Tokyo';
const DATE_FORMAT = 'yyyy-MM-dd';

function doGet(e) {
  const params = e?.parameter || {};
  if (params.mode === 'list') return handleList(params);
  return buildError('invalid_mode');
}

function doPost(e) {
  const params = parsePostParameters(e);
  switch (params.mode) {
    case 'login':
      return handleLogin(params);
    case 'add':
      return withLock(() => handleAdd(params));
    case 'update':
      return withLock(() => handleUpdate(params));
    case 'delete':
      return withLock(() => handleDelete(params));
    case 'list':
      return handleList(params);
    default:
      return buildError('invalid_mode');
  }
}

function handleLogin(params) {
  const password = params.password || '';
  if (!password) return buildError('password_required');
  return verifyPassword(password) ? buildOk() : buildError('invalid_password');
}

function handleAdd(params) {
  if (!verifyToken(params)) return buildError('invalid_token');

  const { date, category, amount, payment_method, note } = params;
  if (!date || !category || amount === undefined) return buildError('missing_required');

  const amountNum = Number(amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) return buildError('invalid_amount');

  const sheet = getSheet();
  const id = Utilities.getUuid();
  const now = nowString();

  const row = [
    id,
    parseDate(date),
    category,
    amountNum,
    payment_method || '',
    note || '',
    now,
    now,
  ];

  sheet.appendRow(row);

  return buildOk({ id });
}

function handleList(params) {
  if (!verifyToken(params)) return buildError('invalid_token');

  const year = params.year ? Number(params.year) : null;
  const month = params.month ? Number(params.month) : null;
  if (!year || !month || month < 1 || month > 12) return buildError('invalid_period');

  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildOk({ items: [], summary: { total: 0, byCategory: {} } });

  const header = values[0];
  const rows = values.slice(1);

  const idx = indexMap(header);
  const items = [];
  const byCategory = {};
  let total = 0;

  rows.forEach((row) => {
    const rawDate = row[idx.date];
    const d = toDate(rawDate);
    if (!d) return;
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) return;

    const amount = Number(row[idx.amount]) || 0;
    total += amount;
    const category = row[idx.category] || '';
    byCategory[category] = (byCategory[category] || 0) + amount;

    items.push({
      id: row[idx.id],
      date: formatDate(d),
      category,
      amount,
      payment_method: row[idx.payment_method] || '',
      note: row[idx.note] || '',
    });
  });

  return buildOk({ items, summary: { total, byCategory } });
}

function handleUpdate(params) {
  if (!verifyToken(params)) return buildError('invalid_token');

  const { id, date, category, amount, payment_method, note } = params;
  if (!id) return buildError('missing_id');

  const amountNum = Number(amount);
  if (!date || !category || !Number.isFinite(amountNum) || amountNum <= 0) {
    return buildError('invalid_payload');
  }

  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildError('not_found');

  const header = values[0];
  const rows = values.slice(1);
  const idx = indexMap(header);

  const targetIndex = rows.findIndex((row) => row[idx.id] === id);
  if (targetIndex === -1) return buildError('not_found');

  const rowNumber = targetIndex + 2; // 1-based with header offset
  const now = nowString();

  const updatedRow = [
    id,
    parseDate(date),
    category,
    amountNum,
    payment_method || '',
    note || '',
    rows[targetIndex][idx.created_at] || '',
    now,
  ];

  sheet.getRange(rowNumber, 1, 1, updatedRow.length).setValues([updatedRow]);

  return buildOk();
}

function handleDelete(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const { id } = params;
  if (!id) return buildError('missing_id');

  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildError('not_found');

  const header = values[0];
  const rows = values.slice(1);
  const idx = indexMap(header);

  const targetIndex = rows.findIndex((row) => row[idx.id] === id);
  if (targetIndex === -1) return buildError('not_found');

  const rowNumber = targetIndex + 2; // header offset
  sheet.deleteRow(rowNumber);
  return buildOk();
}

function parsePostParameters(e) {
  if (!e || !e.postData) return e?.parameter || {};
  const raw = e.postData.contents;
  const contentType = e.postData.type || '';
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(raw);
    } catch (err) {
      return e.parameter || {};
    }
  }
  return e.parameter || {};
}

function verifyToken(params) {
  const token = params.token || params.password || '';
  if (!token) return false;
  return verifyPassword(token);
}

function verifyPassword(plain) {
  const stored = PropertiesService.getScriptProperties().getProperty('PASSWORD_HASH');
  if (!stored) return false;
  return hash(plain) === stored;
}

function hash(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text);
  return Utilities.base64Encode(digest);
}

function getSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + SHEET_NAME);
  return sheet;
}

function indexMap(header) {
  const map = {};
  header.forEach((name, i) => {
    map[name] = i;
  });
  return map;
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value) return parseDate(value);
  return null;
}

function parseDate(text) {
  const parts = text.split('-');
  if (parts.length !== 3) return new Date(text);
  const [y, m, d] = parts.map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(date) {
  return Utilities.formatDate(date, TIMEZONE, DATE_FORMAT);
}

function nowString() {
  return Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
}

function withLock(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return buildError('lock_timeout');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function buildOk(data) {
  return respond({ status: 'ok', data: data || null });
}

function buildError(message) {
  return respond({ status: 'error', message });
}

function respond(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

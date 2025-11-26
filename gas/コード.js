const SHEET_NAME = 'items';
const RECURRENT_SHEET_NAME = 'recurrents';
const TRANSFER_SHEET_NAME = 'transfers';
const SHARED_SPENDING_SHEET_NAME = 'shared_spending';
const TIMEZONE = 'Asia/Tokyo';
const DATE_FORMAT = 'yyyy-MM-dd';

const TYPE_INCOME = 'INCOME';
const TYPE_SHARED_SHOULD_PAY_BUT_PERSONAL_PAID = 'SHARED_SHOULD_PAY_BUT_PERSONAL_PAID';
const TYPE_PERSONAL_SHOULD_PAY_BUT_SHARED_PAID = 'PERSONAL_SHOULD_PAY_BUT_SHARED_PAID';
const TYPE_POCKET_MONEY = 'POCKET_MONEY';
const ALLOWED_TYPES = [
  TYPE_INCOME,
  TYPE_SHARED_SHOULD_PAY_BUT_PERSONAL_PAID,
  TYPE_PERSONAL_SHOULD_PAY_BUT_SHARED_PAID,
  TYPE_POCKET_MONEY,
];

function doGet(e) {
  const params = e?.parameter || {};
  if (params.mode === 'month_get') return handleList(params);
  if (params.mode === 'overview_get') return handleOverview(params);
  if (params.mode === 'recurrent_list') return handleRecurrentList(params);
  if (params.mode === 'transfer_list') return handleTransferList(params);
  if (params.mode === 'spending_get') return handleSpendingGet(params);
  return buildError('invalid_mode');
}

function doPost(e) {
  const params = parsePostParameters(e);
  switch (params.mode) {
    case 'login':
      return handleLogin(params);
    case 'item_add':
      return withLock(() => handleAdd(params));
    case 'item_delete':
      return withLock(() => handleDelete(params));
    case 'month_get':
      return handleList(params);
    case 'overview_get':
      return handleOverview(params);
    case 'recurrent_add':
      return withLock(() => handleRecurrentAdd(params));
    case 'recurrent_delete':
      return withLock(() => handleRecurrentDelete(params));
    case 'transfer_add':
      return withLock(() => handleTransferAdd(params));
    case 'transfer_delete':
      return withLock(() => handleTransferDelete(params));
    case 'spending_set':
      return withLock(() => handleSpendingSet(params));
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

  const { member_id, year, month, date, item_type, amount, note } = params;
  if (!member_id || !year || !month || !item_type || amount === undefined) return buildError('missing_required');

  const yearNum = Number(year);
  const monthNum = Number(month);
  const amountNum = Number(amount);

  if (!Number.isInteger(yearNum)) return buildError('invalid_year');
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) return buildError('invalid_month');
  if (!Number.isFinite(amountNum) || amountNum <= 0 || !Number.isInteger(amountNum)) return buildError('invalid_amount');
  if (!ALLOWED_TYPES.includes(item_type)) return buildError('invalid_type');

  const sheet = getSheet();
  const id = Utilities.getUuid();
  const now = nowString();
  const parsedDate = toDate(date);

  const row = [
    id,
    member_id,
    yearNum,
    monthNum,
    parsedDate ? parsedDate : (date || ''),
    item_type,
    amountNum,
    note || '',
    now,
    now,
  ];

  sheet.appendRow(row);

  const monthData = getMonthData(member_id, yearNum, monthNum);
  return buildOk(monthData);
}

function handleOverview(params) {
  if (!verifyToken(params)) return buildError('invalid_token');

  const member_id = params.member_id || '';
  const year = params.year ? Number(params.year) : NaN;
  const month = params.month ? Number(params.month) : NaN;

  if (!member_id) return buildError('missing_member');
  if (!Number.isInteger(year)) return buildError('invalid_year');
  if (!Number.isInteger(month) || month < 1 || month > 12) return buildError('invalid_month');

  ensureRecurrents(member_id, year, month);

  const base = getMonthData(member_id, year, month);
  const transfers = getTransfersByMonth(year, month);
  const transferItems = getTransferItemsByMonth(year, month);
  const sharedSpending = getSharedSpendingByMonth(year, month);

  const sharedBalance = transfers.total - sharedSpending.amount;
  const memberTransfer = transfers.by_member[member_id] || 0;
  const deltaVsRecommend = memberTransfer - base.summary.recommended_transfer;

  return buildOk({
    ...base,
    transfers,
    shared_spending: sharedSpending.amount,
    shared_balance: sharedBalance,
    delta_vs_recommend: deltaVsRecommend,
    transfer_items: transferItems,
  });
}

function handleList(params) {
  if (!verifyToken(params)) return buildError('invalid_token');

  const member_id = params.member_id || '';
  const year = params.year ? Number(params.year) : NaN;
  const month = params.month ? Number(params.month) : NaN;

  if (!member_id) return buildError('missing_member');
  if (!Number.isInteger(year)) return buildError('invalid_year');
  if (!Number.isInteger(month) || month < 1 || month > 12) return buildError('invalid_month');

  ensureRecurrents(member_id, year, month);

  const data = getMonthData(member_id, year, month);
  return buildOk(data);
}

function getMonthData(member_id, year, month) {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { items: [], summary: emptySummary() };

  const header = values[0];
  const rows = values.slice(1);

  const idx = normalizeIndex(header);
  const items = [];
  let incomeTotal = 0;
  let sharedFromPersonalTotal = 0;
  let personalFromSharedTotal = 0;
  let pocketTotal = 0;

  rows.forEach((row) => {
    if (!row[idx.member_id] || row[idx.member_id] !== member_id) return;
    const rowYear = Number(row[idx.year]);
    const rowMonth = Number(row[idx.month]);
    if (rowYear !== year || rowMonth !== month) return;

    const amount = Number(row[idx.amount]) || 0;
    const item_type = row[idx.item_type] || '';
    const rawDate = row[idx.date];
    const d = toDate(rawDate);

    switch (item_type) {
      case TYPE_INCOME:
        incomeTotal += amount;
        break;
      case TYPE_SHARED_SHOULD_PAY_BUT_PERSONAL_PAID:
        sharedFromPersonalTotal += amount;
        break;
      case TYPE_PERSONAL_SHOULD_PAY_BUT_SHARED_PAID:
        personalFromSharedTotal += amount;
        break;
      case TYPE_POCKET_MONEY:
        pocketTotal += amount;
        break;
      default:
        break;
    }

    items.push({
      id: row[idx.id],
      member_id: row[idx.member_id],
      year: rowYear,
      month: rowMonth,
      date: d ? formatDate(d) : (rawDate || '').toString(),
      item_type,
      amount,
      note: row[idx.note] || '',
    });
  });

  const recommendedTransfer =
    incomeTotal - pocketTotal + personalFromSharedTotal - sharedFromPersonalTotal;

  const summary = {
    income_total: incomeTotal,
    shared_from_personal_total: sharedFromPersonalTotal,
    personal_from_shared_total: personalFromSharedTotal,
    pocket_total: pocketTotal,
    recommended_transfer: recommendedTransfer,
  };

  return { items, summary };
}

function ensureRecurrents(member_id, year, month) {
  const itemSheet = getSheet();
  const recurrentSheet = getRecurrentSheet();
  const itemValues = itemSheet.getDataRange().getValues();
  const recurrentValues = recurrentSheet.getDataRange().getValues();

  if (recurrentValues.length <= 1) return;

  const itemHeader = itemValues[0] || [];
  const itemIdx = normalizeIndex(itemHeader);
  const existingIds = new Set(itemValues.slice(1).map((row) => row[itemIdx.id]));

  const recurHeader = recurrentValues[0];
  const recurIdx = normalizeRecurrentIndex(recurHeader);
  const now = nowString();

  const shouldAppend = [];

  recurrentValues.slice(1).forEach((row) => {
    if (!row[recurIdx.member_id] || row[recurIdx.member_id] !== member_id) return;

    const item_type = row[recurIdx.item_type];
    const amount = Number(row[recurIdx.amount]);
    if (!ALLOWED_TYPES.includes(item_type)) return;
    if (!Number.isInteger(amount) || amount <= 0) return;

    const startY = Number(row[recurIdx.start_y]);
    const startM = Number(row[recurIdx.start_m]);
    const endY = row[recurIdx.end_y] === '' || row[recurIdx.end_y] === undefined ? null : Number(row[recurIdx.end_y]);
    const endM = row[recurIdx.end_m] === '' || row[recurIdx.end_m] === undefined ? null : Number(row[recurIdx.end_m]);

    if (!Number.isInteger(startY) || !Number.isInteger(startM)) return;
    if (startM < 1 || startM > 12) return;
    if (endM !== null && (endM < 1 || endM > 12)) return;
    if (endY !== null && !Number.isInteger(endY)) return;

    if (!isWithinRange(year, month, startY, startM, endY, endM)) return;

    const baseId = row[recurIdx.id] || Utilities.getUuid();
    const recItemId = `rec_${baseId}_${year}_${month}`;
    if (existingIds.has(recItemId)) return;

    shouldAppend.push([
      recItemId,
      member_id,
      year,
      month,
      '', // date 任意
      item_type,
      amount,
      row[recurIdx.note] || '',
      now,
      now,
    ]);
  });

  if (shouldAppend.length > 0) {
    itemSheet.getRange(itemSheet.getLastRow() + 1, 1, shouldAppend.length, shouldAppend[0].length).setValues(shouldAppend);
  }
}

function isWithinRange(targetY, targetM, startY, startM, endY, endM) {
  const target = targetY * 12 + targetM;
  const start = startY * 12 + startM;
  const end = endY === null || endM === null ? Number.POSITIVE_INFINITY : endY * 12 + endM;
  return target >= start && target <= end;
}

function emptySummary() {
  return {
    income_total: 0,
    shared_from_personal_total: 0,
    personal_from_shared_total: 0,
    pocket_total: 0,
    recommended_transfer: 0,
  };
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
  const idx = normalizeIndex(header);

  const targetIndex = rows.findIndex((row) => row[idx.id] === id);
  if (targetIndex === -1) return buildError('not_found');

  const targetRow = rows[targetIndex];
  const member_id = targetRow[idx.member_id];
  const year = Number(targetRow[idx.year]);
  const month = Number(targetRow[idx.month]);

  const rowNumber = targetIndex + 2; // header offset
  sheet.deleteRow(rowNumber);

  const monthData = getMonthData(member_id, year, month);
  return buildOk(monthData);
}

function handleRecurrentList(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const member_id = params.member_id || '';
  if (!member_id) return buildError('missing_member');

  const sheet = getRecurrentSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildOk([]);

  const header = values[0];
  const idx = normalizeRecurrentIndex(header);

  const list = values.slice(1).filter((row) => row[idx.member_id] === member_id).map((row) => ({
    id: row[idx.id],
    member_id: row[idx.member_id],
    item_type: row[idx.item_type],
    amount: Number(row[idx.amount]) || 0,
    note: row[idx.note] || '',
    start_y: Number(row[idx.start_y]) || null,
    start_m: Number(row[idx.start_m]) || null,
    end_y: row[idx.end_y] === '' ? null : Number(row[idx.end_y]),
    end_m: row[idx.end_m] === '' ? null : Number(row[idx.end_m]),
  }));

  return buildOk(list);
}

function handleTransferList(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const member_id = params.member_id || '';
  const year = params.year ? Number(params.year) : NaN;
  const month = params.month ? Number(params.month) : NaN;

  if (!member_id) return buildError('missing_member');
  if (!Number.isInteger(year)) return buildError('invalid_year');
  if (!Number.isInteger(month) || month < 1 || month > 12) return buildError('invalid_month');

  const transfers = getTransferSheet().getDataRange().getValues();
  if (transfers.length <= 1) return buildOk([]);

  const header = transfers[0];
  const idx = normalizeTransferIndex(header);
  const list = transfers
    .slice(1)
    .filter((row) => row[idx.member_id] === member_id && Number(row[idx.year]) === year && Number(row[idx.month]) === month)
    .map((row) => ({
      id: row[idx.id],
      member_id: row[idx.member_id],
      year: Number(row[idx.year]),
      month: Number(row[idx.month]),
      amount: Number(row[idx.amount]) || 0,
      note: row[idx.note] || '',
    }));

  return buildOk(list);
}

function handleTransferAdd(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const { member_id, year, month, amount, note } = params;
  if (!member_id || year === undefined || month === undefined || amount === undefined) {
    return buildError('missing_required');
  }

  const yearNum = Number(year);
  const monthNum = Number(month);
  const amountNum = Number(amount);

  if (!Number.isInteger(yearNum)) return buildError('invalid_year');
  if (!Number.isInteger(monthNum) || monthNum < 1 || monthNum > 12) return buildError('invalid_month');
  if (!Number.isInteger(amountNum) || amountNum <= 0) return buildError('invalid_amount');

  const sheet = getTransferSheet();
  const now = nowString();
  const values = sheet.getDataRange().getValues();
  const header = values[0] || [];
  const idx = normalizeTransferIndex(header);

  // 既存レコードを探して上書き
  if (values.length > 1) {
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (
        row[idx.member_id] === member_id &&
        Number(row[idx.year]) === yearNum &&
        Number(row[idx.month]) === monthNum
      ) {
        sheet.getRange(i + 1, idx.amount + 1).setValue(amountNum);
        sheet.getRange(i + 1, idx.note + 1).setValue(note || '');
        sheet.getRange(i + 1, idx.updated_at + 1).setValue(now);
        return handleTransferList({ ...params, member_id, year: yearNum, month: monthNum });
      }
    }
  }

  // 見つからなければ新規追加
  const id = Utilities.getUuid();
  const newRow = [id, member_id, yearNum, monthNum, amountNum, note || '', now, now];
  sheet.appendRow(newRow);
  return handleTransferList({ ...params, member_id, year: yearNum, month: monthNum });
}

function handleTransferDelete(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const { id, member_id, year, month } = params;
  if (!id) return buildError('missing_id');

  const sheet = getTransferSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildError('not_found');

  const header = values[0];
  const rows = values.slice(1);
  const idx = normalizeTransferIndex(header);

  const targetIndex = rows.findIndex((row) => row[idx.id] === id);
  if (targetIndex === -1) return buildError('not_found');

  const rowNumber = targetIndex + 2;
  sheet.deleteRow(rowNumber);

  const y = year !== undefined ? Number(year) : Number(rows[targetIndex][idx.year]);
  const m = month !== undefined ? Number(month) : Number(rows[targetIndex][idx.month]);
  const member = member_id || rows[targetIndex][idx.member_id] || '';

  return handleTransferList({ ...params, member_id: member, year: y, month: m });
}

function handleSpendingGet(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const year = params.year ? Number(params.year) : NaN;
  const month = params.month ? Number(params.month) : NaN;
  if (!Number.isInteger(year)) return buildError('invalid_year');
  if (!Number.isInteger(month) || month < 1 || month > 12) return buildError('invalid_month');
  const spending = getSharedSpendingByMonth(year, month);
  return buildOk(spending);
}

function handleSpendingSet(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const year = params.year ? Number(params.year) : NaN;
  const month = params.month ? Number(params.month) : NaN;
  const amount = params.amount !== undefined ? Number(params.amount) : NaN;
  const note = params.note || '';

  if (!Number.isInteger(year)) return buildError('invalid_year');
  if (!Number.isInteger(month) || month < 1 || month > 12) return buildError('invalid_month');
  if (!Number.isInteger(amount) || amount < 0) return buildError('invalid_amount'); // 0も許容

  const sheet = getSharedSpendingSheet();
  const values = sheet.getDataRange().getValues();
  const now = nowString();
  const header = values[0] || [];
  const idx = normalizeSharedSpendingIndex(header);

  let updated = false;
  if (values.length > 1) {
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (Number(row[idx.year]) === year && Number(row[idx.month]) === month) {
        sheet.getRange(i + 1, idx.amount + 1).setValue(amount);
        sheet.getRange(i + 1, idx.note + 1).setValue(note);
        sheet.getRange(i + 1, idx.updated_at + 1).setValue(now);
        updated = true;
        break;
      }
    }
  }

  if (!updated) {
    const id = Utilities.getUuid();
    const row = [id, year, month, amount, note, now, now];
    sheet.appendRow(row);
  }

  return handleSpendingGet({ ...params, year, month });
}

function handleRecurrentAdd(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const { member_id, item_type, amount, note, start_y, start_m, end_y, end_m } = params;
  if (!member_id || !item_type || amount === undefined || !start_y || !start_m) {
    return buildError('missing_required');
  }

  const amountNum = Number(amount);
  const startYNum = Number(start_y);
  const startMNum = Number(start_m);
  const endYNum = end_y === undefined || end_y === '' ? null : Number(end_y);
  const endMNum = end_m === undefined || end_m === '' ? null : Number(end_m);

  if (!ALLOWED_TYPES.includes(item_type)) return buildError('invalid_type');
  if (!Number.isInteger(amountNum) || amountNum <= 0) return buildError('invalid_amount');
  if (!Number.isInteger(startYNum)) return buildError('invalid_start_year');
  if (!Number.isInteger(startMNum) || startMNum < 1 || startMNum > 12) return buildError('invalid_start_month');
  if (endMNum !== null && (!Number.isInteger(endMNum) || endMNum < 1 || endMNum > 12)) return buildError('invalid_end_month');
  if (endYNum !== null && !Number.isInteger(endYNum)) return buildError('invalid_end_year');

  const sheet = getRecurrentSheet();
  const id = Utilities.getUuid();
  const now = nowString();

  const row = [
    id,
    member_id,
    item_type,
    amountNum,
    note || '',
    startYNum,
    startMNum,
    endYNum,
    endMNum,
    now,
    now,
  ];

  sheet.appendRow(row);
  return handleRecurrentList({ ...params, member_id });
}

function handleRecurrentDelete(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const { id, member_id } = params;
  if (!id) return buildError('missing_id');

  const sheet = getRecurrentSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildError('not_found');

  const header = values[0];
  const rows = values.slice(1);
  const idx = normalizeRecurrentIndex(header);

  const targetIndex = rows.findIndex((row) => row[idx.id] === id);
  if (targetIndex === -1) return buildError('not_found');

  const rowNumber = targetIndex + 2;
  sheet.deleteRow(rowNumber);

  const member = member_id || rows[targetIndex][idx.member_id] || '';
  return handleRecurrentList({ ...params, member_id: member });
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

function getRecurrentSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RECURRENT_SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + RECURRENT_SHEET_NAME);
  return sheet;
}

function getTransferSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRANSFER_SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + TRANSFER_SHEET_NAME);
  return sheet;
}

function getSharedSpendingSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHARED_SPENDING_SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + SHARED_SPENDING_SHEET_NAME);
  return sheet;
}

function normalizeIndex(header) {
  const expected = [
    'id',
    'member_id',
    'year',
    'month',
    'date',
    'item_type',
    'amount',
    'note',
    'created_at',
    'updated_at',
  ];

  const map = {};
  header.forEach((name, i) => {
    const key = (name || '').toString().trim().toLowerCase();
    if (key) map[key] = i;
  });

  const idx = {};
  expected.forEach((key, defaultPos) => {
    idx[key] = map[key] !== undefined ? map[key] : defaultPos; // フォールバックで列順を利用
  });
  return idx;
}

function normalizeRecurrentIndex(header) {
  const expected = [
    'id',
    'member_id',
    'item_type',
    'amount',
    'note',
    'start_y',
    'start_m',
    'end_y',
    'end_m',
    'created_at',
    'updated_at',
  ];

  const map = {};
  header.forEach((name, i) => {
    const key = (name || '').toString().trim().toLowerCase();
    if (key) map[key] = i;
  });

  const idx = {};
  expected.forEach((key, defaultPos) => {
    const alt = key === 'start_y' ? 'state_y' : key;
    const hit = map[key] !== undefined ? map[key] : map[alt];
    idx[key] = hit !== undefined ? hit : defaultPos;
  });
  return idx;
}

function normalizeTransferIndex(header) {
  const expected = ['id', 'member_id', 'year', 'month', 'amount', 'note', 'created_at', 'updated_at'];
  const map = {};
  header.forEach((name, i) => {
    const key = (name || '').toString().trim().toLowerCase();
    if (key) map[key] = i;
  });
  const idx = {};
  expected.forEach((key, defaultPos) => {
    idx[key] = map[key] !== undefined ? map[key] : defaultPos;
  });
  return idx;
}

function normalizeSharedSpendingIndex(header) {
  const expected = ['id', 'year', 'month', 'amount', 'note', 'created_at', 'updated_at'];
  const map = {};
  header.forEach((name, i) => {
    const key = (name || '').toString().trim().toLowerCase();
    if (key) map[key] = i;
  });
  const idx = {};
  expected.forEach((key, defaultPos) => {
    idx[key] = map[key] !== undefined ? map[key] : defaultPos;
  });
  return idx;
}

function toDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value) return parseDate(value);
  return null;
}

function parseDate(text) {
  if (typeof text !== 'string') return null;
  // YYYY-MM-DD または YYYY/MM/DD 形式を抽出
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (match) {
    const [_, y, m, d] = match.map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(text);
  return isNaN(d.getTime()) ? null : d;
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

function getTransfersByMonth(year, month) {
  const sheet = getTransferSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { by_member: {}, total: 0 };

  const header = values[0];
  const idx = normalizeTransferIndex(header);
  const byMember = {};
  let total = 0;

  values.slice(1).forEach((row) => {
    if (Number(row[idx.year]) !== year || Number(row[idx.month]) !== month) return;
    const mId = row[idx.member_id];
    const amount = Number(row[idx.amount]) || 0;
    byMember[mId] = (byMember[mId] || 0) + amount;
    total += amount;
  });

  return { by_member: byMember, total };
}

function getTransferItemsByMonth(year, month) {
  const sheet = getTransferSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  const header = values[0];
  const idx = normalizeTransferIndex(header);

  return values.slice(1).filter((row) => Number(row[idx.year]) === year && Number(row[idx.month]) === month).map((row) => ({
    id: row[idx.id],
    member_id: row[idx.member_id],
    year: Number(row[idx.year]),
    month: Number(row[idx.month]),
    amount: Number(row[idx.amount]) || 0,
    note: row[idx.note] || '',
  }));
}

function getSharedSpendingByMonth(year, month) {
  const sheet = getSharedSpendingSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return { amount: 0, note: '' };

  const header = values[0];
  const idx = normalizeSharedSpendingIndex(header);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (Number(row[idx.year]) === year && Number(row[idx.month]) === month) {
      return { amount: Number(row[idx.amount]) || 0, note: row[idx.note] || '' };
    }
  }
  return { amount: 0, note: '' };
}

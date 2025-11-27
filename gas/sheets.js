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

function getSettingsSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS_SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + SETTINGS_SHEET_NAME);
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

function normalizeSettingsIndex(header) {
  const expected = ['husband_name', 'wife_name', 'updated_at'];
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

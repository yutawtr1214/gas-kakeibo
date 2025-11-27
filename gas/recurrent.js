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

function handleRecurrentUpdate(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const { id } = params;
  if (!id) return buildError('missing_id');

  const sheet = getRecurrentSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildError('not_found');

  const header = values[0];
  const rows = values.slice(1);
  const idx = normalizeRecurrentIndex(header);

  const targetIndex = rows.findIndex((row) => row[idx.id] === id);
  if (targetIndex === -1) return buildError('not_found');

  const rowNumber = targetIndex + 2; // header offset
  const row = rows[targetIndex];

  const startYNum = params.start_y === undefined ? Number(row[idx.start_y]) : Number(params.start_y);
  const startMNum = params.start_m === undefined ? Number(row[idx.start_m]) : Number(params.start_m);
  const endYNum = params.end_y === undefined || params.end_y === '' ? null : Number(params.end_y);
  const endMNum = params.end_m === undefined || params.end_m === '' ? null : Number(params.end_m);

  if (!Number.isInteger(startYNum)) return buildError('invalid_start_year');
  if (!Number.isInteger(startMNum) || startMNum < 1 || startMNum > 12) return buildError('invalid_start_month');
  if (endMNum !== null && (!Number.isInteger(endMNum) || endMNum < 1 || endMNum > 12)) return buildError('invalid_end_month');
  if (endYNum !== null && !Number.isInteger(endYNum)) return buildError('invalid_end_year');

  if (endYNum !== null && endMNum === null) return buildError('invalid_end_month');
  if (endMNum !== null && endYNum === null) return buildError('invalid_end_year');

  if (endYNum !== null) {
    const now = new Date();
    const jstNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
    const currentYM = jstNow.getFullYear() * 12 + (jstNow.getMonth() + 1);
    const endYM = endYNum * 12 + endMNum;
    if (endYM < currentYM) return buildError('end_before_current');
  }

  if (endYNum !== null) {
    const startYM = startYNum * 12 + startMNum;
    const endYM = endYNum * 12 + endMNum;
    if (endYM < startYM) return buildError('range_inconsistent');
  }

  const nowStr = nowString();
  // amount/item_type は変更不可のため既存を保持
  const newRow = [
    row[idx.id],
    row[idx.member_id],
    row[idx.item_type],
    row[idx.amount],
    row[idx.note],
    startYNum,
    startMNum,
    endYNum,
    endMNum,
    row[idx.created_at],
    nowStr,
  ];

  sheet.getRange(rowNumber, 1, 1, newRow.length).setValues([newRow]);

  const member = row[idx.member_id];
  return handleRecurrentList({ ...params, member_id: member });
}

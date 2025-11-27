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
  // 複数リクエストでの重複挿入を防ぐためロックを取得
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return;
  try {
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
  } finally {
    lock.releaseLock();
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

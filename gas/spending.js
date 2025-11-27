function handleSpendingGet(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const year = params.year ? Number(params.year) : NaN;
  const month = params.month ? Number(params.month) : NaN;
  if (!Number.isInteger(year)) return buildError('invalid_year');
  if (!Number.isInteger(month) || month < 1 || month > 12) return buildError('invalid_month');
  const spending = getSharedSpendingByMonth(year, month);
  return buildOk(spending);
}

function handleSpendingHistory(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const sheet = getSharedSpendingSheet();
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return buildOk([]);
  const header = values[0];
  const idx = normalizeSharedSpendingIndex(header);
  const list = values.slice(1).map((row) => ({
    id: row[idx.id],
    year: Number(row[idx.year]) || 0,
    month: Number(row[idx.month]) || 0,
    amount: Number(row[idx.amount]) || 0,
    note: row[idx.note] || '',
  }));
  list.sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
  return buildOk(list);
}

function handleBalanceHistory(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const transferSheet = getTransferSheet();
  const spendingSheet = getSharedSpendingSheet();

  const transferValues = transferSheet.getDataRange().getValues();
  const spendingValues = spendingSheet.getDataRange().getValues();

  const map = {};

  if (transferValues.length > 1) {
    const header = transferValues[0];
    const idx = normalizeTransferIndex(header);
    transferValues.slice(1).forEach((row) => {
      const y = Number(row[idx.year]) || 0;
      const m = Number(row[idx.month]) || 0;
      const key = `${y}-${m}`;
      if (!map[key]) map[key] = { year: y, month: m, transfers: 0, spending: 0 };
      map[key].transfers += Number(row[idx.amount]) || 0;
    });
  }

  if (spendingValues.length > 1) {
    const header = spendingValues[0];
    const idx = normalizeSharedSpendingIndex(header);
    spendingValues.slice(1).forEach((row) => {
      const y = Number(row[idx.year]) || 0;
      const m = Number(row[idx.month]) || 0;
      const key = `${y}-${m}`;
      if (!map[key]) map[key] = { year: y, month: m, transfers: 0, spending: 0 };
      map[key].spending += Number(row[idx.amount]) || 0;
    });
  }

  const list = Object.values(map).map((v) => ({
    year: v.year,
    month: v.month,
    transfers: v.transfers,
    spending: v.spending,
    balance: v.transfers - v.spending,
  }));

  list.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
  return buildOk(list);
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
        sheet
          .getRange(i + 1, idx.amount + 1, 1, 4)
          .setValues([[amount, note, row[idx.created_at] || '', now]]);
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

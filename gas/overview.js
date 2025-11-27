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

  return buildOk({
    ...base,
    transfers,
    shared_spending: sharedSpending.amount,
    shared_balance: sharedBalance,
    transfer_items: transferItems,
  });
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

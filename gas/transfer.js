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
        sheet
          .getRange(i + 1, idx.amount + 1, 1, 4)
          .setValues([[amountNum, note || '', row[idx.created_at] || '', now]]);
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

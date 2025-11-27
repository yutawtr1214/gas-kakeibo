function doGet(e) {
  const params = e?.parameter || {};
  if (params.mode === 'month_get') return handleList(params);
  if (params.mode === 'overview_get') return handleOverview(params);
  if (params.mode === 'recurrent_list') return handleRecurrentList(params);
  if (params.mode === 'transfer_list') return handleTransferList(params);
  if (params.mode === 'spending_get') return handleSpendingGet(params);
  if (params.mode === 'spending_history') return handleSpendingHistory(params); // 互換のため残すが balance_history を推奨
  if (params.mode === 'balance_history') return handleBalanceHistory(params);
  if (params.mode === 'settings_get') return handleSettingsGet(params);
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
    case 'recurrent_update':
      return withLock(() => handleRecurrentUpdate(params));
    case 'transfer_add':
      return withLock(() => handleTransferAdd(params));
    case 'transfer_delete':
      return withLock(() => handleTransferDelete(params));
    case 'spending_set':
      return withLock(() => handleSpendingSet(params));
    case 'spending_history':
      return handleSpendingHistory(params);
    case 'balance_history':
      return handleBalanceHistory(params);
    case 'settings_set':
      return withLock(() => handleSettingsSet(params));
    default:
      return buildError('invalid_mode');
  }
}

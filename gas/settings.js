function handleSettingsGet(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  try {
    const sheet = getSettingsSheet();
    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) {
      return buildOk(defaultSettings());
    }
    const header = values[0];
    const idx = normalizeSettingsIndex(header);
    // settings シートは1行想定。最後の行を最新として扱う。
    const row = values[values.length - 1];
    return buildOk(normalizeSettingsRow(row, idx));
  } catch (err) {
    return buildOk(defaultSettings());
  }
}

function handleSettingsSet(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const { husband_name, wife_name } = params;
  const maxLen = 5;

  const h = typeof husband_name === 'string' ? husband_name.trim() : '';
  const w = typeof wife_name === 'string' ? wife_name.trim() : '';

  if (h.length > maxLen || w.length > maxLen) return buildError('invalid_length');

  const sheet = getSettingsSheet();
  const now = nowString();

  // header を保証
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['husband_name', 'wife_name', 'updated_at']);
  }

  const row = [h, w, now];
  sheet.appendRow(row);

  return buildOk(normalizeSettingsRow(row, normalizeSettingsIndex(sheet.getRange(1, 1, 1, 3).getValues()[0])));
}

function normalizeSettingsRow(row, idx) {
  const def = defaultSettings();
  const h = row[idx.husband_name] || '';
  const w = row[idx.wife_name] || '';
  return {
    husband_name: h || def.husband_name,
    wife_name: w || def.wife_name,
    updated_at: row[idx.updated_at] || def.updated_at,
  };
}

function defaultSettings() {
  return {
    husband_name: '夫',
    wife_name: '妻',
    updated_at: '',
  };
}

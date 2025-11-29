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
  // Apps Script の TextOutput では setHeader は利用できない。
  // CORS ヘッダーを付与しようとして runtime エラーが出ると全 API が失敗するため、
  // 元のシンプルなレスポンスに戻す。
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

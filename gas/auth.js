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

function handleLogin(params) {
  const password = params.password || '';
  if (!password) return buildError('password_required');
  return verifyPassword(password) ? buildOk() : buildError('invalid_password');
}

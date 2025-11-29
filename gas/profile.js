const PROFILE_IMAGE_FOLDER_ID_KEY = 'PROFILE_IMAGE_FOLDER_ID';
const PROFILE_IMAGE_FOLDER_NAME = 'kakeibo_profile_images';
const MAX_IMAGE_BYTES = 500 * 1024; // 500KB

function handleProfileImageUpload(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const member = params.member_id;
  if (member !== 'husband' && member !== 'wife') return buildError('invalid_member');

  const dataUrl = params.data_url || '';
  const prevId = params.prev_file_id || '';

  // data URL 形式: data:image/png;base64,XXXXX
  const dataUrlPattern = /^data:(image\/[-+.\w]+);base64,(.+)$/;
  const match = dataUrl.match(dataUrlPattern);
  if (!match) return buildError('invalid_data');
  const mime = match[1];
  const base64 = match[2];

  const bytes = Utilities.base64Decode(base64);
  if (bytes.length > MAX_IMAGE_BYTES) return buildError('file_too_large');

  const blob = Utilities.newBlob(bytes, mime, `profile_${member}_${Date.now()}`);
  const folder = ensureProfileImageFolder();
  const file = folder.createFile(blob);

  if (prevId) {
    try {
      DriveApp.getFileById(prevId).setTrashed(true);
    } catch (err) {
      // 存在しない/権限なしは無視
    }
  }

  return buildOk({ file_id: file.getId(), updated_at: nowString() });
}

function handleProfileImageGet(params) {
  if (!verifyToken(params)) return buildError('invalid_token');
  const fileId = params.file_id || '';
  if (!fileId) return buildError('file_required');
  try {
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();
    const bytes = blob.getBytes();
    if (bytes.length > MAX_IMAGE_BYTES) return buildError('file_too_large');
    const base64 = Utilities.base64Encode(bytes);
    const mime = blob.getContentType() || 'image/png';
    return buildOk({ data_url: `data:${mime};base64,${base64}` });
  } catch (err) {
    return buildError('not_found');
  }
}

function ensureProfileImageFolder() {
  const props = PropertiesService.getScriptProperties();
  const storedId = props.getProperty(PROFILE_IMAGE_FOLDER_ID_KEY);
  if (storedId) {
    try {
      return DriveApp.getFolderById(storedId);
    } catch (err) {
      // フォルダが消えている場合は再作成
    }
  }
  const folder = DriveApp.createFolder(PROFILE_IMAGE_FOLDER_NAME);
  props.setProperty(PROFILE_IMAGE_FOLDER_ID_KEY, folder.getId());
  return folder;
}

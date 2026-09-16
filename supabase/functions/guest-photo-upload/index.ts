import { assertAllowedClientRequest, getSupabaseAdmin } from '../_shared/guestbook.ts';
import { json, methodNotAllowed, okOptions } from '../_shared/http.ts';

const MAX_FILES = 10;
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const THUMBNAIL_BUCKET = 'wedding-guest-thumbnails';

async function accessToken(refreshToken: string) {
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId || '', client_secret: clientSecret || '', refresh_token: refreshToken, grant_type: 'refresh_token' }) });
  const body = await response.json();
  if (!response.ok || !body.access_token) throw new Error(body.error_description || 'Google Drive 인증을 갱신하지 못했습니다.');
  return body.access_token as string;
}

async function uploadToDrive(file: File, token: string, folderId: string) {
  const boundary = `guest-photo-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: file.name || `guest-${Date.now()}.jpg`, parents: [folderId] });
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`, file, `\r\n--${boundary}--`]);
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
  const result = await response.json();
  if (!response.ok || !result.id) throw new Error(result.error?.message || '원본 사진을 Google Drive에 저장하지 못했습니다.');
  return result.id as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return okOptions();
  if (req.method !== 'POST') return methodNotAllowed();
  try {
    assertAllowedClientRequest(req);
    const form = await req.formData();
    const siteKey = String(form.get('site_key') || '').trim();
    if (!['ksy_kwk_wed', 'kwk_ksy_wed'].includes(siteKey)) throw new Error('유효하지 않은 청첩장입니다.');
    const files = form.getAll('photos').filter((value): value is File => value instanceof File);
    const thumbs = form.getAll('thumbnails').filter((value): value is File => value instanceof File);
    if (!files.length || files.length > MAX_FILES) throw new Error(`사진은 한 번에 최대 ${MAX_FILES}장까지 올릴 수 있습니다.`);
    if (thumbs.length !== files.length) throw new Error('사진 미리보기 생성에 실패했습니다. 다시 시도해주세요.');
    files.forEach((file) => { if (!IMAGE_TYPES.has(file.type) || file.size > MAX_ORIGINAL_BYTES) throw new Error('JPG, PNG, WebP 사진만 장당 25MB 이하로 올릴 수 있습니다.'); });
    thumbs.forEach((file) => { if (file.type !== 'image/jpeg' || file.size > MAX_THUMBNAIL_BYTES) throw new Error('사진 미리보기 형식이 올바르지 않습니다.'); });
    const supabase = getSupabaseAdmin();
    const { data: settings, error: settingsError } = await supabase.from('wedding_guest_photo_settings').select('google_drive_folder_id, uploads_enabled, auto_publish').eq('site_key', siteKey).single();
    if (settingsError || !settings?.uploads_enabled) throw new Error('사진 업로드는 아직 열려 있지 않습니다.');
    const { data: connection } = await supabase.from('wedding_google_drive_connections').select('refresh_token').eq('connection_key', 'primary').single();
    if (!connection?.refresh_token) throw new Error('Google Drive 연결을 먼저 완료해주세요.');
    const token = await accessToken(connection.refresh_token);
    const rows = [];
    for (let index = 0; index < files.length; index += 1) {
      const id = crypto.randomUUID();
      const thumbnailPath = `${siteKey}/${id}.jpg`;
      const driveFileId = await uploadToDrive(files[index], token, settings.google_drive_folder_id);
      const { error: thumbnailError } = await supabase.storage.from(THUMBNAIL_BUCKET).upload(thumbnailPath, thumbs[index], { contentType: 'image/jpeg', upsert: false });
      if (thumbnailError) throw new Error(thumbnailError.message);
      rows.push({ id, site_key: siteKey, thumbnail_path: thumbnailPath, drive_file_id: driveFileId, status: settings.auto_publish ? 'published' : 'pending' });
    }
    const { error: insertError } = await supabase.from('wedding_guest_photos').insert(rows);
    if (insertError) throw new Error(insertError.message);
    return json({ success: true, count: rows.length }, { status: 201 });
  } catch (error) { return json({ success: false, error: error instanceof Error ? error.message : '사진 업로드에 실패했습니다.' }, { status: 400 }); }
});

import { supabaseClient } from '../scripts/supabaseClient.js';

const GALLERY_BUCKET = 'wedding-gallery';
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const state = { contacts: [], accounts: [], gallery: [], rsvps: [] };
const els = {
  loginView: document.getElementById('login-view'), adminView: document.getElementById('admin-view'),
  loginForm: document.getElementById('login-form'), loginId: document.getElementById('login-id'),
  loginPassword: document.getElementById('login-password'), loginStatus: document.getElementById('login-status'),
  adminStatus: document.getElementById('admin-status'), contacts: document.getElementById('contacts-list'),
  accounts: document.getElementById('accounts-list'), gallery: document.getElementById('gallery-list'),
  rsvpSummary: document.getElementById('rsvp-summary'), rsvpList: document.getElementById('rsvp-list'),
  uploadForm: document.getElementById('gallery-upload-form'), uploadFile: document.getElementById('gallery-file'),
  uploadAlt: document.getElementById('gallery-alt'), logout: document.getElementById('logout-button'),
  toast: document.getElementById('admin-toast')
};

function setStatus(message = '', login = false) { (login ? els.loginStatus : els.adminStatus).textContent = message; }
function field(label, name, value, type = 'text', wide = false) {
  const wrap = document.createElement('label');
  if (wide) wrap.className = 'wide';
  wrap.textContent = label;
  const input = document.createElement('input');
  input.name = name; input.type = type; input.value = value ?? '';
  wrap.append(input); return wrap;
}
function checkboxField(label, name, checked) {
  const wrap = document.createElement('label');
  wrap.className = 'visibility-field';
  const input = document.createElement('input');
  input.name = name; input.type = 'checkbox'; input.checked = Boolean(checked);
  wrap.append(input, document.createTextNode(label));
  return wrap;
}
function button(text, className = '') { const el = document.createElement('button'); el.type = 'submit'; el.textContent = text; el.className = className; return el; }
function formValue(form, name) { return new FormData(form).get(name)?.toString().trim() || ''; }
function previewUrl(imageUrl) { return imageUrl.startsWith('./assets/') ? `../${imageUrl.slice(2)}` : imageUrl; }
function resolveLoginEmail(value) {
  const normalized = value.trim().toLowerCase();
  return normalized.includes('@') ? normalized : '';
}
function getFileExtension(file) { return file.name.split('.').pop()?.trim().toLowerCase() || ''; }
function isMovFile(file) { return getFileExtension(file) === 'mov' || file.type === 'video/quicktime'; }
function isSupportedImage(file) {
  return SUPPORTED_IMAGE_EXTENSIONS.has(getFileExtension(file))
    && ['image/jpeg', 'image/png', 'image/webp', ''].includes(file.type);
}
async function decodeImage(file) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { return createImageBitmap(file); }
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = reject;
      element.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
async function createJpegVariant(file, maxEdge, quality = 0.84) {
  const image = await decodeImage(file);
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext('2d', { alpha: false }).drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('이미지 변환에 실패했습니다.');
  return blob;
}
function notify(message, type = 'success') {
  setStatus(message);
  if (els.toast) {
    els.toast.textContent = message;
    els.toast.dataset.type = type;
    els.toast.classList.add('is-visible');
  }
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => {
    setStatus('');
    els.toast?.classList.remove('is-visible');
  }, 4200);
}

function renderContacts() {
  els.contacts.replaceChildren();
  state.contacts.forEach((row) => {
    const form = document.createElement('form'); form.className = 'editor-card';
    const head = document.createElement('div'); head.className = 'editor-card-head';
    const title = document.createElement('strong'); title.textContent = `${row.side === 'groom' ? '신랑측' : '신부측'} · ${row.role_label}`;
    const hint = document.createElement('span'); hint.textContent = `순서 ${row.display_order}`; head.append(title, hint);
    const fields = document.createElement('div'); fields.className = 'editor-fields';
    fields.append(field('이름', 'name', row.name), field('휴대전화', 'phone', row.phone));
    form.append(head, fields);
    const actions = document.createElement('div'); actions.className = 'editor-actions'; actions.append(button('저장'));
    form.append(actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); setStatus('연락처를 저장하는 중입니다.');
      const { error } = await supabaseClient.from('wedding_contacts').update({ name: formValue(form, 'name'), phone: formValue(form, 'phone') }).eq('id', row.id);
      if (error) return notify(`연락처 저장에 실패했습니다: ${error.message}`, 'error');
      await loadData();
      notify('연락처를 저장했습니다.');
    });
    els.contacts.append(form);
  });
}

function renderAccounts() {
  els.accounts.replaceChildren();
  state.accounts.forEach((row) => {
    const form = document.createElement('form'); form.className = 'editor-card';
    const head = document.createElement('div'); head.className = 'editor-card-head';
    const title = document.createElement('strong'); title.textContent = `${row.side === 'groom' ? '신랑측' : '신부측'} · ${row.side_label}`;
    const hint = document.createElement('span'); hint.textContent = `순서 ${row.display_order}`; head.append(title, hint);
    const fields = document.createElement('div'); fields.className = 'editor-fields';
    fields.append(field('은행명', 'bank_name', row.bank_name), field('예금주', 'account_holder', row.account_holder), field('계좌번호', 'account_number', row.account_number, 'text', true));
    form.append(head, fields);
    const actions = document.createElement('div'); actions.className = 'editor-actions'; actions.append(button('저장'));
    form.append(actions);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); setStatus('계좌 정보를 저장하는 중입니다.');
      const bankName = formValue(form, 'bank_name');
      const { error } = await supabaseClient.from('wedding_accounts').update({ bank_name: bankName, account_holder: formValue(form, 'account_holder'), account_number: formValue(form, 'account_number') }).eq('id', row.id);
      if (error) return notify(`계좌 정보 저장에 실패했습니다: ${error.message}`, 'error');
      await loadData();
      notify(bankName ? '계좌 정보를 저장했습니다.' : '은행명을 비워 저장했습니다. 청첩장에서는 이 계좌가 숨겨집니다.');
    });
    els.accounts.append(form);
  });
}

function renderRsvps() {
  if (!els.rsvpSummary || !els.rsvpList) return;
  const attending = state.rsvps.filter((row) => row.attendance === 'attending');
  const declined = state.rsvps.filter((row) => row.attendance === 'declined');
  const guestTotal = attending.reduce((sum, row) => sum + Number(row.guest_count || 0), 0);
  els.rsvpSummary.innerHTML = [
    ['참석', `${attending.length}건`],
    ['불참', `${declined.length}건`],
    ['예상 인원', `${guestTotal}명`]
  ].map(([label, value]) => `<div class="rsvp-summary-item"><span>${label}</span><strong>${value}</strong></div>`).join('');
  els.rsvpList.replaceChildren();
  if (!state.rsvps.length) {
    els.rsvpList.textContent = '아직 응답이 없습니다.';
    return;
  }
  state.rsvps.forEach((row) => {
    const item = document.createElement('article'); item.className = 'rsvp-row';
    const response = row.attendance === 'attending' ? `참석 · ${row.guest_count}명` : '불참';
    const status = document.createElement('span'); status.className = `rsvp-row-status ${row.attendance === 'declined' ? 'declined' : ''}`; status.textContent = response;
    const copy = document.createElement('div'); copy.className = 'rsvp-row-copy';
    const name = document.createElement('strong'); name.textContent = row.guest_name || '이름 미입력';
    const message = document.createElement('span'); message.textContent = row.message || '전달 사항 없음'; copy.append(name, message);
    const time = document.createElement('time'); time.textContent = new Date(row.updated_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    item.append(status, copy, time); els.rsvpList.append(item);
  });
}

function renderGallery() {
  els.gallery.replaceChildren();
  state.gallery.forEach((row) => {
    const form = document.createElement('form'); form.className = 'gallery-editor-card';
    const image = document.createElement('img'); image.src = previewUrl(row.thumbnail_url || row.image_url); image.alt = row.alt;
    const fields = document.createElement('div'); fields.className = 'editor-fields';
    fields.append(field('설명', 'alt', row.alt), field('순서', 'display_order', row.display_order, 'number'), checkboxField('청첩장에 표시', 'is_visible', row.is_visible));
    const remove = button('삭제', 'danger'); remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm('이 사진을 갤러리에서 삭제할까요?')) return;
      setStatus('사진을 삭제하는 중입니다.');
      const paths = [row.storage_path, row.thumbnail_storage_path].filter(Boolean);
      if (paths.length) await supabaseClient.storage.from(GALLERY_BUCKET).remove(paths);
      const { error } = await supabaseClient.from('wedding_gallery').delete().eq('id', row.id);
      if (error) return notify(`사진 삭제에 실패했습니다: ${error.message}`, 'error');
      await loadData();
      notify('사진을 삭제했습니다.');
    });
    form.append(image, fields, remove);
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); setStatus('사진 정보를 저장하는 중입니다.');
      const { error } = await supabaseClient.from('wedding_gallery').update({
        alt: formValue(form, 'alt'),
        display_order: Number(formValue(form, 'display_order')) || 0,
        is_visible: form.elements.is_visible.checked
      }).eq('id', row.id);
      if (error) return notify(`사진 정보 저장에 실패했습니다: ${error.message}`, 'error');
      await loadData();
      notify('사진 정보를 저장했습니다.');
    });
    els.gallery.append(form);
  });
}

async function loadData() {
  setStatus('관리 정보를 불러오는 중입니다.');
  const [contacts, accounts, gallery, rsvps] = await Promise.all([
    supabaseClient.from('wedding_contacts').select('id, side, contact_type, role_label, name, phone, display_order, is_visible').order('display_order'),
    supabaseClient.from('wedding_accounts').select('id, side, side_label, bank_name, account_holder, account_number, display_order, is_visible').order('display_order'),
    supabaseClient.from('wedding_gallery').select('*').order('display_order'),
    supabaseClient.from('wedding_rsvps').select('attendance, guest_count, guest_name, message, updated_at').order('updated_at', { ascending: false })
  ]);
  const error = contacts.error || accounts.error || gallery.error || rsvps.error;
  if (error) return setStatus(`관리 정보를 불러오지 못했습니다: ${error.message}`);
  state.contacts = contacts.data || []; state.accounts = accounts.data || []; state.gallery = gallery.data || []; state.rsvps = rsvps.data || [];
  renderContacts(); renderAccounts(); renderRsvps(); renderGallery(); setStatus('');
}

async function showForSession(session) {
  if (!session) { els.loginView.hidden = false; els.adminView.hidden = true; return; }
  const { data, error } = await supabaseClient.from('wedding_admins').select('user_id').eq('user_id', session.user.id).maybeSingle();
  if (error || !data) {
    await supabaseClient.auth.signOut();
    els.loginView.hidden = false; els.adminView.hidden = true;
    setStatus('관리자 권한이 없는 계정입니다.', true); return;
  }
  els.loginView.hidden = true; els.adminView.hidden = false; await loadData();
}

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = resolveLoginEmail(els.loginId.value);
  if (!email) return setStatus('Supabase에 등록한 이메일을 입력해주세요.', true);
  setStatus('로그인하는 중입니다.', true);
  const { error } = await supabaseClient.auth.signInWithPassword({ email, password: els.loginPassword.value });
  if (error) setStatus('아이디 또는 비밀번호를 확인해주세요.', true);
});
els.logout.addEventListener('click', () => supabaseClient.auth.signOut());
els.uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const selectedFiles = Array.from(els.uploadFile.files || []);
  if (!selectedFiles.length) return;

  const movFiles = selectedFiles.filter(isMovFile);
  const imageFiles = selectedFiles.filter(isSupportedImage);
  const unsupportedFiles = selectedFiles.filter((file) => !isMovFile(file) && !isSupportedImage(file));

  if (!imageFiles.length) {
    return notify(movFiles.length
      ? 'MOV 동영상은 갤러리 사진으로 표시할 수 없습니다. JPG·PNG·WebP로 변환 후 업로드해주세요.'
      : 'JPG·PNG·WebP 사진 파일만 업로드할 수 있습니다.');
  }

  const uploadedRows = [];
  const failedFiles = [];
  const baseOrder = Math.max(0, ...state.gallery.map((item) => item.display_order || 0));
  const alt = els.uploadAlt.value.trim() || '웨딩 사진';

  for (const [index, file] of imageFiles.entries()) {
    const imageId = crypto.randomUUID();
    const displayPath = `display/${imageId}.jpg`;
    const thumbnailPath = `thumb/${imageId}.jpg`;
    setStatus(`사진 변환·업로드 중… ${index + 1} / ${imageFiles.length}`);
    try {
      const [displayBlob, thumbnailBlob] = await Promise.all([
        createJpegVariant(file, 2560, 0.86),
        createJpegVariant(file, 640, 0.78)
      ]);
      const [displayUpload, thumbnailUpload] = await Promise.all([
        supabaseClient.storage.from(GALLERY_BUCKET).upload(displayPath, displayBlob, { contentType: 'image/jpeg', upsert: false }),
        supabaseClient.storage.from(GALLERY_BUCKET).upload(thumbnailPath, thumbnailBlob, { contentType: 'image/jpeg', upsert: false })
      ]);
      if (displayUpload.error || thumbnailUpload.error) {
        await supabaseClient.storage.from(GALLERY_BUCKET).remove([displayPath, thumbnailPath]);
        throw new Error(displayUpload.error?.message || thumbnailUpload.error?.message || 'Storage 업로드에 실패했습니다.');
      }
      const storage = supabaseClient.storage.from(GALLERY_BUCKET);
      const displayUrl = storage.getPublicUrl(displayPath).data.publicUrl;
      const thumbnailUrl = storage.getPublicUrl(thumbnailPath).data.publicUrl;
      uploadedRows.push({
        image_url: displayUrl,
        thumbnail_url: thumbnailUrl,
        storage_path: displayPath,
        thumbnail_storage_path: thumbnailPath,
        source_type: 'storage',
        alt: imageFiles.length > 1 ? `${alt} ${index + 1}` : alt,
        display_order: baseOrder + (index + 1) * 10,
        is_visible: true
      });
    } catch (error) {
      failedFiles.push(file.name);
      console.error('[admin] gallery upload failed', error);
    }
  }

  if (uploadedRows.length) {
    const { error } = await supabaseClient.from('wedding_gallery').insert(uploadedRows);
    if (error) {
      await supabaseClient.storage.from(GALLERY_BUCKET).remove(uploadedRows.flatMap((row) => [row.storage_path, row.thumbnail_storage_path]));
      return setStatus(`사진 목록 저장에 실패했습니다: ${error.message}`);
    }
  }

  els.uploadForm.reset();
  els.uploadAlt.value = '웨딩 사진';
  await loadData();

  const skipped = [
    movFiles.length ? `MOV ${movFiles.length}개` : '',
    unsupportedFiles.length ? `지원하지 않는 파일 ${unsupportedFiles.length}개` : '',
    failedFiles.length ? `업로드 실패 ${failedFiles.length}개` : ''
  ].filter(Boolean);
  notify(uploadedRows.length
    ? `${uploadedRows.length}장 업로드를 완료했습니다.${skipped.length ? ` (${skipped.join(', ')} 제외)` : ''}`
    : `업로드된 사진이 없습니다. ${skipped.join(', ')}`);
});

if (!supabaseClient) setStatus('Supabase 설정을 찾을 수 없습니다.', true);
else {
  supabaseClient.auth.onAuthStateChange((_event, session) => { showForSession(session); });
  supabaseClient.auth.getSession().then(({ data }) => showForSession(data.session));
}

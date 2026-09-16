import { APP_CONFIG } from '../config.js';

const form = document.getElementById('upload-form');
const input = document.getElementById('photos');
const previews = document.getElementById('previews');
const label = document.getElementById('file-label');
const submit = document.getElementById('submit');
const status = document.getElementById('status');
const resumeKey = `wedding-guest-upload:${APP_CONFIG.siteKey}`;
let uploading = false;

const selected = () => Array.from(input.files || []);
const fingerprint = (file) => `${file.name}:${file.size}:${file.lastModified}`;
const loadProgress = () => { try { return JSON.parse(localStorage.getItem(resumeKey) || 'null'); } catch { return null; } };
const saveProgress = (value) => localStorage.setItem(resumeKey, JSON.stringify(value));
const clearProgress = () => localStorage.removeItem(resumeKey);

function setStatus(message, percent = null, loading = false) {
  status.replaceChildren();
  const text = document.createElement('span');
  text.textContent = message;
  status.append(text);
  if (percent !== null) {
    const meter = document.createElement('span');
    meter.className = 'upload-meter';
    const fill = document.createElement('span');
    fill.style.width = `${Math.max(2, Math.min(100, percent))}%`;
    meter.append(fill);
    const value = document.createElement('strong');
    value.textContent = `${Math.round(percent)}%`;
    status.append(meter, value);
  }
  status.classList.toggle('is-loading', loading);
}

async function thumbnail(file) {
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, 640 / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', .78));
}

function uploadOne(data, onProgress) {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open('POST', `${APP_CONFIG.supabaseUrl}/functions/v1/guest-photo-upload`);
    request.setRequestHeader('apikey', APP_CONFIG.supabasePublishableKey);
    request.setRequestHeader('Authorization', `Bearer ${APP_CONFIG.supabasePublishableKey}`);
    request.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(event.loaded / event.total); };
    request.onerror = () => reject(new Error('네트워크 연결이 끊겼습니다. 다시 접속해 남은 사진을 올려주세요.'));
    request.onload = () => {
      let result = {};
      try { result = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status < 200 || request.status >= 300) reject(new Error(result.error || '업로드에 실패했습니다.'));
      else resolve(result);
    };
    request.send(data);
  });
}

function renderSelection() {
  const files = selected();
  if (files.length > 10) {
    setStatus('사진은 한 번에 최대 10장까지 선택할 수 있어요.');
    input.value = '';
    previews.replaceChildren();
    submit.disabled = true;
    return;
  }
  const prior = loadProgress();
  const done = new Set(prior?.completed || []);
  const remaining = files.filter((file) => !done.has(fingerprint(file)));
  label.textContent = files.length ? `${remaining.length}장 업로드 예정` : '사진을 선택해주세요 · 최대 10장';
  previews.replaceChildren(...files.map((file) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => URL.revokeObjectURL(img.src);
    return img;
  }));
  submit.disabled = !remaining.length;
  if (prior?.completed?.length) setStatus(`${prior.completed.length}장은 이미 올라갔어요. 남은 사진만 이어서 올립니다.`);
  else setStatus('');
}

input.addEventListener('change', renderSelection);

window.addEventListener('beforeunload', (event) => {
  if (!uploading) return;
  event.preventDefault();
  event.returnValue = '';
});

const prior = loadProgress();
if (prior?.completed?.length) {
  setStatus(`${prior.completed.length}장은 이미 올라갔어요. 사진을 다시 선택하면 남은 사진만 이어서 올릴 수 있어요.`);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const files = selected();
  if (!files.length || files.length > 10 || uploading) return;
  const previous = loadProgress();
  const completed = new Set(previous?.completed || []);
  const pending = files.filter((file) => !completed.has(fingerprint(file)));
  if (!pending.length) { setStatus('선택한 사진은 모두 이미 업로드되었습니다.'); return; }
  uploading = true;
  submit.disabled = true;
  saveProgress({ completed: [...completed] });
  try {
    for (let index = 0; index < pending.length; index += 1) {
      const file = pending[index];
      const base = (index / pending.length) * 100;
      const span = 100 / pending.length;
      setStatus(`사진 ${index + 1} / ${pending.length} 준비 중…`, base, true);
      const thumb = await thumbnail(file);
      if (!thumb) throw new Error('미리보기 생성에 실패했습니다.');
      const data = new FormData();
      data.append('site_key', APP_CONFIG.siteKey);
      data.append('photos', file);
      data.append('thumbnails', new File([thumb], 'thumbnail.jpg', { type: 'image/jpeg' }));
      setStatus(`사진 ${index + 1} / ${pending.length} 업로드 중…`, base, true);
      await uploadOne(data, (ratio) => setStatus(`사진 ${index + 1} / ${pending.length} 업로드 중…`, base + span * ratio, true));
      completed.add(fingerprint(file));
      saveProgress({ completed: [...completed] });
      setStatus(`사진 ${index + 1} / ${pending.length} 업로드 완료`, base + span, true);
    }
    clearProgress();
    setStatus(`${pending.length}장 업로드를 완료했습니다. 감사합니다!`, 100);
    setTimeout(() => {
      if (document.body.dataset.uploadModal === 'true') window.dispatchEvent(new CustomEvent('guest-photo-uploaded'));
      else location.replace('../moments/');
    }, 900);
  } catch (error) {
    setStatus(`${error.message || '업로드에 실패했습니다.'} 완료된 사진은 저장되어 있습니다. 다시 선택하면 이어서 올릴 수 있어요.`);
  } finally {
    uploading = false;
    submit.disabled = !selected().filter((file) => !completed.has(fingerprint(file))).length;
  }
});

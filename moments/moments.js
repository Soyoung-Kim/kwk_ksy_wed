import { APP_CONFIG } from '../config.js';

const stage = document.querySelector('#stage');
const count = document.querySelector('#count');
const empty = document.querySelector('#empty');
const sheet = document.querySelector('#upload-sheet');
const openButton = document.querySelector('#open-upload');
const closeButtons = [document.querySelector('#close-upload'), document.querySelector('#close-upload-button')];
const url = `${APP_CONFIG.supabaseUrl}/rest/v1/wedding_guest_photos?site_key=eq.${APP_CONFIG.siteKey}&status=eq.published&select=id,thumbnail_path,created_at&order=created_at.desc&limit=80`;

const shuffle = (items) => items.sort(() => Math.random() - .5);

async function load() {
  try {
    const response = await fetch(url, { headers: { apikey: APP_CONFIG.supabasePublishableKey } });
    if (!response.ok) throw new Error();
    const photos = shuffle(await response.json()).slice(0, 20);
    stage.replaceChildren(...photos.map((photo) => {
      const element = document.createElement('article');
      element.className = 'photo';
      const size = 92 + Math.random() * 86;
      element.style.cssText = `width:${size}px;height:${size}px;left:${Math.random() * 82 + 2}%;top:${15 + Math.random() * 62}%;--r:${-12 + Math.random() * 24}deg;--d:${5 + Math.random() * 6}s;--delay:${-Math.random() * 7}s;--x:${-16 + Math.random() * 32}px;--y:${-20 + Math.random() * 40}px`;
      const image = new Image();
      image.loading = 'lazy';
      image.src = `${APP_CONFIG.supabaseUrl}/storage/v1/object/public/wedding-guest-thumbnails/${photo.thumbnail_path}`;
      image.alt = '하객이 남긴 오늘의 사진';
      element.append(image);
      return element;
    }));
    empty.hidden = photos.length > 0;
    count.textContent = photos.length ? `오늘 ${photos.length}장의 순간이 함께하고 있어요` : '사진을 기다리고 있어요';
  } catch {
    count.textContent = '사진을 불러오지 못했습니다.';
  }
}

function setSheet(open) {
  sheet.classList.toggle('is-open', open);
  sheet.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('sheet-open', open);
  if (open) history.replaceState(null, '', '?upload=1');
  else history.replaceState(null, '', location.pathname);
}

openButton.addEventListener('click', () => setSheet(true));
closeButtons.forEach((button) => button.addEventListener('click', () => setSheet(false)));
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') setSheet(false); });
window.addEventListener('guest-photo-uploaded', async () => { setSheet(false); await load(); });

if (new URLSearchParams(location.search).has('upload')) setSheet(true);
load();
setInterval(load, 15000);

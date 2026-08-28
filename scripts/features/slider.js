import { qs, escapeHtml } from '../utils.js';
import { supabaseClient } from '../supabaseClient.js';

const sliderState = {
  photos: [],
  allPhotos: [],
  currentSlide: 0,
  slideTimer: null,
  touchStartX: 0,
  isAnimating: false,
  queuedDirection: 0,
  isVisible: false,
  allPreloaded: false,
  usesManagedPhotos: false
};
let galleryPhotosUpdatedListener = null;

export async function initSlider() {
  const data = await loadLocalPhotos();
  sliderState.allPhotos = data;
  sliderState.photos = data;
  renderSlider();
  bindSliderControls();
  startSliderTimer();

  // Supabase 목록은 첫 화면을 막지 않고 뒤에서 받아 교체합니다.
  loadManagedPhotos().then((managedPhotos) => {
    if (!managedPhotos?.length) return;
    sliderState.allPhotos = managedPhotos;
    sliderState.photos = managedPhotos;
    sliderState.currentSlide = 0;
    sliderState.allPreloaded = false;
    sliderState.usesManagedPhotos = true;
    renderSlider();
    restartSliderTimer();
    galleryPhotosUpdatedListener?.(sliderState.allPhotos);
  }).catch(() => { /* Local photos remain available as a safe fallback. */ });
}

function fileNumber(photo) {
  const match = String(photo?.src || '').match(/\/(\d+)\.[a-z]+(?:\?.*)?$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function loadLocalPhotos() {
  const response = await fetch('./assets/photos.json', { cache: 'force-cache' });
  if (!response.ok) throw new Error('photos.json 파일을 불러오지 못했습니다.');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('photos.json 형식이 올바르지 않습니다.');
  // 로컬 원본·표시본을 요청하지 않고, 가장 작은 썸네일만 공개 화면에 사용합니다.
  return data
    .map((photo) => ({ ...photo, src: photo.thumb || photo.src }))
    .sort((left, right) => fileNumber(left) - fileNumber(right));
}

async function loadManagedPhotos() {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from('wedding_gallery')
    .select('image_url, thumbnail_url, alt')
    .eq('is_visible', true)
    .order('display_order');

  if (error) return null;
  return Array.isArray(data) ? data
    // 원본만 있는 기존 행은 공개 갤러리에 넣지 않습니다.
    .filter((photo) => typeof photo.thumbnail_url === 'string' && photo.thumbnail_url.trim())
    .map((photo) => ({
      src: photo.thumbnail_url,
      thumb: photo.thumbnail_url,
      alt: photo.alt
    })) : [];
}

function normalizedIndex(index) {
  const total = sliderState.photos.length;
  return total ? (index + total) % total : 0;
}

function photoSource(photo) {
  return photo?.thumb || photo?.src || '';
}

function setSliderLoading(visible) {
  const slider = qs('#photo-slider');
  if (!slider) return;
  let loadingEl = qs('#slider-loading', slider);
  if (!loadingEl) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'slider-loading';
    loadingEl.className = 'slider-loading';
    loadingEl.setAttribute('role', 'status');
    loadingEl.innerHTML = '<span aria-hidden="true"></span>사진을 준비하고 있어요';
    slider.appendChild(loadingEl);
  }
  loadingEl.hidden = !visible;
}

function watchInitialSlideImage(image) {
  if (!image) return;
  if (image.complete) {
    setSliderLoading(false);
    return;
  }
  setSliderLoading(true);
  image.addEventListener('load', () => setSliderLoading(false), { once: true });
  image.addEventListener('error', () => setSliderLoading(false), { once: true });
}

function renderSlider() {
  const slidesEl = qs('#slides');
  if (!slidesEl || !sliderState.photos.length) return;

  const photo = sliderState.photos[sliderState.currentSlide];
  const src = photoSource(photo);
  slidesEl.innerHTML = `
    <div class="fade-stage">
      <img class="slide-image is-active" src="${escapeHtml(src)}" alt="${escapeHtml(photo.alt || `웨딩 사진 ${sliderState.currentSlide + 1}`)}" loading="eager" fetchpriority="high" decoding="async" />
      <img class="slide-image" alt="" aria-hidden="true" decoding="async" />
    </div>
  `;
  watchInitialSlideImage(slidesEl.querySelector('.slide-image.is-active'));
  updateCount();
  preloadAdjacentPhotos();
}

function updateCount() {
  const count = qs('#slide-dots');
  if (count) count.innerHTML = `<span class="slider-count" aria-live="polite">${sliderState.currentSlide + 1} / ${sliderState.photos.length}</span>`;
}

function preloadAdjacentPhotos() {
  if (sliderState.photos.length < 2) return;
  [-1, 1].forEach((offset) => {
    const source = photoSource(sliderState.photos[normalizedIndex(sliderState.currentSlide + offset)]);
    if (!source) return;
    const image = new Image();
    image.src = source;
  });
}

function preloadAllPhotos() {
  if (sliderState.allPreloaded || sliderState.photos.length < 2) return;
  sliderState.allPreloaded = true;
  const sources = [...new Set(sliderState.photos.map(photoSource).filter(Boolean))];
  const preload = () => sources.forEach((source) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
  });

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 1600 });
  } else {
    window.setTimeout(preload, 300);
  }
}

function moveSlide(direction) {
  if (sliderState.photos.length < 2) return;
  if (sliderState.isAnimating) {
    sliderState.queuedDirection = direction;
    return;
  }
  const slidesEl = qs('#slides');
  const activeImage = slidesEl?.querySelector('.slide-image.is-active');
  const incomingImage = slidesEl?.querySelector('.slide-image:not(.is-active)');
  if (!activeImage || !incomingImage) return;

  sliderState.isAnimating = true;
  const nextIndex = normalizedIndex(sliderState.currentSlide + direction);
  const nextPhoto = sliderState.photos[nextIndex];
  // 버튼을 누르는 순간 숫자와 다음 목적지를 먼저 반영합니다.
  sliderState.currentSlide = nextIndex;
  updateCount();
  const stage = slidesEl.querySelector('.fade-stage');
  const reveal = () => {
    if (!sliderState.isAnimating) return;
    incomingImage.removeAttribute('aria-hidden');
    activeImage.setAttribute('aria-hidden', 'true');
    stage?.classList.toggle('is-next', direction > 0);
    stage?.classList.toggle('is-prev', direction < 0);
    // 시작 위치를 한 프레임 확정해 좌우 이동 전환을 보장합니다.
    void incomingImage.offsetWidth;
    incomingImage.classList.add('is-active');
    activeImage.classList.remove('is-active');
    setSliderLoading(false);
    window.setTimeout(() => {
      sliderState.isAnimating = false;
      stage?.classList.remove('is-next', 'is-prev');
      preloadAdjacentPhotos();
      const queuedDirection = sliderState.queuedDirection;
      sliderState.queuedDirection = 0;
      if (queuedDirection) moveSlide(queuedDirection);
    }, 280);
  };

  incomingImage.alt = nextPhoto.alt || `웨딩 사진 ${nextIndex + 1}`;
  incomingImage.src = photoSource(nextPhoto);
  if (incomingImage.complete) {
    window.requestAnimationFrame(reveal);
  } else {
    incomingImage.addEventListener('load', reveal, { once: true });
    incomingImage.addEventListener('error', reveal, { once: true });
  }
}

function nextSlide() {
  moveSlide(1);
}

function prevSlide() {
  moveSlide(-1);
}

function startSliderTimer() {
  stopSliderTimer();
  if (sliderState.isVisible && sliderState.photos.length > 1) sliderState.slideTimer = window.setInterval(nextSlide, 4200);
}

function stopSliderTimer() {
  if (sliderState.slideTimer) window.clearInterval(sliderState.slideTimer);
  sliderState.slideTimer = null;
}

function restartSliderTimer() {
  stopSliderTimer();
  startSliderTimer();
}

function bindSliderControls() {
  const prevBtn = qs('#slide-prev');
  const nextBtn = qs('#slide-next');
  const slider = qs('#photo-slider');
  prevBtn?.addEventListener('click', () => { prevSlide(); restartSliderTimer(); });
  nextBtn?.addEventListener('click', () => { nextSlide(); restartSliderTimer(); });
  if (!slider) return;

  slider.addEventListener('mouseenter', stopSliderTimer);
  slider.addEventListener('mouseleave', startSliderTimer);
  slider.addEventListener('touchstart', (event) => {
    sliderState.touchStartX = event.changedTouches[0].clientX;
    stopSliderTimer();
  }, { passive: true });
  slider.addEventListener('touchend', (event) => {
    const diff = event.changedTouches[0].clientX - sliderState.touchStartX;
    if (Math.abs(diff) >= 36) {
      if (diff < 0) nextSlide(); else prevSlide();
    }
    restartSliderTimer();
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      sliderState.isVisible = Boolean(entries[0]?.isIntersecting);
      if (sliderState.isVisible) {
        startSliderTimer();
        preloadAllPhotos();
      } else {
        stopSliderTimer();
      }
    }, { threshold: 0.2 });
    observer.observe(slider);
  } else {
    sliderState.isVisible = true;
    preloadAllPhotos();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopSliderTimer(); else startSliderTimer();
  });
}

export function getGalleryPhotos() {
  return sliderState.allPhotos || [];
}

export function onGalleryPhotosUpdated(listener) {
  galleryPhotosUpdatedListener = listener;
  if (sliderState.usesManagedPhotos) galleryPhotosUpdatedListener(sliderState.allPhotos);
}

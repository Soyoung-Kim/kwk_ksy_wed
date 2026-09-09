import { qs, escapeHtml } from '../utils.js';
import { supabaseClient } from '../supabaseClient.js';
import { APP_CONFIG } from '../../config.js';

const sliderState = {
  photos: [],
  allPhotos: [],
  currentSlide: 0,
  slideTimer: null,
  touchStartX: 0,
  isAnimating: false,
  queuedDirection: 0,
  isVisible: false,
  usesManagedPhotos: false
};
let galleryPhotosUpdatedListener = null;

export async function initSlider() {
  const [data, gallerySettings] = await Promise.all([loadLocalPhotos(), loadGallerySettings()]);
  const orderedLocalPhotos = applyGalleryOrder(data, gallerySettings.order);
  sliderState.allPhotos = orderedLocalPhotos;
  sliderState.photos = orderedLocalPhotos;
  renderSlider();
  bindSliderControls();
  startSliderTimer();

  // Storage 사진은 관리자에서 사용을 켠 경우에만 로컬 사진을 대체합니다.
  if (!gallerySettings.storageEnabled) return;
  loadManagedPhotos().then((managedPhotos) => {
    if (!managedPhotos?.length) return;
    const orderedManagedPhotos = applyGalleryOrder(managedPhotos, gallerySettings.order);
    sliderState.allPhotos = orderedManagedPhotos;
    sliderState.photos = orderedManagedPhotos;
    sliderState.currentSlide = 0;
    sliderState.usesManagedPhotos = true;
    renderSlider();
    restartSliderTimer();
    galleryPhotosUpdatedListener?.(sliderState.allPhotos);
  }).catch(() => { /* Local photos remain available as a safe fallback. */ });
}

async function loadLocalPhotos() {
  // 사진 목록은 매우 작고 자주 바뀔 수 있으므로, 방문할 때마다 최신본을 확인합니다.
  // 이미지 파일 자체는 브라우저 캐시를 계속 활용합니다.
  const response = await fetch('./assets/photos.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('photos.json 파일을 불러오지 못했습니다.');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('photos.json 형식이 올바르지 않습니다.');
  // 슬라이더·팝업은 원본 대신 고화질 display 파일을 사용합니다.
  // 모바일 화면에서는 충분히 선명하면서 원본보다 훨씬 빠릅니다.
  return data;
}

function getPhotoOrderKey(photo) {
  return String(photo?.orderKey || photo?.src || '');
}

function applyGalleryOrder(photos, configuredOrder) {
  if (!Array.isArray(configuredOrder) || !configuredOrder.length) return photos;
  const priorities = new Map(configuredOrder.map((key, index) => [String(key), index]));
  return photos
    .map((photo, index) => ({ photo, index }))
    .sort((left, right) => {
      const leftOrder = priorities.get(getPhotoOrderKey(left.photo));
      const rightOrder = priorities.get(getPhotoOrderKey(right.photo));
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER) || left.index - right.index;
    })
    .map(({ photo }) => photo);
}

async function loadGallerySettings() {
  const defaults = { storageEnabled: false, order: [] };
  if (!supabaseClient || !APP_CONFIG?.siteKey) return defaults;
  const { data, error } = await supabaseClient
    .from('wedding_site_settings')
    .select('gallery_storage_enabled, gallery_order')
    .eq('site_key', APP_CONFIG.siteKey)
    .maybeSingle();
  if (error || !data) return defaults;
  return {
    storageEnabled: data.gallery_storage_enabled === true,
    order: Array.isArray(data.gallery_order) ? data.gallery_order : []
  };
}

async function loadManagedPhotos() {
  if (!supabaseClient) return null;

  const { data, error } = await supabaseClient
    .from('wedding_gallery')
    .select('id, image_url, thumbnail_url, alt, source_type')
    .eq('is_visible', true)
    .order('display_order');

  if (error) return null;
  return Array.isArray(data) ? data
    // 원본만 있는 기존 행과 로컬 asset 중복 행은 공개 갤러리에 넣지 않습니다.
    .filter((photo) => photo.source_type === 'storage')
    .filter((photo) => typeof photo.thumbnail_url === 'string' && photo.thumbnail_url.trim())
    .map((photo) => ({
      src: photo.thumbnail_url,
      thumb: photo.thumbnail_url,
      alt: photo.alt,
      orderKey: String(photo.id)
    })) : [];
}

function normalizedIndex(index) {
  const total = sliderState.photos.length;
  return total ? (index + total) % total : 0;
}

function photoSource(photo) {
  return photo?.original || photo?.src || photo?.thumb || '';
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
      } else {
        stopSliderTimer();
      }
    }, { threshold: 0.2 });
    observer.observe(slider);
  } else {
    sliderState.isVisible = true;
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

import { qs, escapeHtml } from '../utils.js';

const INITIAL_VISIBLE_COUNT = 6;
let galleryLoadingShowTimer = null;
let galleryLoadingSafetyTimer = null;
let galleryLoadingJob = 0;

const galleryState = {
  photos: [],
  visibleCount: INITIAL_VISIBLE_COUNT,
  bound: false,
  lightboxIndex: 0,
  lightboxTouchStartX: 0
};

function normalizePhotos(photos) {
  if (!Array.isArray(photos)) return [];

  return photos
    .filter((photo) => photo && typeof photo.src === 'string' && photo.src.trim())
    .map((photo, index) => ({
      // 확대·저장을 제한한 청첩장에서는 큰 원본을 다시 받지 않습니다.
      src: photo.original || photo.src,
      thumb: photo.thumb || photo.src,
      alt: photo.alt || `웨딩 사진 ${index + 1}`
    }));
}

function ensureGalleryUi() {
  const galleryEl = qs('#gallery');
  if (!galleryEl) return null;

  const sectionEl = galleryEl.closest('.section') || galleryEl.parentElement;
  const titleEl = sectionEl?.querySelector('.section-header h2');

  let countEl = qs('#gallery-count', sectionEl || document);
  if (!countEl && titleEl) {
    countEl = document.createElement('span');
    countEl.id = 'gallery-count';
    countEl.className = 'gallery-count';
    countEl.textContent = '0 photos';
    titleEl.appendChild(document.createTextNode(' '));
    titleEl.appendChild(countEl);
  }

  let moreWrapEl = qs('#gallery-more-wrap', sectionEl || document);
  let moreButtonEl = qs('#gallery-more-btn', sectionEl || document);
  let loadingEl = qs('#gallery-loading', sectionEl || document);

  if (!moreWrapEl && sectionEl) {
    moreWrapEl = document.createElement('div');
    moreWrapEl.id = 'gallery-more-wrap';
    moreWrapEl.className = 'gallery-more-wrap';
    moreWrapEl.hidden = true;

    moreButtonEl = document.createElement('button');
    moreButtonEl.type = 'button';
    moreButtonEl.id = 'gallery-more-btn';
    moreButtonEl.className = 'button button-secondary gallery-more-btn';
    moreButtonEl.textContent = '더 불러오기 ▼';

    moreWrapEl.appendChild(moreButtonEl);
    galleryEl.insertAdjacentElement('afterend', moreWrapEl);
  }

  if (!loadingEl && sectionEl) {
    loadingEl = document.createElement('div');
    loadingEl.id = 'gallery-loading';
    loadingEl.className = 'gallery-loading';
    loadingEl.hidden = true;
    loadingEl.setAttribute('role', 'status');
    loadingEl.innerHTML = '<span class="gallery-loading-spinner" aria-hidden="true"></span><span class="gallery-loading-text">사진을 준비하고 있어요</span>';
    galleryEl.insertAdjacentElement('afterend', loadingEl);
  }

  return {
    galleryEl,
    sectionEl,
    countEl,
    moreWrapEl,
    moreButtonEl,
    loadingEl
  };
}

function updateGalleryCount(countEl) {
  if (!countEl) return;
  countEl.textContent = `${galleryState.photos.length} photos`;
}

function updateMoreButton(moreWrapEl, moreButtonEl) {
  if (!moreWrapEl || !moreButtonEl) return;

  if (galleryState.photos.length <= INITIAL_VISIBLE_COUNT) {
    moreWrapEl.hidden = true;
    return;
  }

  const hasMore = galleryState.visibleCount < galleryState.photos.length;
  moreWrapEl.hidden = false;

  moreButtonEl.textContent = hasMore ? '사진 더 보기' : '사진 접기';
  moreButtonEl.setAttribute('aria-expanded', String(!hasMore));
}

function renderEmpty(galleryEl, countEl, moreWrapEl) {
  if (galleryEl) {
    galleryEl.innerHTML = `
      <div class="gallery-empty">
        아직 표시할 사진이 없습니다.
      </div>
    `;
  }

  if (countEl) {
    countEl.textContent = '0 photos';
  }

  if (moreWrapEl) {
    moreWrapEl.hidden = true;
  }
}

function galleryItemMarkup(photo, index, loading = 'lazy') {
  return `
    <button
      type="button"
      class="gallery-item"
      data-gallery-index="${index}"
      aria-label="${escapeHtml(photo.alt)} 크게 보기"
    >
      <img
        src="${escapeHtml(photo.thumb)}"
        alt="${escapeHtml(photo.alt)}"
        class="is-loading"
        loading="${loading}"
        decoding="async"
      />
    </button>
  `;
}

function startGalleryLoading(loadingEl) {
  const job = ++galleryLoadingJob;
  if (!loadingEl) return job;
  window.clearTimeout(galleryLoadingShowTimer);
  loadingEl.hidden = true;
  galleryLoadingShowTimer = window.setTimeout(() => {
    if (job === galleryLoadingJob) loadingEl.hidden = false;
  }, 400);
  galleryLoadingSafetyTimer = window.setTimeout(() => {
    if (job === galleryLoadingJob) stopGalleryLoading(loadingEl, job);
  }, 6000);
  return job;
}

function stopGalleryLoading(loadingEl, job) {
  if (!loadingEl || job !== galleryLoadingJob) return;
  window.clearTimeout(galleryLoadingShowTimer);
  window.clearTimeout(galleryLoadingSafetyTimer);
  loadingEl.hidden = true;
}

function hydrateGalleryImages(images, loadingEl, showIndicator = false) {
  if (!images.length) return;
  let completed = 0;
  const loadingJob = showIndicator ? startGalleryLoading(loadingEl) : null;

  const markComplete = () => {
    completed += 1;
    if (showIndicator && completed === images.length) stopGalleryLoading(loadingEl, loadingJob);
  };

  images.forEach((image) => {
    const finishLoading = () => {
      if (image.dataset.galleryLoadHandled === 'true') return;
      image.dataset.galleryLoadHandled = 'true';
      image.classList.remove('is-loading');
      image.closest('.gallery-item')?.classList.add('is-loaded');
      markComplete();
    };
    if (image.complete) finishLoading();
    image.addEventListener('load', finishLoading, { once: true });
    image.addEventListener('error', finishLoading, { once: true });
  });
}

function appendGalleryItems(galleryEl, startIndex, endIndex, loadingEl, loading = 'lazy', showIndicator = false) {
  const fragment = document.createRange().createContextualFragment(
    galleryState.photos
      .slice(startIndex, endIndex)
      .map((photo, offset) => galleryItemMarkup(photo, startIndex + offset, loading))
      .join('')
  );
  const images = [...fragment.querySelectorAll('img')];
  galleryEl.appendChild(fragment);
  hydrateGalleryImages(images, loadingEl, showIndicator);
}

function renderGallery() {
  const ui = ensureGalleryUi();
  if (!ui) return;

  const { galleryEl, countEl, moreWrapEl, moreButtonEl, loadingEl } = ui;

  updateGalleryCount(countEl);

  if (!galleryState.photos.length) {
    renderEmpty(galleryEl, countEl, moreWrapEl);
    return;
  }

  galleryEl.innerHTML = '';
  appendGalleryItems(galleryEl, 0, galleryState.visibleCount, loadingEl);

  updateMoreButton(moreWrapEl, moreButtonEl);
}

function openLightbox(index) {
  const photo = galleryState.photos[index];
  if (!photo) return;

  const lightboxEl = qs('#lightbox');
  const lightboxImageEl = qs('#lightbox-image');

  if (!lightboxEl || !lightboxImageEl) return;

  galleryState.lightboxIndex = index;
  setLightboxPhoto();
  lightboxEl.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function setLightboxPhoto() {
  const photo = galleryState.photos[galleryState.lightboxIndex];
  const lightboxImageEl = qs('#lightbox-image');
  const lightboxCountEl = qs('#lightbox-count');
  if (!photo || !lightboxImageEl) return;
  lightboxImageEl.src = photo.src;
  lightboxImageEl.alt = photo.alt;
  if (lightboxCountEl) {
    lightboxCountEl.textContent = `${galleryState.lightboxIndex + 1} / ${galleryState.photos.length}`;
  }
}

function moveLightbox(direction) {
  const total = galleryState.photos.length;
  if (!total) return;
  galleryState.lightboxIndex = (galleryState.lightboxIndex + direction + total) % total;
  setLightboxPhoto();
}

function closeLightbox() {
  const lightboxEl = qs('#lightbox');
  const lightboxImageEl = qs('#lightbox-image');

  if (!lightboxEl || !lightboxImageEl) return;

  lightboxEl.classList.add('hidden');
  lightboxImageEl.src = '';
  lightboxImageEl.alt = '';
  document.body.style.overflow = '';
}

function toggleGalleryExpanded() {
  if (galleryState.visibleCount >= galleryState.photos.length) {
    galleryState.visibleCount = INITIAL_VISIBLE_COUNT;
    renderGallery();
    return;
  }

  const previousCount = galleryState.visibleCount;
  galleryState.visibleCount = Math.min(
    galleryState.visibleCount + INITIAL_VISIBLE_COUNT,
    galleryState.photos.length
  );
  const ui = ensureGalleryUi();
  if (!ui || galleryState.visibleCount === previousCount) return;
  appendGalleryItems(ui.galleryEl, previousCount, galleryState.visibleCount, ui.loadingEl, 'eager', true);
  updateMoreButton(ui.moreWrapEl, ui.moreButtonEl);
}

function bindGalleryEvents() {
  if (galleryState.bound) return;
  galleryState.bound = true;

  document.addEventListener('click', (event) => {
    const galleryItem = event.target.closest('[data-gallery-index]');
    if (galleryItem) {
      const index = Number(galleryItem.dataset.galleryIndex || 0);
      openLightbox(index);
      return;
    }

    const moreButton = event.target.closest('#gallery-more-btn');
    if (moreButton) {
      toggleGalleryExpanded();
      return;
    }

    const closeButton = event.target.closest('#lightbox-close');
    if (closeButton) {
      closeLightbox();
      return;
    }

    if (event.target.closest('#lightbox-prev')) {
      moveLightbox(-1);
      return;
    }

    if (event.target.closest('#lightbox-next')) {
      moveLightbox(1);
      return;
    }

    const lightboxEl = qs('#lightbox');
    if (lightboxEl && event.target === lightboxEl) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
    }
    if (event.key === 'ArrowLeft') moveLightbox(-1);
    if (event.key === 'ArrowRight') moveLightbox(1);
  });

  const lightboxEl = qs('#lightbox');
  lightboxEl?.addEventListener('touchstart', (event) => {
    galleryState.lightboxTouchStartX = event.changedTouches[0].clientX;
  }, { passive: true });
  lightboxEl?.addEventListener('touchend', (event) => {
    const diff = event.changedTouches[0].clientX - galleryState.lightboxTouchStartX;
    if (Math.abs(diff) < 36) return;
    moveLightbox(diff < 0 ? 1 : -1);
  }, { passive: true });

  lightboxEl?.addEventListener('touchmove', (event) => {
    if (event.touches.length > 1) event.preventDefault();
  }, { passive: false });

  ['gesturestart', 'gesturechange', 'gestureend'].forEach((eventName) => {
    lightboxEl?.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
  });
}

export function initGallery(photos) {
  galleryState.photos = normalizePhotos(photos);
  galleryState.visibleCount = INITIAL_VISIBLE_COUNT;

  bindGalleryEvents();
  renderGallery();
}

function showToastFallback(message) {
  const toast = document.getElementById('toast');
  if (!toast) {
    console.warn(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add('is-visible');

  window.clearTimeout(showToastFallback._timer);
  showToastFallback._timer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}
function initInteractionGuard() {
  // 전체 우클릭 방지
  document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
  });

  // 이미지 드래그 방지
  document.addEventListener('dragstart', (event) => {
    if (event.target instanceof HTMLImageElement) {
      event.preventDefault();
    }
  });

  // 전역 touchmove 차단은 모바일 스크롤 성능을 크게 떨어뜨립니다.
  // 확대 제한은 CSS touch-action과 viewport 설정으로 처리합니다.
}

function resetScrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }));
}

function initIntroScrollSnap() {
  const cover = document.getElementById('invitation-cover');
  if (!cover) return;
  let frame = 0;
  const update = () => {
    frame = 0;
    const releasePoint = Math.max(120, cover.offsetHeight - (window.innerHeight || 1) * 0.55);
    document.documentElement.classList.toggle('is-intro-snap', window.scrollY < releasePoint);
  };
  const onScroll = () => {
    if (!frame) frame = window.requestAnimationFrame(update);
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', update, { passive: true });
}

function initTextSizeControl() {
  const toggle = document.getElementById('text-size-toggle');
  if (!toggle) return;

  const storageKey = 'wedding-large-text';
  const apply = (enabled) => {
    document.documentElement.classList.toggle('is-large-text', enabled);
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? '기본 글자 크기로 보기' : '글자 크게 보기');
    toggle.firstElementChild.textContent = enabled ? '가−' : '가+';
  };

  try {
    apply(window.localStorage.getItem(storageKey) === 'true');
  } catch {
    apply(false);
  }

  toggle.addEventListener('click', () => {
    const enabled = !document.documentElement.classList.contains('is-large-text');
    apply(enabled);
    showToastFallback(enabled ? '글자를 크게 표시합니다.' : '기본 글자 크기로 표시합니다.');
    try {
      window.localStorage.setItem(storageKey, String(enabled));
    } catch {
      // Private browsing can disable local storage; the current-page setting still works.
    }
  });
}

function initFloatingNavigation() {
  const topButton = document.getElementById('scroll-top-button');
  const bottomButton = document.getElementById('scroll-bottom-button');

  topButton?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  bottomButton?.addEventListener('click', () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
  });
}

async function safeImport(label, path) {
  try {
  return await import(path);
  } catch (error) {
    console.error(`[${label}] module import failed`, error);
    showToastFallback(`${label} 기능을 불러오지 못했습니다.`);
    return null;
  }
}

async function safeRun(label, task) {
  try {
    await task();
  } catch (error) {
    console.error(`[${label}] init failed`, error);
    showToastFallback(`${label} 기능 초기화 중 오류가 발생했습니다.`);
  }
}

async function init() {
  const [
    introModule,
    countdownModule,
    clipboardModule,
    directoryModule,
    shareModule,
    mapsModule,
    guestbookModule,
    sliderModule,
    galleryModule,
    rsvpModule
  ] = await Promise.all([
    safeImport('intro', './features/intro.js'),
    safeImport('countdown', './features/countdown.js'),
    safeImport('clipboard', './features/clipboard.js'),
    safeImport('directory', './features/directory.js'),
    safeImport('share', './features/share.js'),
    safeImport('maps', './features/maps.js'),
    safeImport('guestbook', './features/guestbook.js'),
    safeImport('slider', './features/slider.js'),
    safeImport('gallery', './features/gallery.js'),
    safeImport('rsvp', './features/rsvp.js')
  ]);

  if (introModule?.initIntroParallax) {
    await safeRun('intro', async () => {
      introModule.initIntroParallax();
    });
  }

  if (countdownModule?.initCountdown) {
    await safeRun('countdown', async () => {
      countdownModule.initCountdown();
    });
  }

  if (clipboardModule?.initClipboard) {
    await safeRun('clipboard', async () => {
      clipboardModule.initClipboard();
    });
  }

  if (directoryModule?.initDirectory) {
    await safeRun('directory', async () => {
      await directoryModule.initDirectory();
    });
  }

  if (shareModule?.initShare) {
    await safeRun('share', async () => {
      shareModule.initShare();
    });
  }

  if (mapsModule?.initMaps) {
    await safeRun('maps', async () => {
      mapsModule.initMaps();
    });
  }

  if (guestbookModule?.initGuestbook) {
    await safeRun('guestbook', async () => {
      await guestbookModule.initGuestbook();
    });
  }

  if (sliderModule?.initSlider) {
    await safeRun('slider', async () => {
      await sliderModule.initSlider();
    });
  }

  if (sliderModule?.getGalleryPhotos && galleryModule?.initGallery) {
    await safeRun('gallery', async () => {
      const photos = sliderModule.getGalleryPhotos();
      galleryModule.initGallery(Array.isArray(photos) ? photos : []);
      sliderModule.onGalleryPhotosUpdated?.((updatedPhotos) => {
        const applyUpdate = () => galleryModule.initGallery(Array.isArray(updatedPhotos) ? updatedPhotos : []);
        const gallery = document.getElementById('gallery');
        const rect = gallery?.getBoundingClientRect();
        const isVisible = rect && rect.top < window.innerHeight && rect.bottom > 0;
        if (!isVisible) {
          window.requestIdleCallback?.(applyUpdate, { timeout: 800 }) || window.setTimeout(applyUpdate, 180);
          return;
        }
        // Avoid replacing image nodes while the visitor is scrolling this section.
        const observer = new IntersectionObserver((entries) => {
          if (entries[0]?.isIntersecting) return;
          observer.disconnect();
          applyUpdate();
        });
        observer.observe(gallery);
      });
    });
  }

  if (rsvpModule?.initRsvp) {
    await safeRun('rsvp', async () => {
      rsvpModule.initRsvp();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  resetScrollToTop();
  window.addEventListener('pageshow', resetScrollToTop, { once: true });
  initIntroScrollSnap();
  initInteractionGuard();
  initTextSizeControl();
  initFloatingNavigation();
  init().catch((error) => {
    console.error('[main] fatal init error', error);
    showToastFallback('페이지 초기화 중 오류가 발생했습니다.');
  });
});

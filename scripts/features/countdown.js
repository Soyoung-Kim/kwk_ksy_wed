import { APP_CONFIG } from '../../config.js';
import { qs, pad } from '../utils.js';

export function initCountdown() {
  const daysEl = qs('#countdown-days');
  const hoursEl = qs('#countdown-hours');
  const minutesEl = qs('#countdown-minutes');
  const secondsEl = qs('#countdown-seconds');
  const ddayEl = qs('#countdown-dday');

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl || !ddayEl) return;

  const weddingTime = new Date(APP_CONFIG.weddingIso).getTime();

  const update = () => {
    const diff = weddingTime - Date.now();

    if (diff <= 0) {
      daysEl.textContent = '0';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      ddayEl.textContent = `${APP_CONFIG.coupleLabel}의 결혼식이 오늘입니다.`;
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    daysEl.textContent = String(days);
    hoursEl.textContent = pad(hours);
    minutesEl.textContent = pad(minutes);
    secondsEl.textContent = pad(seconds);
    ddayEl.textContent = '남았습니다.';
  };

  update();
  setInterval(update, 1000);
}

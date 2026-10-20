import { APP_CONFIG } from '../../config.js';
import { qs, pad } from '../utils.js';

function koreanDateStamp(value) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = Object.fromEntries(formatter.formatToParts(value)
    .filter(({ type }) => type !== 'literal')
    .map(({ type, value: part }) => [type, part]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

export function initCountdown() {
  const daysEl = qs('#countdown-days');
  const hoursEl = qs('#countdown-hours');
  const minutesEl = qs('#countdown-minutes');
  const secondsEl = qs('#countdown-seconds');
  const ddayEl = qs('#countdown-dday');
  const captionEl = qs('#countdown-caption');
  const gridEl = qs('.intro-countdown-grid');

  if (!daysEl || !hoursEl || !minutesEl || !secondsEl || !ddayEl || !captionEl || !gridEl) return;

  const weddingTime = new Date(APP_CONFIG.weddingIso).getTime();
  const weddingDate = new Date(weddingTime);
  const coupleNames = APP_CONFIG.coupleLabel.replace(/\s+/g, '').replace('❤', '♥');

  const update = () => {
    const now = new Date();
    const diff = weddingTime - now.getTime();

    if (diff <= 0) {
      const daysPassed = Math.round((koreanDateStamp(now) - koreanDateStamp(weddingDate)) / 86400000);
      gridEl.hidden = true;

      if (daysPassed === 0) {
        captionEl.textContent = `${coupleNames} 의 예식일 입니다`;
        ddayEl.hidden = true;
      } else {
        captionEl.textContent = `${coupleNames} 의 결혼식으로부터`;
        ddayEl.hidden = false;
        ddayEl.textContent = `D+${daysPassed}일 지났습니다.`;
      }
      return;
    }

    captionEl.textContent = '우경 ♥ 소영의 결혼식까지';
    gridEl.hidden = false;
    ddayEl.hidden = false;

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

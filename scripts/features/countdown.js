import { APP_CONFIG } from '../../config.js';
import { qs, pad } from '../utils.js';

function getKoreanCalendarDayDistance(targetTime, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const toUtcMidnight = (value) => {
    const parts = Object.fromEntries(formatter.formatToParts(value)
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value: part }) => [type, part]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };

  return Math.max(0, Math.round((toUtcMidnight(targetTime) - toUtcMidnight(now)) / 86400000));
}

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
    // 시·분·초 카운트는 실제 남은 시간을, D-day 문구는 한국 날짜 기준 달력 일수를 표시합니다.
    // 예: 10/20 오후 → 11/8 오전은 18일 22시간 남았어도 D-19입니다.
    const calendarDays = getKoreanCalendarDayDistance(new Date(weddingTime));
    ddayEl.textContent = `${APP_CONFIG.coupleLabel}의 결혼식이 D-${calendarDays}일 남았습니다.`;
  };

  update();
  setInterval(update, 1000);
}

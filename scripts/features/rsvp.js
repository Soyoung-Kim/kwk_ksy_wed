import { supabaseClient } from '../supabaseClient.js';
import { APP_CONFIG } from '../../config.js';

const SITE_KEY = APP_CONFIG.siteKey || 'wedding-invitation';
const TOKEN_KEY = `wedding-rsvp-client-token:${SITE_KEY}`;
const DISMISS_KEY = `wedding-rsvp-dismissed-date:${SITE_KEY}`;

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function getClientToken() {
  try {
    let token = window.localStorage.getItem(TOKEN_KEY);
    if (!token) {
      token = crypto.randomUUID();
      window.localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    return crypto.randomUUID();
  }
}

export function initRsvp() {
  const modal = document.getElementById('rsvp-modal');
  const openButton = document.getElementById('rsvp-open-button');
  const form = document.getElementById('rsvp-form');
  const status = document.getElementById('rsvp-status');
  const submitButton = document.getElementById('rsvp-submit-button');
  const countField = document.getElementById('rsvp-guest-count-field');
  const promptView = document.getElementById('rsvp-prompt-view');
  const formView = document.getElementById('rsvp-form-view');
  const promptYes = document.getElementById('rsvp-prompt-yes');
  const promptLater = document.getElementById('rsvp-prompt-later');
  if (!modal || !openButton || !form || !status || !submitButton || !countField || !promptView || !formView || !promptYes || !promptLater) return;

  const token = getClientToken();
  let previousResponseLoaded = false;
  const setAttendanceUi = () => {
    const attending = new FormData(form).get('attendance') === 'attending';
    countField.hidden = !attending;
    countField.querySelector('select').disabled = !attending;
    form.querySelectorAll('.rsvp-choice').forEach((choice) => {
      const input = choice.querySelector('input[name="attendance"]');
      choice.classList.toggle('is-selected', Boolean(input?.checked));
      choice.classList.toggle('is-attending', input?.value === 'attending');
      choice.classList.toggle('is-declined', input?.value === 'declined');
    });
  };
  const today = () => new Date().toLocaleDateString('en-CA');
  const hasSubmitted = () => {
    try { return window.localStorage.getItem(`${TOKEN_KEY}-submitted`) === 'true'; } catch { return false; }
  };
  const dismissedToday = () => {
    try { return window.localStorage.getItem(DISMISS_KEY) === today(); } catch { return false; }
  };
  const close = () => { modal.hidden = true; document.body.style.overflow = ''; };
  const loadPreviousResponse = async () => {
    if (previousResponseLoaded || !supabaseClient) return;
    previousResponseLoaded = true;
    status.textContent = '이전에 전달해 주신 내용을 불러오는 중입니다.';
    const { data, error } = await supabaseClient.rpc('get_wedding_rsvp', {
      p_client_token: token,
      p_site_key: SITE_KEY
    });
    if (error) {
      console.warn('[rsvp] previous response load failed', error);
      status.textContent = '';
      return;
    }
    const saved = Array.isArray(data) ? data[0] : data;
    if (saved) {
      const attendanceInput = form.querySelector(`input[name="attendance"][value="${saved.attendance}"]`);
      if (attendanceInput) attendanceInput.checked = true;
      form.elements.guest_count.value = String(saved.guest_count || 1);
      form.elements.name.value = saved.guest_name || '';
      form.elements.message.value = saved.message || '';
      setAttendanceUi();
    }
    status.textContent = '';
  };
  const showForm = async () => {
    promptView.hidden = true; formView.hidden = false; modal.hidden = false; document.body.style.overflow = 'hidden';
    setAttendanceUi();
    await loadPreviousResponse();
    form.querySelector('input[name="attendance"]:checked')?.focus();
  };
  const showPrompt = () => {
    formView.hidden = true; promptView.hidden = false; modal.hidden = false; document.body.style.overflow = 'hidden'; promptYes.focus();
  };

  try {
    if (hasSubmitted()) openButton.textContent = '참석 여부 수정하기';
  } catch { /* local storage can be unavailable in private browsing */ }

  openButton.addEventListener('click', showForm);
  promptYes.addEventListener('click', showForm);
  promptLater.addEventListener('click', () => {
    try { window.localStorage.setItem(DISMISS_KEY, today()); } catch { /* no-op */ }
    close();
  });
  modal.addEventListener('click', (event) => { if (event.target.closest('[data-rsvp-close]')) close(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modal.hidden) close(); });
  form.addEventListener('change', (event) => { if (event.target.name === 'attendance') setAttendanceUi(); });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!supabaseClient) { status.textContent = '응답 기능을 준비하지 못했습니다. 잠시 후 다시 시도해주세요.'; return; }
    const values = new FormData(form);
    if (values.get('website')) { status.textContent = '응답을 저장할 수 없습니다.'; return; }
    const attendance = String(values.get('attendance'));
    const guestCount = attendance === 'attending' ? Number(values.get('guest_count')) : 0;
    submitButton.disabled = true;
    submitButton.textContent = '저장 중…';
    status.textContent = '';
    const { error } = await supabaseClient.rpc('submit_wedding_rsvp', {
      p_client_token: token,
      p_attendance: attendance,
      p_guest_count: guestCount,
      p_name: String(values.get('name') || '').trim(),
      p_message: String(values.get('message') || '').trim(),
      p_website: '',
      p_site_key: SITE_KEY
    });
    submitButton.disabled = false;
    submitButton.textContent = '응답 저장하기';
    if (error) { status.textContent = `저장에 실패했습니다: ${error.message}`; return; }
    try { window.localStorage.setItem(`${TOKEN_KEY}-submitted`, 'true'); } catch { /* no-op */ }
    openButton.textContent = '참석 여부 수정하기';
    close();
    showToast('참석 여부를 저장했습니다. 감사합니다.');
  });

  if (!hasSubmitted() && !dismissedToday()) {
    window.setTimeout(showPrompt, 650);
  }
}

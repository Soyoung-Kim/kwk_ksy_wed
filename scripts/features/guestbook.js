import { APP_CONFIG } from '../../config.js';
import { supabaseClient, hasSupabaseConfig, getFunctionHeaders } from '../supabaseClient.js';

const GUESTBOOK_SELECT_COLUMNS = 'id, theme, icon, display_name, message, created_at, updated_at';
const PASSWORD_MIN_LENGTH = 4;
const PASSWORD_MAX_LENGTH = 20;
const GUESTBOOK_PAGE_SIZE = 4;
const ICON_SYMBOLS = {
  heart: '♥', flower: '✿', ribbon: '🎀', sparkle: '✦', smile: '☺', leaf: '❋'
};

const state = {
  entries: [],
  currentPage: 1,
  selectedTheme: 'pink',
  selectedIcon: 'heart',
  editId: '',
  submitting: false,

  aiLoading: false,
  aiTarget: 'groom',
  aiVersion: 'friend',
  aiSuggestions: [],
  hasRequestedAi: false,
  aiCache: Object.create(null)
};

const els = {};

function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

function showToast(message) {
  const toast = document.getElementById('toast');

  if (!toast) {
    console.warn(message);
    return;
  }

  toast.textContent = message;
  toast.classList.add('is-visible');

  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatGuestbookDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric'
  }).format(date);
}

function cacheElements() {
  els.root = document.getElementById('guestbook');
  els.status = document.getElementById('guestbook-status');
  els.list = document.getElementById('guestbook-list');
  els.pagination = document.getElementById('guestbook-pagination');

  els.openButton = document.getElementById('guestbook-open-btn');
  els.formPanel = document.getElementById('guestbook-form-panel');
  els.formBackdrop = document.getElementById('guestbook-form-backdrop');
  els.formCloseButton = document.getElementById('guestbook-form-close');
  els.form = document.getElementById('guestbook-form');
  els.formTitle = document.getElementById('guestbook-form-title');
  els.formCaption = document.getElementById('guestbook-form-caption');
  els.editIdInput = document.getElementById('guestbook-edit-id');
  els.nameInput = document.getElementById('guestbook-name');
  els.messageInput = document.getElementById('guestbook-message');
  els.passwordInput = document.getElementById('guestbook-password');
  els.submitButton = document.getElementById('guestbook-submit-btn');
  els.cancelButton = document.getElementById('guestbook-cancel-btn');
  els.celebration = document.getElementById('guestbook-celebration');

  els.themeButtons = qsa('.guestbook-theme-btn', els.root || document);
  els.iconButtons = qsa('.guestbook-icon-btn', els.root || document);

  els.editLock = document.getElementById('guestbook-edit-lock');
  els.editCancelOverlayButton = document.getElementById('guestbook-edit-cancel-overlay-btn');

  els.aiOpenButton = document.getElementById('guestbook-ai-open');
  els.aiModal = document.getElementById('guestbook-ai-modal');
  els.aiCloseButton = document.getElementById('guestbook-ai-close');
  els.aiBackdrop = els.aiModal ? qs('[data-ai-close="true"]', els.aiModal) : null;
  els.aiTargetButtons = qsa('.guestbook-ai-target-btn', els.aiModal || document);
  els.aiVersionButtons = qsa('.guestbook-ai-version-btn', els.aiModal || document);
  els.aiStatus = document.getElementById('guestbook-ai-status');
  els.aiList = document.getElementById('guestbook-ai-list');
  els.aiRequestButton = document.getElementById('guestbook-ai-request-btn');
}

function getGuestbookConfig() {
  return APP_CONFIG?.guestbook || {};
}

function getFunctionsConfig() {
  return getGuestbookConfig().functions || {};
}

function getGroomName() {
  return getGuestbookConfig().groomName || '우경';
}

function getBrideName() {
  return getGuestbookConfig().brideName || '소영';
}

function hasAiFunction() {
  return Boolean(getFunctionsConfig().aiSuggest);
}

function setStatus(message = '', isLoading = false) {
  if (els.status) {
    els.status.textContent = message;
    els.status.classList.toggle('is-loading', Boolean(message) && isLoading);
  }
}

function setSelectedTheme(theme) {
  state.selectedTheme = theme;

  if (els.formPanel) {
    for (const themeName of ['pink', 'blue', 'purple', 'green', 'yellow']) {
      els.formPanel.classList.toggle(`guestbook-form-theme-${themeName}`, themeName === theme);
    }
  }

  for (const button of els.themeButtons) {
    const isActive = button.dataset.theme === theme;
    button.setAttribute('aria-pressed', String(isActive));
    button.classList.toggle('is-active', isActive);
  }
}

function getIconSymbol(icon) {
  return ICON_SYMBOLS[icon] || ICON_SYMBOLS.heart;
}

function setSelectedIcon(icon) {
  state.selectedIcon = icon;
  for (const button of els.iconButtons) {
    const isActive = button.dataset.icon === icon;
    button.setAttribute('aria-pressed', String(isActive));
    button.classList.toggle('is-active', isActive);
  }
}

function clearFormFields() {
  if (els.editIdInput) els.editIdInput.value = '';
  if (els.nameInput) els.nameInput.value = '';
  if (els.messageInput) els.messageInput.value = '';
  if (els.passwordInput) els.passwordInput.value = '';
}

function resetFormState() {
  state.editId = '';
  clearFormFields();

  if (els.formTitle) {
    els.formTitle.textContent = '축하 메시지 남기기';
  }

  if (els.formCaption) {
    els.formCaption.textContent = '따뜻한 축하의 말을 남겨주세요.';
  }

  setSelectedTheme('pink');
  setSelectedIcon('heart');
  unlockGuestbookBoard();
}

function openCreateForm() {
  resetFormState();
  openFormModal();
}

function closeForm() {
  if (els.formPanel) {
    els.formPanel.hidden = true;
  }
  if (els.formBackdrop) els.formBackdrop.hidden = true;
  document.body.classList.remove('guestbook-form-modal-open');

  closeAiModal();
  resetFormState();
}

function openFormModal() {
  if (!els.formPanel) return;
  els.formBackdrop && (els.formBackdrop.hidden = false);
  els.formPanel.hidden = false;
  document.body.classList.add('guestbook-form-modal-open');
  els.formPanel.classList.remove('is-opening');
  window.requestAnimationFrame(() => {
    els.formPanel?.classList.add('is-opening');
    els.nameInput?.focus();
  });
}

function lockGuestbookBoard() {
  if (els.editLock) {
    els.editLock.hidden = false;
  }

  qsa('.guestbook-entry-action', els.root || document).forEach((button) => {
    button.setAttribute('disabled', 'disabled');
  });
}

function unlockGuestbookBoard() {
  if (els.editLock) {
    els.editLock.hidden = true;
  }

  qsa('.guestbook-entry-action', els.root || document).forEach((button) => {
    button.removeAttribute('disabled');
  });
}

function fillFormForEdit(entry) {
  state.editId = entry.id;

  if (els.editIdInput) els.editIdInput.value = entry.id;
  if (els.nameInput) els.nameInput.value = entry.display_name || '';
  if (els.messageInput) els.messageInput.value = entry.message || '';
  if (els.passwordInput) els.passwordInput.value = '';

  if (els.formTitle) {
    els.formTitle.textContent = '축하 메시지 수정';
  }

  if (els.formCaption) {
    els.formCaption.textContent = '수정 후 비밀번호를 다시 입력해주세요.';
  }

  setSelectedTheme(entry.theme || 'pink');
  setSelectedIcon(entry.icon || 'heart');

  openFormModal();

  lockGuestbookBoard();
  els.nameInput?.focus();
}

function buildCard(entry) {
  return `
    <article class="guestbook-card guestbook-card-${escapeHtml(entry.theme || 'pink')}" data-entry-id="${escapeHtml(entry.id)}">
      <div class="guestbook-card-head">
        <div class="guestbook-card-meta">
          <div class="guestbook-card-name"><span class="guestbook-card-icon" aria-hidden="true">${escapeHtml(getIconSymbol(entry.icon))}</span>${escapeHtml(entry.display_name)}</div>
          <div class="guestbook-card-date">${escapeHtml(formatGuestbookDate(entry.created_at))}</div>
        </div>
      </div>

      <div class="guestbook-card-message">${escapeHtml(entry.message)}</div>

      <div class="guestbook-card-actions">
        <button
          type="button"
          class="button button-secondary guestbook-entry-action"
          data-action="edit"
          data-entry-id="${escapeHtml(entry.id)}"
        >
          수정
        </button>
        <button
          type="button"
          class="button button-secondary guestbook-entry-action"
          data-action="delete"
          data-entry-id="${escapeHtml(entry.id)}"
        >
          삭제
        </button>
      </div>
    </article>
  `;
}

function renderEmptyState() {
  if (!els.list) return;

  els.list.innerHTML = `
    <article class="guestbook-card">
      <div class="guestbook-card-message">첫 번째 축하 메시지를 남겨주세요.</div>
    </article>
  `;
  if (els.pagination) els.pagination.replaceChildren();
}

function renderPagination() {
  if (!els.pagination) return;
  const totalPages = Math.ceil(state.entries.length / GUESTBOOK_PAGE_SIZE);
  if (totalPages <= 1) {
    els.pagination.replaceChildren();
    return;
  }

  const previous = document.createElement('button');
  previous.type = 'button';
  previous.className = 'guestbook-page-button';
  previous.textContent = '이전';
  previous.disabled = state.currentPage === 1;
  previous.addEventListener('click', () => {
    state.currentPage -= 1;
    renderGuestbook();
  });

  const indicator = document.createElement('span');
  indicator.className = 'guestbook-page-indicator';
  indicator.textContent = `${state.currentPage} / ${totalPages}`;

  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'guestbook-page-button';
  next.textContent = '다음';
  next.disabled = state.currentPage === totalPages;
  next.addEventListener('click', () => {
    state.currentPage += 1;
    renderGuestbook();
  });
  els.pagination.replaceChildren(previous, indicator, next);
}

function renderGuestbook() {
  if (!els.list) return;

  if (!state.entries.length) {
    renderEmptyState();
    return;
  }

  const totalPages = Math.ceil(state.entries.length / GUESTBOOK_PAGE_SIZE);
  state.currentPage = Math.min(Math.max(state.currentPage, 1), totalPages);
  const start = (state.currentPage - 1) * GUESTBOOK_PAGE_SIZE;
  els.list.innerHTML = state.entries.slice(start, start + GUESTBOOK_PAGE_SIZE).map(buildCard).join('');
  renderPagination();
}

function applySavedEntry(entry, isNewEntry) {
  if (!entry?.id) return;

  if (isNewEntry) {
    state.entries = [entry, ...state.entries.filter((item) => item.id !== entry.id)];
    state.currentPage = 1;
  } else {
    state.entries = state.entries.map((item) => item.id === entry.id ? entry : item);
  }

  renderGuestbook();

  if (isNewEntry) {
    window.requestAnimationFrame(() => {
      const card = qsa('.guestbook-card', els.list).find((item) => item.dataset.entryId === entry.id);
      card?.classList.add('is-new');
    });
  }
}

function focusSavedEntry(entryId) {
  const card = qsa('.guestbook-card', els.list).find((item) => item.dataset.entryId === entryId);
  if (!card) return;
  card.setAttribute('tabindex', '-1');
  window.setTimeout(() => {
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => card.focus({ preventScroll: true }), 360);
  }, 40);
}

function showCelebration() {
  if (!els.celebration) return;
  els.celebration.hidden = false;
  els.celebration.classList.remove('is-visible');
  window.requestAnimationFrame(() => els.celebration?.classList.add('is-visible'));
  window.clearTimeout(showCelebration.timer);
  showCelebration.timer = window.setTimeout(() => {
    els.celebration?.classList.remove('is-visible');
    window.setTimeout(() => { if (els.celebration) els.celebration.hidden = true; }, 220);
  }, 1450);
}

function setSubmitLoading(isLoading) {
  if (!els.submitButton) return;

  if (isLoading) {
    els.submitButton.setAttribute('disabled', 'disabled');
    els.submitButton.setAttribute('aria-busy', 'true');
    els.submitButton.dataset.label = els.submitButton.textContent || '작성 완료';
    els.submitButton.textContent = '저장 중…';
    return;
  }

  els.submitButton.removeAttribute('disabled');
  els.submitButton.removeAttribute('aria-busy');
  els.submitButton.textContent = els.submitButton.dataset.label || '작성 완료';
}

export async function loadGuestbook() {
  if (!hasSupabaseConfig() || !supabaseClient) {
    setStatus('Supabase 설정이 비어 있습니다.');
    renderEmptyState();
    return;
  }

  setStatus('축하 메시지를 불러오는 중입니다.', true);

  const tableName = getGuestbookConfig().table || 'guestbook_entries';

  const { data, error } = await supabaseClient
    .from(tableName)
    .select(GUESTBOOK_SELECT_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[guestbook] load error', error);
    setStatus('축하 메시지를 불러오지 못했습니다.');
    renderEmptyState();
    return;
  }

  state.entries = Array.isArray(data) ? data : [];
  state.currentPage = 1;
  renderGuestbook();
  setStatus(state.entries.length ? '' : '아직 등록된 축하 메시지가 없습니다.');
}

function getFunctionUrl(functionName) {
  return `${APP_CONFIG.supabaseUrl}/functions/v1/${functionName}`;
}

async function invokeFunction(functionName, payload) {
  if (!functionName) {
    throw new Error('함수 이름이 설정되지 않았습니다.');
  }

  const response = await fetch(getFunctionUrl(functionName), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getFunctionHeaders()
    },
    body: JSON.stringify(payload)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = result?.error || result?.message || '요청 처리에 실패했습니다.';
    const error = new Error(message);
    error.status = response.status;
    error.payload = result;
    throw error;
  }

  return result;
}

function validateForm() {
  const displayName = (els.nameInput?.value || '').trim();
  const message = (els.messageInput?.value || '').trim();
  const password = (els.passwordInput?.value || '').trim();

  if (!displayName || displayName.length > 20) {
    showToast('이름은 1자 이상 20자 이하로 입력해주세요.');
    return null;
  }

  if (!message || message.length > 300) {
    showToast('메시지는 1자 이상 300자 이하로 입력해주세요.');
    return null;
  }

  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    showToast(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 ${PASSWORD_MAX_LENGTH}자 이하로 입력해주세요.`);
    return null;
  }

  return {
    theme: state.selectedTheme,
    icon: state.selectedIcon,
    display_name: displayName,
    message,
    password
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  if (state.submitting) {
    return;
  }

  const payload = validateForm();
  if (!payload) {
    return;
  }

  const functions = getFunctionsConfig();

  state.submitting = true;
  setSubmitLoading(true);
  setStatus('축하 메시지를 저장하는 중입니다.', true);

  try {
    const isEditing = Boolean(state.editId);
    let result;

    if (state.editId) {
      result = await invokeFunction(functions.update, {
        id: state.editId,
        ...payload
      });
      showToast('축하 메시지가 수정되었습니다.');
    } else {
      result = await invokeFunction(functions.create, payload);
    }

    applySavedEntry(result?.entry, !isEditing);
    closeForm();
    if (!isEditing) {
      focusSavedEntry(result?.entry?.id);
      showCelebration();
    }
    setStatus('');
  } catch (error) {
    console.error('[guestbook] submit error', error);

    if (error?.status === 404 || error?.status === 409) {
      showToast('이미 삭제되었거나 수정할 수 없는 글입니다.');
      closeForm();
      await loadGuestbook();
      return;
    }

    showToast(error?.message || '저장에 실패했습니다.');
  } finally {
    state.submitting = false;
    setSubmitLoading(false);
  }
}

async function handleDelete(entryId) {
  if (state.editId) {
    showToast('수정 중에는 다른 글을 삭제할 수 없습니다.');
    return;
  }

  const password = window.prompt('삭제에 사용할 비밀번호를 입력해주세요.');
  if (!password) return;

  const normalized = password.trim();

  if (normalized.length < PASSWORD_MIN_LENGTH || normalized.length > PASSWORD_MAX_LENGTH) {
    showToast(`비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상 ${PASSWORD_MAX_LENGTH}자 이하로 입력해주세요.`);
    return;
  }

  try {
    await invokeFunction(getFunctionsConfig().delete, {
      id: entryId,
      password: normalized
    });

    showToast('축하 메시지가 삭제되었습니다.');
    await loadGuestbook();
  } catch (error) {
    console.error('[guestbook] delete error', error);

    if (error?.status === 404 || error?.status === 409) {
      showToast('이미 삭제되었거나 삭제할 수 없는 글입니다.');
      await loadGuestbook();
      return;
    }

    showToast(error?.message || '삭제에 실패했습니다.');
  }
}

function handleListClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const entryId = button.dataset.entryId;
  const action = button.dataset.action;
  const entry = state.entries.find((item) => item.id === entryId);

  if (!entry) {
    showToast('이미 삭제되었거나 존재하지 않는 글입니다.');
    loadGuestbook();
    return;
  }

  if (action === 'edit') {
    fillFormForEdit(entry);
    return;
  }

  if (action === 'delete') {
    handleDelete(entryId);
  }
}

function setAiStatus(message) {
  if (els.aiStatus) {
    els.aiStatus.textContent = message;
  }
}

function getAiCacheKey() {
  return `${state.aiTarget}::${state.aiVersion}`;
}

function getCachedAiSuggestions() {
  const cached = state.aiCache[getAiCacheKey()];
  return Array.isArray(cached) && cached.length ? cached : null;
}

function updateAiRequestButtonLabel() {
  if (!els.aiRequestButton) return;
  els.aiRequestButton.textContent = state.hasRequestedAi ? '다시 추천받기' : '추천받기';
}

function renderAiSuggestions() {
  if (!els.aiList) return;

  if (!state.aiSuggestions.length) {
    els.aiList.innerHTML = '';
    return;
  }

  els.aiList.innerHTML = state.aiSuggestions
    .map((text, index) => {
      return `
        <article class="guestbook-ai-item">
          <p class="guestbook-ai-item-text">${escapeHtml(text)}</p>
          <div class="guestbook-ai-item-actions">
            <button type="button" class="button button-secondary" data-ai-copy-index="${index}">
              복사
            </button>
            <button type="button" class="button button-primary" data-ai-apply-index="${index}">
              바로 입력
            </button>
          </div>
        </article>
      `;
    })
    .join('');
}

function setAiTarget(target) {
  state.aiTarget = target;

  for (const button of els.aiTargetButtons) {
    button.classList.toggle('is-active', button.dataset.aiTarget === target);
  }
}

function setAiVersion(version) {
  state.aiVersion = version;

  for (const button of els.aiVersionButtons) {
    button.classList.toggle('is-active', button.dataset.aiVersion === version);
  }
}

function handleAiSelectionChanged() {
  state.aiSuggestions = [];
  state.hasRequestedAi = false;

  renderAiSuggestions();
  updateAiRequestButtonLabel();

  const cached = getCachedAiSuggestions();

  if (cached) {
    setAiStatus('이 조합은 이전 추천 결과가 있습니다. 추천받기를 누르면 바로 보여드립니다.');
  } else {
    setAiStatus('대상과 버전을 고른 뒤 추천받기를 눌러주세요.');
  }
}

async function copyToClipboard(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch (error) {
    console.error('[guestbook] clipboard error', error);
    showToast('복사에 실패했습니다.');
  }
}

async function requestAiSuggestions(forceRefresh = false) {
  if (!hasAiFunction()) {
    setAiStatus('AI 추천 기능이 아직 설정되지 않았습니다.');
    return;
  }

  if (state.aiLoading) {
    return;
  }

  const cacheKey = getAiCacheKey();
  const cached = state.aiCache[cacheKey];

  if (!forceRefresh && Array.isArray(cached) && cached.length) {
    state.aiSuggestions = [...cached];
    state.hasRequestedAi = true;

    renderAiSuggestions();
    updateAiRequestButtonLabel();
    setAiStatus('저장된 추천 문구를 불러왔습니다. 새 문구가 필요하면 다시 추천받기를 눌러주세요.');
    return;
  }

  state.aiLoading = true;
  state.aiSuggestions = [];
  renderAiSuggestions();
  setAiStatus(forceRefresh ? '새 추천 문구를 불러오는 중입니다...' : '추천 문구를 불러오는 중입니다...');
  els.aiRequestButton?.setAttribute('disabled', 'disabled');

  try {
    const result = await invokeFunction(getFunctionsConfig().aiSuggest, {
      target: state.aiTarget,
      version: state.aiVersion,
      groomName: getGroomName(),
      brideName: getBrideName()
    });

    const suggestions = Array.isArray(result?.suggestions) ? result.suggestions : [];
    state.aiSuggestions = suggestions
      .filter((item) => typeof item === 'string' && item.trim())
      .slice(0, 4);

    state.aiCache[cacheKey] = [...state.aiSuggestions];
    state.hasRequestedAi = true;

    renderAiSuggestions();
    updateAiRequestButtonLabel();

    if (state.aiSuggestions.length) {
      setAiStatus(
        forceRefresh
          ? '새 추천 문구를 불러왔습니다. 마음에 드는 문구를 선택해주세요.'
          : '추천 문구를 불러왔습니다. 마음에 드는 문구를 선택해주세요.'
      );
    } else {
      setAiStatus('추천 문구를 불러오지 못했습니다.');
    }
  } catch (error) {
    console.error('[guestbook] ai error', error);
    setAiStatus(error?.message || '추천 문구를 불러오지 못했습니다.');
  } finally {
    state.aiLoading = false;
    els.aiRequestButton?.removeAttribute('disabled');
  }
}

function openAiModal() {
  if (!els.aiModal) return;

  setAiTarget('groom');
  setAiVersion('friend');

  els.aiModal.hidden = false;
  handleAiSelectionChanged();
}

function closeAiModal() {
  if (els.aiModal) {
    els.aiModal.hidden = true;
  }
}

function bindEvents() {
  els.openButton?.addEventListener('click', openCreateForm);
  els.cancelButton?.addEventListener('click', closeForm);
  els.formCloseButton?.addEventListener('click', closeForm);
  els.formBackdrop?.addEventListener('click', () => { if (!state.submitting) closeForm(); });
  els.editCancelOverlayButton?.addEventListener('click', closeForm);
  els.form?.addEventListener('submit', handleSubmit);
  els.list?.addEventListener('click', handleListClick);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !els.formPanel?.hidden && !state.submitting) closeForm();
  });

  for (const button of els.themeButtons) {
    button.addEventListener('click', () => {
      setSelectedTheme(button.dataset.theme || 'pink');
    });
  }

  for (const button of els.iconButtons) {
    button.addEventListener('click', () => {
      setSelectedIcon(button.dataset.icon || 'heart');
    });
  }

  if (els.aiOpenButton) {
    els.aiOpenButton.disabled = false;
    els.aiOpenButton.addEventListener('click', openAiModal);
  }

  els.aiCloseButton?.addEventListener('click', closeAiModal);
  els.aiBackdrop?.addEventListener('click', closeAiModal);

  els.aiRequestButton?.addEventListener('click', () => {
    const forceRefresh = state.hasRequestedAi;
    requestAiSuggestions(forceRefresh);
  });

  for (const button of els.aiTargetButtons) {
    button.addEventListener('click', () => {
      setAiTarget(button.dataset.aiTarget || 'groom');
      handleAiSelectionChanged();
    });
  }

  for (const button of els.aiVersionButtons) {
    button.addEventListener('click', () => {
      setAiVersion(button.dataset.aiVersion || 'friend');
      handleAiSelectionChanged();
    });
  }

  els.aiList?.addEventListener('click', async (event) => {
    const copyButton = event.target.closest('[data-ai-copy-index]');
    const applyButton = event.target.closest('[data-ai-apply-index]');

    if (copyButton) {
      const text = state.aiSuggestions[Number(copyButton.dataset.aiCopyIndex)];
      if (text) {
        await copyToClipboard(text, '추천 문구를 복사했습니다.');
      }
      return;
    }

    if (applyButton) {
      const text = state.aiSuggestions[Number(applyButton.dataset.aiApplyIndex)];
      if (!text) return;

      if (els.messageInput) {
        els.messageInput.value = text;
      }

      closeAiModal();
      els.messageInput?.focus();
      showToast('추천 문구를 입력했습니다.');
    }
  });
}

export async function initGuestbook() {
  cacheElements();

  if (!els.root) {
    return;
  }

  bindEvents();
  closeForm();
  await loadGuestbook();
}

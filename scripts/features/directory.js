import { supabaseClient } from '../supabaseClient.js';
import { APP_CONFIG } from '../../config.js';

const CONTACTS_TABLE = 'wedding_contacts';
const ACCOUNTS_TABLE = 'wedding_accounts';
let accordionSequence = 0;

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined && text !== null) element.textContent = text;
  return element;
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^0-9+]/g, '');
}

function createAccordion(side, title, content) {
  const group = createElement('section', `directory-group directory-group-${side}`);
  const panelId = `directory-panel-${side}-${accordionSequence++}`;
  const toggle = createElement('button', 'directory-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', panelId);
  toggle.append(
    createElement('span', 'directory-toggle-title', title),
    createElement('span', 'directory-toggle-icon', '⌄')
  );

  const panel = createElement('div', 'directory-panel');
  panel.id = panelId;
  panel.hidden = true;
  panel.append(content);
  toggle.addEventListener('click', () => {
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    toggle.setAttribute('aria-expanded', String(willOpen));
  });
  group.append(toggle, panel);
  return group;
}

function groupBySide(items) {
  return {
    groom: items.filter((item) => item.side === 'groom'),
    bride: items.filter((item) => item.side === 'bride')
  };
}

function createContactCard(contact) {
  const card = createElement('article', 'contact-card');
  const top = createElement('div', 'contact-top');
  const copy = createElement('div');
  copy.append(
    createElement('span', 'contact-role', contact.role_label),
    createElement('strong', 'contact-name', contact.name)
  );
  top.append(copy);

  const phone = normalizePhone(contact.phone);
  const copyButton = createElement('button', 'contact-number');
  copyButton.type = 'button';
  copyButton.setAttribute('aria-label', `${contact.phone} 연락처 복사`);
  copyButton.title = '연락처 복사';
  copyButton.append(
    createElement('span', 'contact-number-value', contact.phone),
    createElement('span', 'contact-copy-icon', '⧉')
  );
  copyButton.dataset.copy = phone;
  copyButton.dataset.copyMessage = '연락처가 복사되었습니다.';
  const actions = createElement('div', 'contact-actions');
  const call = createElement('a', 'contact-action', '전화');
  call.setAttribute('aria-label', '전화하기');
  call.href = `tel:${phone}`;
  const message = createElement('a', 'contact-action', '문자');
  message.setAttribute('aria-label', '문자 보내기');
  message.href = `sms:${phone}`;
  actions.append(call, message);
  card.append(top, copyButton, actions);
  return card;
}

function createAccountCard(account) {
  const card = createElement('article', 'account-card');
  const head = createElement('div', 'account-card-head');
  head.append(
    createElement('span', 'account-badge', account.side_label),
    createElement('h3', null, account.account_holder)
  );

  const accountInfo = createElement(
    'p',
    'account-bank-number',
    `${account.bank_name}  ${account.account_number}`
  );

  const copyButton = createElement('button', 'button button-secondary account-copy-btn', '계좌 복사');
  copyButton.type = 'button';
  copyButton.dataset.copy = `${account.bank_name} ${account.account_number} ${account.account_holder}`;
  card.append(head, accountInfo, copyButton);
  return card;
}

function renderGrouped(list, items, titleSuffix, createCard) {
  if (!list || !items.length) return;
  const groups = groupBySide(items);
  list.replaceChildren();
  [['groom', '신랑측'], ['bride', '신부측']].forEach(([side, label]) => {
    if (!groups[side].length) return;
    const cards = createElement('div', 'directory-card-list');
    groups[side].forEach((item) => cards.append(createCard(item)));
    list.append(createAccordion(side, `${label} ${titleSuffix}`, cards));
  });
}

function isCoupleContact(contact) {
  return contact.contact_type === 'couple' || contact.role_label === '신랑' || contact.role_label === '신부';
}

function renderContacts(contacts) {
  const list = document.getElementById('contact-list');
  if (!list || !contacts.length) return;

  const coupleContacts = contacts.filter(isCoupleContact);
  const guardians = contacts.filter((contact) => !isCoupleContact(contact));
  list.replaceChildren();

  if (coupleContacts.length) {
    const coupleList = createElement('div', 'couple-contact-list');
    coupleContacts.forEach((contact) => coupleList.append(createContactCard(contact)));
    list.append(coupleList);
  }

  const guardianGroups = groupBySide(guardians);
  [['groom', '신랑측 혼주'], ['bride', '신부측 혼주']].forEach(([side, label]) => {
    if (!guardianGroups[side].length) return;
    const cards = createElement('div', 'directory-card-list');
    guardianGroups[side].forEach((contact) => cards.append(createContactCard(contact)));
    list.append(createAccordion(side, label, cards));
  });
}

function renderAccounts(accounts) {
  const list = document.getElementById('account-list');
  const section = document.querySelector('.wedding-accounts');
  const displayableAccounts = accounts.filter((account) => String(account.bank_name || '').trim());

  if (!displayableAccounts.length) {
    list?.replaceChildren();
    if (section) section.hidden = true;
    return;
  }

  if (section) section.hidden = false;
  renderGrouped(list, displayableAccounts, '계좌번호', createAccountCard);
}

function setAccountsSectionVisible(enabled) {
  const section = document.querySelector('.wedding-accounts');
  if (section) section.hidden = !enabled;
}

async function loadAccountSectionEnabled() {
  if (!supabaseClient || !APP_CONFIG?.siteKey) return true;
  const { data, error } = await supabaseClient
    .from('wedding_site_settings')
    .select('accounts_enabled')
    .eq('site_key', APP_CONFIG.siteKey)
    .maybeSingle();
  // SQL 적용 전이나 설정 행이 없을 때는 기존처럼 계좌를 표시합니다.
  if (error || !data) return true;
  return data.accounts_enabled !== false;
}

async function loadDirectory() {
  if (!supabaseClient) return;
  const [accountsEnabled, contactsResult] = await Promise.all([
    loadAccountSectionEnabled(),
    supabaseClient.from(CONTACTS_TABLE)
      .select('side, role_label, name, phone, display_order')
      .eq('is_visible', true).order('display_order')
  ]);
  setAccountsSectionVisible(accountsEnabled);
  if (contactsResult.error) console.warn('[directory] contacts load failed', contactsResult.error);
  else renderContacts(contactsResult.data || []);
  if (!accountsEnabled) return;
  const accountsResult = await supabaseClient.from(ACCOUNTS_TABLE)
    .select('side, side_label, bank_name, account_holder, account_number, display_order')
    .eq('is_visible', true).order('display_order');
  if (accountsResult.error) console.warn('[directory] accounts load failed', accountsResult.error);
  else renderAccounts(accountsResult.data || []);
}

export async function initDirectory() {
  try {
    await loadDirectory();
  } catch (error) {
    console.warn('[directory] load failed', error);
  }
}

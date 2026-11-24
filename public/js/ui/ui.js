// DOM UI: 입장, HUD, 작성 모달, 크리스마스 카드, 모아보기, 토스트, 모달 공통
import { ITEM_TYPES, LIMITS } from '../data/catalog.js';
import { authorName, formatDate } from '../util.js';

export const $ = (s, root = document) => root.querySelector(s);
export const el = (tag, attrs = {}, ...children) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  children.flat().forEach((c) => c != null && n.append(c));
  return n;
};

export function toast(msg, ms = 2600) {
  const t = el('div', { class: 'toast', text: msg });
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
}

// ── 모달 공통 ──
const stack = [];
export const modalState = { onChange: null };
export function openModal(id) { const m = document.getElementById(id); if (!m || !m.hidden) return; m.hidden = false; stack.push(id); modalState.onChange?.(true); }
export function closeModal(id) {
  const m = document.getElementById(id); if (!m || m.hidden) return;
  m.hidden = true; const i = stack.lastIndexOf(id); if (i >= 0) stack.splice(i, 1);
  modalState.onChange?.(stack.length > 0); m.dispatchEvent(new CustomEvent('closed'));
}
export const anyModalOpen = () => stack.length > 0;
export function closeTop() { const id = stack[stack.length - 1]; if (id) { closeModal(id); return true; } return false; }
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-close]');
  if (b) closeModal(b.closest('.modal').id);
  else if (e.target.classList?.contains('modal')) closeModal(e.target.id);
});

// ── 입장 ──
export function setupEntry({ owner, defaultName, onEnter, locked = false, mine = false }) {
  let saved = '';
  try { saved = localStorage.getItem('tree-name') || ''; } catch { /* ignore */ }
  $('#entry-title').textContent = mine ? `${owner}님의 오두막` : `${owner}님의 오두막`;
  if (locked) {
    $('#entry .sub').textContent = mine ? '내 트리 아래에 동료들의 선물이 쌓여요. 마을에서 동료의 오두막도 찾아가 보세요 🎄' : `${owner}님 트리 아래에 마음을 담은 선물을 놓고 가세요 🎁`;
    const lbl = $('#entry .field-label'); if (lbl) lbl.hidden = true;
  }
  const input = $('#entry-name'); input.value = defaultName || saved;
  if (locked) { input.readOnly = true; input.classList.add('locked'); $('#enter-btn').textContent = `${defaultName}(으)로 들어가기`; input.hidden = true; }
  const enter = () => {
    const name = input.value.trim().slice(0, LIMITS.authorMax);
    try { localStorage.setItem('tree-name', name); } catch { /* ignore */ }
    $('#entry').hidden = true; onEnter({ name });
  };
  $('#enter-btn').addEventListener('click', enter);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });
  $('#entry').hidden = false;
}

export function setHud({ title, owner, count, sealed, sealUntil, mode }) {
  if (title) { $('#hud-title').textContent = title; document.title = title; }
  if (owner !== undefined) $('#hud-meta').textContent = `${owner}님의 트리 · 🎁 선물 ${count}개${mode === 'local' ? ' · 로컬 모드' : ''}`;
  const s = $('#hud-seal');
  if (sealed !== undefined) { s.hidden = !sealed; if (sealed) s.textContent = `🔒 ${formatDate(sealUntil)}에 열려요`; }
}

// ── 작성 ──
export function setupCompose({ getDefaults, onSubmit }) {
  const form = $('#compose-form'); const grid = $('#type-grid');
  const msg = $('#c-message'); const count = $('#c-count');
  const author = $('#c-author'); const anon = $('#c-anon');
  const err = $('#c-error'); const submit = $('#c-submit');
  let type = 'letter';
  Object.values(ITEM_TYPES).forEach((t) => {
    const b = el('button', { type: 'button', role: 'radio', 'aria-checked': String(t.id === type) }, el('span', { class: 'ic', text: t.icon }), el('span', { text: t.label }));
    b.addEventListener('click', () => { type = t.id; grid.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b))); });
    grid.append(b);
  });
  msg.addEventListener('input', () => { count.textContent = `${msg.value.length}/${LIMITS.messageMax}`; });
  anon.addEventListener('change', () => { author.disabled = anon.checked; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.hidden = true; submit.disabled = true;
    try {
      await onSubmit({ type, author: author.value, anonymous: anon.checked, message: msg.value });
      msg.value = ''; count.textContent = `0/${LIMITS.messageMax}`; closeModal('compose-modal');
    } catch (ex) { err.textContent = ex.message || '저장하지 못했어요.'; err.hidden = false; }
    finally { submit.disabled = false; }
  });
  return {
    open() {
      const d = getDefaults();
      $('#compose-title').textContent = `${d.owner}님 트리 아래 선물 놓기`;
      if (!author.value || d.lockName) author.value = d.name || '';
      author.readOnly = !!d.lockName;
      const note = $('#c-seal-note'); note.hidden = !d.sealed;
      if (d.sealed) note.textContent = `🔒 메시지는 ${formatDate(d.sealUntil)}에 열려요.`;
      err.hidden = true; openModal('compose-modal');
      if (!matchMedia('(pointer: coarse)').matches) setTimeout(() => msg.focus(), 50);
    },
  };
}

// ── 카드 ──
export function showCard(item, { owner, sealUntil, onPrev, onNext }) {
  const t = ITEM_TYPES[item.type];
  $('#card-icon').textContent = t?.icon || '💌';
  $('#card-to').textContent = `To. ${owner}`;
  const m = $('#card-msg');
  if (item.sealed || item.message == null) { m.textContent = `🔒 아직 열 수 없는 메시지예요.\n${formatDate(sealUntil)}에 열려요.`; m.classList.add('sealed'); }
  else { m.textContent = item.message; m.classList.remove('sealed'); }
  $('#card-author').textContent = authorName(item);
  $('#card-date').textContent = formatDate(item.createdAt);
  $('#card-prev').onclick = onPrev; $('#card-next').onclick = onNext;
  openModal('card-modal');
}

// ── 모아보기 ──
export function setupList({ getItems, onPick }) {
  const search = $('#list-search'); const ul = $('#list-items');
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const items = getItems()
      .filter((it) => !q || authorName(it).toLowerCase().includes(q) || (it.message || '').toLowerCase().includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    ul.replaceChildren(...items.map((it) => el('li', { class: 'clickable', onclick: () => onPick(it) },
      el('div', { class: 'li-top' }, el('span', { text: `${ITEM_TYPES[it.type]?.icon} ${authorName(it)}` }), el('span', { text: formatDate(it.createdAt) })),
      el('p', { class: 'li-msg', text: it.sealed ? '🔒 봉인된 메시지' : it.message }))));
    if (!items.length) ul.append(el('li', { class: 'muted', text: '아직 걸린 메시지가 없어요.' }));
  };
  search.addEventListener('input', render);
  return { open() { render(); openModal('list-modal'); } };
}

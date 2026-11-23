// DOM UI: 입장(캐릭터 프리뷰), HUD, 작성 모달, 읽기 카드, 모아보기, 토스트, 모달 공통
import * as THREE from 'three';
import { AVATAR_OPTIONS, ITEM_TYPES, ZONES, LIMITS } from '../data/catalog.js';
import { buildAvatar } from '../world/avatar.js';
import { authorName, formatDate } from '../util.js';

export const $ = (s, el = document) => el.querySelector(s);
const el = (tag, attrs = {}, ...children) => {
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
export { el };

// ── 토스트 ──
export function toast(msg, ms = 2600) {
  const t = el('div', { class: 'toast', text: msg });
  $('#toasts').append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, ms);
}

// ── 모달 공통 ──
const openStack = [];
export const modalState = { onChange: null };
export function openModal(id) {
  const m = document.getElementById(id); if (!m || !m.hidden) return;
  m.hidden = false; openStack.push(id); modalState.onChange?.(true);
}
export function closeModal(id) {
  const m = document.getElementById(id); if (!m || m.hidden) return;
  m.hidden = true;
  const i = openStack.lastIndexOf(id); if (i >= 0) openStack.splice(i, 1);
  modalState.onChange?.(openStack.length > 0);
  m.dispatchEvent(new CustomEvent('closed'));
}
export const anyModalOpen = () => openStack.length > 0;
export function closeTop() { const id = openStack[openStack.length - 1]; if (id) { closeModal(id); return true; } return false; }
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('[data-close]');
  if (closeBtn) closeModal(closeBtn.closest('.modal').id);
  else if (e.target.classList?.contains('modal')) closeModal(e.target.id);
});

// 라디오 칩 그룹
function radioGroup(container, options, value, onChange, render) {
  container.replaceChildren();
  options.forEach((o) => {
    const b = render(o);
    b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(o.id === value));
    b.addEventListener('click', () => {
      container.querySelectorAll('[role=radio]').forEach((x) => x.setAttribute('aria-checked', 'false'));
      b.setAttribute('aria-checked', 'true'); onChange(o.id);
    });
    container.append(b);
  });
}

// ── 입장 화면 + 캐릭터 프리뷰 ──
export function setupEntry({ room, defaultName, onEnter }) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('sansa-avatar')) || {}; } catch { /* ignore */ }
  const state = {
    body: saved.body || 'monk',
    color: saved.color || AVATAR_OPTIONS.color[0],
    hat: saved.hat || 'santa',
    name: defaultName || saved.name || '',
  };
  $('#entry-room').textContent = `${room.toUpperCase()} 마을`;
  const nameInput = $('#entry-name'); nameInput.value = state.name;

  // 프리뷰 렌더러 (입장 후 dispose)
  const canvas = $('#preview');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  cam.position.set(0, 1.25, 4.4); cam.lookAt(0, 0.75, 0);
  scene.add(new THREE.HemisphereLight('#c9d4ff', '#4a3b5a', 1.4));
  const key = new THREE.DirectionalLight('#fff1dc', 2); key.position.set(2, 4, 3); scene.add(key);
  const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.2, 0.16, 32), new THREE.MeshStandardMaterial({ color: '#eef2fb' }));
  disk.position.y = -0.08; scene.add(disk);
  let avatar; let rot = 0.4; let drag = null; let raf;
  const rebuild = () => { if (avatar) scene.remove(avatar); avatar = buildAvatar(state); scene.add(avatar); };
  rebuild();
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (drag !== null) { rot += (e.clientX - drag) * 0.012; drag = e.clientX; } });
  canvas.addEventListener('pointerup', () => { drag = null; });
  const loop = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (drag === null) rot += 0.008;
    avatar.rotation.y = rot;
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  loop();

  radioGroup($('#opt-body'), AVATAR_OPTIONS.body, state.body, (v) => { state.body = v; rebuild(); }, (o) => el('button', { text: o.label }));
  radioGroup($('#opt-hat'), AVATAR_OPTIONS.hat, state.hat, (v) => { state.hat = v; rebuild(); }, (o) => el('button', { text: o.label }));
  radioGroup($('#opt-color'), AVATAR_OPTIONS.color.map((c) => ({ id: c })), state.color, (v) => { state.color = v; rebuild(); },
    (o) => el('button', { style: `background:${o.id}`, 'aria-label': o.id, title: o.id }));

  const enter = () => {
    state.name = nameInput.value.trim().slice(0, LIMITS.authorMax);
    try { localStorage.setItem('sansa-avatar', JSON.stringify(state)); } catch { /* ignore */ }
    cancelAnimationFrame(raf);
    renderer.dispose(); renderer.forceContextLoss();
    $('#entry').hidden = true;
    onEnter({ ...state });
  };
  $('#enter-btn').addEventListener('click', enter);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });
  $('#entry').hidden = false;
}

// ── HUD ──
export function setHud({ title, room, count, online, sealed, sealUntil, mode }) {
  if (title) { $('#hud-title').textContent = title; document.title = title; }
  if (room) $('#hud-room').textContent = `${room} 마을`;
  if (count) $('#hud-count').textContent = `🏮 ${count.lantern} · 💌 ${count.other}`;
  if (online !== undefined) $('#hud-online').textContent = mode === 'local' ? '로컬 모드' : `👥 ${online}명 접속`;
  const s = $('#hud-seal');
  if (sealed !== undefined) {
    s.hidden = !sealed;
    if (sealed) s.textContent = `🔒 봉인 중 · ${formatDate(sealUntil)}에 열려요`;
  }
}

// ── 작성 모달 ──
export function setupCompose({ getDefaults, onSubmit }) {
  const form = $('#compose-form');
  const grid = $('#type-grid'); const zones = $('#zone-chips');
  const msg = $('#c-message'); const count = $('#c-count');
  const author = $('#c-author'); const anon = $('#c-anon');
  const err = $('#c-error'); const submit = $('#c-submit');
  const st = { type: 'santa_lantern', zone: 'string' };

  const renderZones = () => {
    const t = ITEM_TYPES[st.type];
    if (!t.zones.includes(st.zone)) st.zone = t.zones[0];
    radioGroup(zones, t.zones.map((z) => ZONES[z]), st.zone, (v) => { st.zone = v; }, (o) => el('button', { text: `${o.icon} ${o.label}`, title: o.desc }));
  };
  radioGroup(grid, Object.values(ITEM_TYPES), st.type, (v) => { st.type = v; renderZones(); },
    (o) => el('button', {}, el('span', { class: 'ic', text: o.icon }), el('span', { text: o.label })));
  renderZones();

  msg.addEventListener('input', () => { count.textContent = `${msg.value.length}/${LIMITS.messageMax}`; });
  anon.addEventListener('change', () => { author.disabled = anon.checked; });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true; submit.disabled = true;
    try {
      await onSubmit({ type: st.type, zone: st.zone, author: author.value, anonymous: anon.checked, message: msg.value });
      msg.value = ''; count.textContent = `0/${LIMITS.messageMax}`;
      closeModal('compose-modal');
    } catch (ex) {
      err.textContent = ex.message || '저장하지 못했어요. 잠시 후 다시 시도해 주세요.'; err.hidden = false;
    } finally { submit.disabled = false; }
  });

  return {
    open(preset = {}) {
      const d = getDefaults();
      if (!author.value) author.value = d.name || '';
      const sealNote = $('#c-seal-note');
      sealNote.hidden = !d.sealed;
      if (d.sealed) sealNote.textContent = `🔒 봉인 모드: 메시지는 ${formatDate(d.sealUntil)} 이후에 모두에게 공개돼요.`;
      if (preset.type && ITEM_TYPES[preset.type]) {
        st.type = preset.type;
        grid.querySelectorAll('[role=radio]').forEach((b, i) => b.setAttribute('aria-checked', String(Object.keys(ITEM_TYPES)[i] === st.type)));
      }
      if (preset.zone) st.zone = preset.zone;
      renderZones();
      err.hidden = true;
      openModal('compose-modal');
      setTimeout(() => msg.focus(), 50);
    },
  };
}

// ── 읽기 카드 ──
export function showCard(item, { sealUntil, onPrev, onNext }) {
  const t = ITEM_TYPES[item.type];
  $('#card-icon').textContent = t?.icon || '💌';
  $('#card-type').textContent = `${t?.label || ''} · ${ZONES[item.zone]?.label || ''}`;
  const m = $('#card-msg');
  if (item.sealed || item.message == null) {
    m.textContent = `🔒 봉인된 메시지예요.\n${formatDate(sealUntil)}에 열려요.`;
    m.classList.add('sealed');
  } else { m.textContent = item.message; m.classList.remove('sealed'); }
  $('#card-author').textContent = authorName(item);
  $('#card-date').textContent = formatDate(item.createdAt);
  $('#card-prev').onclick = onPrev; $('#card-next').onclick = onNext;
  openModal('card-modal');
}

// ── 모아보기 ──
export function setupList({ getItems, onPick }) {
  const filterEl = $('#list-filter'); const search = $('#list-search'); const ul = $('#list-items');
  let zone = 'all';
  const zonesOpt = [{ id: 'all', label: '전체', icon: '' }, ...Object.values(ZONES)];
  radioGroup(filterEl, zonesOpt, zone, (v) => { zone = v; render(); }, (o) => el('button', { text: `${o.icon} ${o.label}`.trim() }));
  const render = () => {
    const q = search.value.trim().toLowerCase();
    const items = getItems()
      .filter((it) => zone === 'all' || it.zone === zone)
      .filter((it) => !q || authorName(it).toLowerCase().includes(q) || (it.message || '').toLowerCase().includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    ul.replaceChildren(...items.map((it) => el('li', { class: 'clickable', onclick: () => onPick(it) },
      el('div', { class: 'li-top' }, el('span', { text: `${ITEM_TYPES[it.type]?.icon} ${authorName(it)}` }), el('span', { text: formatDate(it.createdAt) })),
      el('p', { class: 'li-msg', text: it.sealed ? '🔒 봉인된 메시지' : it.message }))));
    if (!items.length) ul.append(el('li', { class: 'muted', text: '아직 걸린 소원이 없어요.' }));
  };
  search.addEventListener('input', render);
  return { open() { render(); openModal('list-modal'); }, render };
}

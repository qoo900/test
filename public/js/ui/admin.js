// 운영진 관리 패널: 로그인 → 봉인 모드 설정 / 메시지 숨김·보관·복원·삭제 / 중복 탐지 / JSON 내보내기
import { ITEM_TYPES } from '../data/catalog.js';
import { authorName, formatDate, formatDateTimeLocal } from '../util.js';
import { $, el, openModal, toast } from './ui.js';

export function setupAdmin({ api, onStateChange }) {
  let state = null;
  let filter = 'all';
  const body = $('#admin-body'); const login = $('#admin-login');
  $('#admin-mode-note').textContent = api.mode === 'local'
    ? '로컬 모드: 이 브라우저에만 적용됩니다. (데모 비밀번호: tree2026)'
    : '서버의 ADMIN_PASSWORD 환경 변수로 설정된 비밀번호를 입력하세요.';

  const refresh = async (newState) => {
    state = newState || await api.getState({ admin: true });
    $('#seal-toggle').checked = !!state.settings.sealEnabled;
    $('#seal-until').value = formatDateTimeLocal(state.settings.sealUntil);
    const c = { visible: 0, hidden: 0, archived: 0 };
    state.items.forEach((it) => { c[it.status] = (c[it.status] || 0) + 1; });
    $('#admin-stats').textContent = `전체 ${state.items.length}개 · 공개 ${c.visible} · 숨김 ${c.hidden} · 보관 ${c.archived}`;
    renderList();
    onStateChange?.();
  };

  const statusLabel = { visible: '공개', hidden: '숨김', archived: '보관' };
  const filters = [{ id: 'all', label: '전체' }, { id: 'visible', label: '공개' }, { id: 'hidden', label: '숨김' }, { id: 'archived', label: '보관' }, { id: 'dup', label: '중복 의심' }];
  const fEl = $('#admin-filter');
  filters.forEach((f) => fEl.append(el('button', { type: 'button', text: f.label, class: f.id === filter ? 'on' : '', onclick: (e) => { filter = f.id; fEl.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.target.classList.add('on'); renderList(); } })));
  $('#admin-search').addEventListener('input', () => renderList());

  const act = async (fn, okMsg) => {
    try { await refresh(await fn()); if (okMsg) toast(okMsg); } catch (e) { toast(`⚠️ ${e.message}`); }
  };

  function renderList() {
    if (!state) return;
    const q = $('#admin-search').value.trim().toLowerCase();
    const norm = (s) => (s || '').replace(/\s+/g, '').toLowerCase();
    const counts = new Map();
    state.items.forEach((it) => counts.set(norm(it.message), (counts.get(norm(it.message)) || 0) + 1));
    const items = state.items
      .filter((it) => filter === 'all' || (filter === 'dup' ? counts.get(norm(it.message)) > 1 : it.status === filter))
      .filter((it) => !q || authorName(it).toLowerCase().includes(q) || (it.message || '').toLowerCase().includes(q))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    const ul = $('#admin-items');
    ul.replaceChildren(...items.map((it) => {
      const btn = (label, fn, cls = '') => el('button', { type: 'button', class: `btn ${cls}`, text: label, onclick: fn });
      const actions = [];
      if (it.status !== 'visible') actions.push(btn('복원', () => act(() => api.setItemStatus(it.id, 'visible'), '복원했어요')));
      if (it.status !== 'hidden') actions.push(btn('숨김', () => act(() => api.setItemStatus(it.id, 'hidden'), '숨겼어요')));
      if (it.status !== 'archived') actions.push(btn('보관', () => act(() => api.setItemStatus(it.id, 'archived'), '보관함으로 옮겼어요')));
      actions.push(btn('삭제', () => { if (confirm('이 메시지를 완전히 삭제할까요? 되돌릴 수 없습니다.')) act(() => api.deleteItem(it.id), '삭제했어요'); }, 'btn-danger'));
      return el('li', {},
        el('div', { class: 'li-top' },
          el('span', { text: `${ITEM_TYPES[it.type]?.icon || ''} ${authorName(it)} · ${formatDate(it.createdAt)}` }),
          el('span', {}, counts.get(norm(it.message)) > 1 ? el('span', { class: 'dup', text: '중복 ' }) : null, el('span', { class: `status ${it.status}`, text: statusLabel[it.status] }))),
        el('p', { class: 'li-msg', text: it.message ?? '' }),
        el('div', { class: 'li-actions' }, actions));
    }));
    if (!items.length) ul.append(el('li', { class: 'muted', text: '해당하는 메시지가 없습니다.' }));
  }

  login.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#admin-error'); err.hidden = true;
    try {
      await api.adminLogin($('#admin-pw').value);
      $('#admin-pw').value = '';
      login.hidden = true; body.hidden = false;
      await refresh();
      toast('운영진 모드로 전환했어요');
    } catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });

  $('#seal-save').addEventListener('click', () => {
    const v = $('#seal-until').value;
    act(() => api.updateSettings({ sealEnabled: $('#seal-toggle').checked, sealUntil: v ? new Date(v).toISOString() : undefined }), '봉인 설정을 저장했어요');
  });
  $('#seal-toggle').addEventListener('change', () => $('#seal-save').click());

  $('#invite-section').hidden = api.mode !== 'server';
  $('#invite-make').addEventListener('click', async () => {
    try {
      const { link } = await api.adminInvite($('#invite-name').value);
      const box = $('#invite-link'); box.value = link; box.hidden = false; box.select();
      try { await navigator.clipboard.writeText(link); toast('입장 링크를 복사했어요'); } catch { toast('링크를 길게 눌러 복사해 주세요'); }
    } catch (e) { toast(`⚠️ ${e.message}`); }
  });
  $('#admin-logout').addEventListener('click', () => { api.adminLogout(); state = null; body.hidden = true; login.hidden = false; toast('로그아웃했어요'); });

  $('#admin-export').addEventListener('click', () => {
    if (!state) return;
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `wishtree-${state.room}-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  return {
    open() { openModal('admin-modal'); if (state) refresh(); },
  };
}

// 진입점: 화면(사진 배경 모드 / 3D 모드) 선택, 데이터 동기화, UI 연결
//  - public/assets/tree.jpg 가 있으면 사진 배경 모드 (가볍고 예쁨)
//  - 없으면 코드로 그린 3D 거실 모드
import { CONFIG } from './config.js';
import { ITEM_TYPES } from './data/catalog.js';
import { createApi } from './net/api.js';
import { sound } from './audio/sound.js';
import { buildPhotoScene, photoAvailable } from './photo/photoScene.js';
import { $, toast, setupEntry, setHud, setupCompose, showCard, setupList, closeModal, closeTop, anyModalOpen, modalState, openModal } from './ui/ui.js';
import { setupAdmin } from './ui/admin.js';

const low = CONFIG.isTouch || (navigator.deviceMemory && navigator.deviceMemory < 4);
if (CONFIG.isTouch) document.body.classList.add('touch');
let view = null; let nearTree = false; let nearDoor = false;
let api; let state = { items: [], settings: {}, sealed: false }; const me = { name: '' }; let entered = false;
let myInfo = null; let myRoom = null; // 서버 모드: 입장 토큰의 주인과 그 사람의 방
const isMine = () => !myRoom || api.room === myRoom;
const owner = () => state.settings.owner || '친구';
const visibleItems = () => state.items.filter((it) => it.status === 'visible');
const sig = (items) => items.map((i) => `${i.id}:${i.status}:${i.message ? 1 : 0}`).join('|');

function applyState(next) {
  const changed = sig(next.items) !== sig(state.items);
  state = next;
  if (changed) view?.sync(state.items);
  setHud({ title: state.settings.title, owner: owner(), count: visibleItems().length, sealed: state.sealed, sealUntil: state.settings.sealUntil, mode: api.mode });
}
async function refresh() { try { applyState(await api.getState()); } catch (e) { console.warn('[sync]', e.message); } }

function openItem(id) {
  if (!entered) return;
  const item = state.items.find((i) => i.id === id);
  if (!item) { toast('메시지를 찾을 수 없어요'); return; }
  view.highlight(id); sound.ding();
  const list = visibleItems().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const idx = list.findIndex((i) => i.id === id);
  closeModal('card-modal');
  showCard(item, {
    owner: owner(), sealUntil: state.settings.sealUntil,
    onPrev: () => openItem(list[(idx - 1 + list.length) % list.length].id),
    onNext: () => openItem(list[(idx + 1) % list.length].id),
  });
}
$('#card-modal').addEventListener('closed', () => { if (!anyModalOpen()) view.unfocus(); });
modalState.onChange = (open) => view?.setEnabled?.(!open);

const compose = setupCompose({
  getDefaults: () => ({ name: me.name, lockName: !!myInfo, owner: owner(), sealed: state.sealed, sealUntil: state.settings.sealUntil }),
  onSubmit: async (input) => {
    const item = await api.addItem(input);
    applyState({ ...state, items: [...state.items, item] });
    sound.sparkle();
    setTimeout(() => view.highlight(item.id), 100);
    // 새 장식을 보여준 뒤 원래 자리로 (창이 열려 있으면 닫힐 때까지 기다렸다가)
    const release = () => { if (anyModalOpen()) setTimeout(release, 500); else view.unfocus(); };
    setTimeout(release, 3500);
    toast('🎁 트리 아래에 선물을 놓았어요!');
  },
});
const list = setupList({ getItems: visibleItems, onPick: (it) => { closeModal('list-modal'); openItem(it.id); } });
// 트리 근처(약 2.5m)에서만 선물 놓기·메시지 읽기 버튼이 보임
function syncNearUi() {
  const room = document.body.classList.contains('room-mode');
  const on = entered && (nearTree || !room);
  $('#btn-compose').hidden = !on;
  $('#btn-read').hidden = !(entered && nearTree);
  $('#near-hint').hidden = !(entered && room && !nearTree && !nearDoor);
  $('#btn-exit').hidden = !(entered && room && nearDoor);
}
$('#btn-compose').addEventListener('click', () => compose.open());
// 현관문: 나가기 확인 → 나간 뒤 화면 → 다시 들어가기
$('#btn-exit').addEventListener('click', () => { $('#exit-title').textContent = isMine() ? '내 오두막에서 나가 마을로 갈까요?' : `${owner()}님의 방에서 나가시겠습니까?`; openModal('exit-modal'); });
$('#exit-confirm').addEventListener('click', () => {
  if (api.mode === 'server' && myInfo) { closeModal('exit-modal'); openVillage(); return; }
  closeModal('exit-modal'); sound.stopMusic(); sound.ctx?.suspend?.(); view.setEnabled?.(false);
  document.body.classList.add('bye'); $('#hud').hidden = true; $('#btn-exit').hidden = true;
  $('#bye-title').textContent = `${owner()}님의 방을 나왔어요`; $('#bye').hidden = false; entered = false;
});
$('#bye-back').addEventListener('click', () => {
  $('#bye').hidden = true; document.body.classList.remove('bye'); $('#hud').hidden = false; entered = true;
  sound.init(); view.setEnabled?.(true); if (musicPref) sound.startMusic();
  view.stepAwayFromDoor?.(); syncNearUi();
});
// 트리 근처에서: 최근 메시지부터 카드로 (이전/다음으로 넘기기)
$('#btn-read').addEventListener('click', () => { const l = visibleItems().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)); if (l.length) openItem(l[0].id); else toast('아직 받은 메시지가 없어요. 첫 선물을 놓아 보세요 🎁'); });
$('#btn-list').addEventListener('click', () => list.open());

// ── 마을: 동료들의 오두막 목록 ──
const goRoom = (id) => { const q = new URLSearchParams(location.search); if (id === myRoom) q.delete('room'); else q.set('room', id); location.search = q.toString(); };
async function openVillage() {
  openModal('village-modal');
  const ul = $('#village-list'); ul.innerHTML = '<li class="muted">마을을 불러오는 중…</li>';
  try {
    const rooms = await api.village();
    const render = () => {
      const q = $('#village-search').value.trim().toLowerCase();
      const rows = rooms.filter((r) => !q || r.name.toLowerCase().includes(q))
        .sort((a, b) => (a.id === myRoom ? -1 : b.id === myRoom ? 1 : a.name.localeCompare(b.name, 'ko')));
      ul.replaceChildren(...rows.map((r) => {
        const li = document.createElement('li'); li.className = 'clickable village-row' + (r.id === api.room ? ' here' : '');
        const nm = document.createElement('span'); nm.className = 'v-name'; nm.textContent = (r.id === myRoom ? '🏠 ' : '🎄 ') + r.name + (r.id === myRoom ? ' (내 오두막)' : '');
        const ct = document.createElement('span'); ct.className = 'v-count'; ct.textContent = r.count ? `🎁 ${r.count}` : '아직 선물 없음';
        li.append(nm, ct); li.addEventListener('click', () => goRoom(r.id)); return li;
      }));
      if (!rows.length) ul.innerHTML = '<li class="muted">찾는 동료가 없어요. 아직 /산타 를 입력하지 않았을 수 있어요.</li>';
    };
    $('#village-search').oninput = render; render();
    $('#village-count').textContent = `오두막 ${rooms.length}채`;
  } catch (e) { ul.innerHTML = `<li class="muted">${e.message}</li>`; }
}
$('#btn-village').addEventListener('click', openVillage);
$('#village-home').addEventListener('click', () => goRoom(myRoom));

// 입장 링크가 없을 때
function showGate() {
  $('#entry').hidden = false; document.body.classList.add('gate');
  $('#entry-title').textContent = '우리의 소원트리';
  $('#entry .sub').textContent = '슬랙에서 /산타 를 입력하면 내 오두막 입장 링크가 도착해요 🎄';
  ['#entry-name', '#enter-btn', '#entry .field-label', '#entry .small'].forEach((q) => { const e = $(q); if (e) e.hidden = true; });
  setTimeout(() => { $('#loading').style.opacity = '0'; setTimeout(() => $('#loading')?.remove(), 600); }, 150);
}
const soundBtn = $('#btn-sound');
const syncSound = () => { soundBtn.textContent = sound.muted ? '🔇' : '🔊'; };
soundBtn.addEventListener('click', () => { sound.init(); sound.setMuted(!sound.muted); syncSound(); }); syncSound();
const musicBtn = $('#btn-music');
let musicPref = true; try { musicPref = localStorage.getItem('tree-music') !== '0'; } catch { /* ignore */ }
const syncMusic = () => { musicBtn.style.opacity = musicPref ? '1' : '.45'; musicBtn.title = musicPref ? '캐럴 끄기' : '캐럴 켜기'; };
musicBtn.addEventListener('click', () => {
  sound.init(); musicPref = !musicPref;
  try { localStorage.setItem('tree-music', musicPref ? '1' : '0'); } catch { /* ignore */ }
  if (musicPref) sound.startMusic(); else sound.stopMusic(); syncMusic();
}); syncMusic();
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!closeTop()) view?.unfocus(); return; }
  if (entered && !anyModalOpen() && e.key === 'Enter' && !$('#btn-compose').hidden && !e.target.closest?.('input,textarea')) { e.preventDefault(); compose.open(); }
});

(async function start() {
  const { modelAvailable } = await import('./room/roomView.js').catch(() => ({ modelAvailable: async () => false }));
  const forced = new URLSearchParams(location.search).get('view'); // ?view=room|photo|3d
  const [apiObj, hasModel, hasPhoto] = await Promise.all([createApi(), forced && forced !== 'room' ? false : modelAvailable(), photoAvailable()]);
  api = apiObj;
  const app = $('#app');
  if (hasModel && (!forced || forced === 'room')) {
    document.body.classList.add('room-mode');
    const { buildRoomView } = await import('./room/roomView.js');
    view = buildRoomView(app, { low, onPick: openItem, onNear: (n) => { nearTree = n; syncNearUi(); }, onNearDoor: (n) => { nearDoor = n; syncNearUi(); }, canInteract: () => entered && !anyModalOpen() });
    // 낮·밤 선택: ?time=day|night > 저장된 선택 > 기본 밤
    let saved = null; try { saved = localStorage.getItem('tree-time'); } catch { /* ignore */ }
    const initial = new URLSearchParams(location.search).get('time') || saved || 'night';
    const timeBtn = $('#btn-time');
    const syncTimeBtn = () => { const day = view.time === 'day'; timeBtn.textContent = day ? '☀️' : '🌙'; timeBtn.title = day ? '밤으로 바꾸기' : '낮으로 바꾸기'; };
    view.applyTime(initial === 'day' ? 'day' : 'night'); syncTimeBtn();
    timeBtn.addEventListener('click', () => {
      const next = view.time === 'day' ? 'night' : 'day';
      view.setTime(next); try { localStorage.setItem('tree-time', next); } catch { /* ignore */ }
      setTimeout(syncTimeBtn, 400); toast(next === 'day' ? '☀️ 낮으로 바꿨어요' : '🌙 밤으로 바꿨어요');
    });
  } else if (hasPhoto && forced !== '3d') {
    document.body.classList.add('photo-mode');
    view = buildPhotoScene(app, { onPick: openItem });
  } else {
    const { build3DView } = await import('./view3d.js'); // 3D 코드는 필요할 때만 로드
    view = build3DView(app, { low, onPick: openItem, canInteract: () => entered && !anyModalOpen() });
  }
  // 서버 모드(슬랙 입장): 입장 링크 확인 → 내 방 / 주소로 지정한 방
  if (api.mode === 'server' && api.requiresAuth) {
    myInfo = await api.me();
    if (!myInfo) { showGate(); return; }
    me.name = myInfo.user.name; myRoom = myInfo.room;
    api.room = CONFIG.roomParam || myRoom;
    document.body.classList.add('auth');
  }
  try { applyState(await api.getState()); view.sync(state.items); } catch (e) { toast(`⚠️ 방을 불러오지 못했어요: ${e.message}`); }
  setTimeout(() => { $('#loading').style.opacity = '0'; setTimeout(() => $('#loading').remove(), 600); }, 150);
  const admin = setupAdmin({ api, onStateChange: refresh });
  $('#btn-admin').addEventListener('click', () => admin.open());
  setupEntry({
    owner: owner(), defaultName: myInfo ? me.name : CONFIG.user, locked: !!myInfo, mine: isMine(),
    onEnter: ({ name }) => {
      me.name = myInfo ? me.name : name; entered = true; sound.init();
      document.body.classList.add('entered');
      syncNearUi();
      if (musicPref) setTimeout(() => sound.startMusic(), 1500);
      setTimeout(() => { if (!sound.running && !sound.muted) toast('🔈 화면을 한 번 누르면 소리가 나와요', 4000); }, 1200);
      $('#hud').hidden = false;
      setTimeout(() => { $('#hint').classList.add('gone'); $('#walk-hint').classList.add('gone'); }, 8000);
      if (CONFIG.itemId) setTimeout(() => openItem(CONFIG.itemId), 500);
      if (api.mode === 'server') setInterval(() => { if (!document.hidden) refresh(); }, CONFIG.pollItemsMs);
    },
  });
})();

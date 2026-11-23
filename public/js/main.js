// 진입점: 화면(사진 배경 모드 / 3D 모드) 선택, 데이터 동기화, UI 연결
//  - public/assets/tree.jpg 가 있으면 사진 배경 모드 (가볍고 예쁨)
//  - 없으면 코드로 그린 3D 거실 모드
import { CONFIG } from './config.js';
import { ITEM_TYPES } from './data/catalog.js';
import { createApi } from './net/api.js';
import { sound } from './audio/sound.js';
import { buildPhotoScene, photoAvailable } from './photo/photoScene.js';
import { $, toast, setupEntry, setHud, setupCompose, showCard, setupList, closeModal, closeTop, anyModalOpen, modalState } from './ui/ui.js';
import { setupAdmin } from './ui/admin.js';

const low = CONFIG.isTouch || (navigator.deviceMemory && navigator.deviceMemory < 4);
if (CONFIG.isTouch) document.body.classList.add('touch');
let view = null;
let api; let state = { items: [], settings: {}, sealed: false }; const me = { name: '' }; let entered = false;
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
  getDefaults: () => ({ name: me.name, owner: owner(), sealed: state.sealed, sealUntil: state.settings.sealUntil }),
  onSubmit: async (input) => {
    const item = await api.addItem(input);
    applyState({ ...state, items: [...state.items, item] });
    sound.sparkle();
    setTimeout(() => view.highlight(item.id), 100);
    setTimeout(() => { if (!anyModalOpen()) view.unfocus(); }, 3500);
    toast(`${ITEM_TYPES[item.type].icon} 트리에 걸었어요!`);
  },
});
const list = setupList({ getItems: visibleItems, onPick: (it) => { closeModal('list-modal'); openItem(it.id); } });
$('#btn-compose').addEventListener('click', () => compose.open());
$('#btn-list').addEventListener('click', () => list.open());
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
  if (entered && !anyModalOpen() && e.key === 'Enter' && !e.target.closest?.('input,textarea')) { e.preventDefault(); compose.open(); }
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
    view = buildRoomView(app, { low, onPick: openItem, canInteract: () => entered && !anyModalOpen() });
  } else if (hasPhoto && forced !== '3d') {
    document.body.classList.add('photo-mode');
    view = buildPhotoScene(app, { onPick: openItem });
  } else {
    const { build3DView } = await import('./view3d.js'); // 3D 코드는 필요할 때만 로드
    view = build3DView(app, { low, onPick: openItem, canInteract: () => entered && !anyModalOpen() });
  }
  try { applyState(await api.getState()); view.sync(state.items); } catch (e) { toast(`⚠️ 데이터를 불러오지 못했어요: ${e.message}`); }
  setTimeout(() => { $('#loading').style.opacity = '0'; setTimeout(() => $('#loading').remove(), 600); }, 150);
  const admin = setupAdmin({ api, onStateChange: refresh });
  $('#btn-admin').addEventListener('click', () => admin.open());
  setupEntry({
    owner: owner(), defaultName: CONFIG.user,
    onEnter: ({ name }) => {
      me.name = name; entered = true; sound.init();
      document.body.classList.add('entered');
      if (musicPref) setTimeout(() => sound.startMusic(), 1500);
      $('#hud').hidden = false;
      setTimeout(() => { $('#hint').classList.add('gone'); $('#walk-hint').classList.add('gone'); }, 8000);
      if (CONFIG.itemId) setTimeout(() => openItem(CONFIG.itemId), 500);
      if (api.mode === 'server') setInterval(() => { if (!document.hidden) refresh(); }, CONFIG.pollItemsMs);
    },
  });
})();

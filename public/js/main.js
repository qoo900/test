// 우리의 소원트리 - 진입점: 오두막 거실 씬, 데이터 동기화, 장식 선택, UI 연결
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { ITEM_TYPES } from './data/catalog.js';
import { createApi } from './net/api.js';
import { sound } from './audio/sound.js';
import { buildCabin } from './world/cabin.js';
import { buildTree } from './world/tree.js';
import { DecorationManager } from './world/decorations.js';
import { RoomCamera } from './world/camera.js';
import { TREE_POS } from './world/slots.js';
import { $, toast, setupEntry, setHud, setupCompose, showCard, setupList, closeModal, closeTop, anyModalOpen, modalState } from './ui/ui.js';
import { setupAdmin } from './ui/admin.js';

// 저사양 기기: 픽셀 비율 낮추고 안티앨리어싱/눈 파티클 줄임
const low = CONFIG.isTouch || (navigator.deviceMemory && navigator.deviceMemory < 4);
const quality = { snow: low ? 90 : 180 };

const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: low ? 'low-power' : 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
$('#app').append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
const cabin = buildCabin(scene, { quality });
const tree = buildTree(scene);
const decorations = new DecorationManager(scene);
const cam = new RoomCamera(camera, renderer.domElement, { onTap: handleTap });

const isPortrait = () => innerWidth / innerHeight < 0.8;
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = isPortrait() ? 62 : 50;
  camera.updateProjectionMatrix();
  cam.setHome(isPortrait());
}
addEventListener('resize', onResize); onResize(); cam.snap();
modalState.onChange = (open) => { cam.enabled = !open; };

let api; let state = { items: [], settings: {}, sealed: false }; const me = { name: '' }; let entered = false;
const owner = () => state.settings.owner || '친구';
const visibleItems = () => state.items.filter((it) => it.status === 'visible');
const sig = (items) => items.map((i) => `${i.id}:${i.status}:${i.message ? 1 : 0}`).join('|');

function applyState(next) {
  const changed = sig(next.items) !== sig(state.items);
  state = next;
  if (changed) decorations.sync(state.items);
  setHud({ title: state.settings.title, owner: owner(), count: visibleItems().length, sealed: state.sealed, sealUntil: state.settings.sealUntil, mode: api.mode });
}
async function refresh() { try { applyState(await api.getState()); } catch (e) { console.warn('[sync]', e.message); } }

// ── 선택 ──
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function handleTap(x, y) {
  if (!entered || anyModalOpen()) return;
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(decorations.hits, false)[0];
  if (hit) openItem(hit.object.userData.itemId);
}

function focusItem(id) {
  const pos = decorations.worldPos(id); if (!pos) return;
  // 트리 중심 → 장식 방향 바깥쪽에서 바라보기
  cam.setFocus(pos, Math.atan2(pos.x - TREE_POS.x, pos.z - TREE_POS.z));
  decorations.highlight(id);
}

function openItem(id) {
  const item = decorations.get(id) || state.items.find((i) => i.id === id);
  if (!item) { toast('메시지를 찾을 수 없어요'); return; }
  focusItem(id); sound.ding();
  const list = visibleItems().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const idx = list.findIndex((i) => i.id === id);
  closeModal('card-modal');
  showCard(item, {
    owner: owner(), sealUntil: state.settings.sealUntil,
    onPrev: () => openItem(list[(idx - 1 + list.length) % list.length].id),
    onNext: () => openItem(list[(idx + 1) % list.length].id),
  });
}
$('#card-modal').addEventListener('closed', () => { if (!anyModalOpen()) cam.reset(); });

// ── UI ──
const compose = setupCompose({
  getDefaults: () => ({ name: me.name, owner: owner(), sealed: state.sealed, sealUntil: state.settings.sealUntil }),
  onSubmit: async (input) => {
    const item = await api.addItem(input);
    applyState({ ...state, items: [...state.items, item] });
    sound.sparkle();
    setTimeout(() => focusItem(item.id), 100);
    setTimeout(() => { if (!anyModalOpen()) cam.reset(); }, 3500);
    toast(`${ITEM_TYPES[item.type].icon} 트리에 걸었어요!`);
  },
});
const list = setupList({ getItems: visibleItems, onPick: (it) => { closeModal('list-modal'); openItem(it.id); } });
$('#btn-compose').addEventListener('click', () => compose.open());
$('#btn-list').addEventListener('click', () => list.open());
const soundBtn = $('#btn-sound');
const syncSound = () => { soundBtn.textContent = sound.muted ? '🔇' : '🔊'; };
soundBtn.addEventListener('click', () => { sound.init(); sound.setMuted(!sound.muted); syncSound(); }); syncSound();
addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!closeTop()) cam.reset(); return; }
  if (entered && !anyModalOpen() && e.key === 'Enter' && !e.target.closest?.('input,textarea')) { e.preventDefault(); compose.open(); }
});

// ── 루프 (탭이 숨겨지면 rAF가 자동으로 멈춤) ──
const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  cabin.update(dt); tree.update(dt); decorations.update(dt); cam.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

(async function start() {
  api = await createApi();
  try { applyState(await api.getState()); } catch (e) { toast(`⚠️ 데이터를 불러오지 못했어요: ${e.message}`); }
  requestAnimationFrame(frame);
  setTimeout(() => { $('#loading').style.opacity = '0'; setTimeout(() => $('#loading').remove(), 600); }, 150);
  const admin = setupAdmin({ api, onStateChange: refresh });
  $('#btn-admin').addEventListener('click', () => admin.open());
  setupEntry({
    owner: owner(), defaultName: CONFIG.user,
    onEnter: ({ name }) => {
      me.name = name; entered = true; sound.init();
      $('#hud').hidden = false;
      if (CONFIG.itemId) setTimeout(() => openItem(CONFIG.itemId), 500);
      if (api.mode === 'server') setInterval(() => { if (!document.hidden) refresh(); }, CONFIG.pollItemsMs);
    },
  });
})();

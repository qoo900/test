// 연말 산사 빌리지 - 앱 진입점: 씬 구성, 데이터 동기화, 입력/인터랙션, UI 연결
import * as THREE from 'three';
import { CONFIG, WORLD } from './config.js';
import { ITEM_TYPES } from './data/catalog.js';
import { createApi } from './net/api.js';
import { sound } from './audio/sound.js';
import { buildEnvironment } from './world/environment.js';
import { buildTemple } from './world/temple.js';
import { buildTree } from './world/tree.js';
import { DecorationManager } from './world/decorations.js';
import { Character } from './world/avatar.js';
import { Controls } from './world/controls.js';
import { RemotePlayers, Villagers } from './world/npc.js';
import { resolve } from './world/colliders.js';
import { dampAngle, authorName } from './util.js';
import { $, toast, setupEntry, setHud, setupCompose, showCard, setupList, closeModal, closeTop, anyModalOpen, modalState, openModal } from './ui/ui.js';
import { setupAdmin } from './ui/admin.js';

const quality = CONFIG.isTouch || (navigator.deviceMemory && navigator.deviceMemory < 4)
  ? { shadows: false, snow: 1200, pixelRatio: 1.5 }
  : { shadows: true, snow: 2600, pixelRatio: 2 };
if (CONFIG.isTouch) document.body.classList.add('touch');

// ── 렌더러 / 씬 / 카메라 ──
const renderer = new THREE.WebGLRenderer({ antialias: !CONFIG.isTouch, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('#app').append(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 900);
const isPortrait = () => innerWidth / innerHeight < 0.8;
function onResize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.fov = isPortrait() ? 68 : 55; // 세로 화면에서는 시야를 넓게
  camera.updateProjectionMatrix();
}
addEventListener('resize', onResize); onResize();

const env = buildEnvironment(scene, { quality });
const temple = buildTemple(scene);
const tree = buildTree(scene, { quality });
const decorations = new DecorationManager(scene);
const villagers = new Villagers(scene);
const remotes = new RemotePlayers(scene);

// ── 상태 ──
let api; let state = { items: [], settings: {}, stats: {}, sealed: false };
let me = null; // { name, body, color, hat }
let player = null;
const playerPos = new THREE.Vector3(WORLD.spawn.x, 0, WORLD.spawn.z);
let playerRy = Math.PI; let entered = false;
let myId;
try { myId = sessionStorage.getItem('sansa-id') || crypto.randomUUID(); sessionStorage.setItem('sansa-id', myId); } catch { myId = Math.random().toString(36).slice(2); }
let lastEmote = { emote: '', emoteAt: 0 };

const controls = new Controls(camera, renderer.domElement, { joystick: $('#joystick'), onTap: handleTap });
controls.target.set(0, 4, 20); controls.dist = 22; controls.pitch = 0.3; controls.snap();
modalState.onChange = (open) => { controls.enabled = !open; if (open) controls.keys.clear(); };

// ── 데이터 ──
function visibleItems() { return state.items.filter((it) => it.status === 'visible'); }
function sortedVisible() { return visibleItems().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); }
function itemsSignature(items) { return items.map((i) => `${i.id}:${i.status}:${i.message ? 1 : 0}`).join('|'); }

function applyState(next) {
  const changed = itemsSignature(next.items) !== itemsSignature(state.items);
  state = next;
  if (changed) decorations.sync(state.items);
  const vis = visibleItems();
  const lantern = vis.filter((i) => ITEM_TYPES[i.type]?.kind === 'lantern').length;
  setHud({ title: state.settings.title, room: CONFIG.room, count: { lantern, other: vis.length - lantern }, sealed: state.sealed, sealUntil: state.settings.sealUntil, mode: api.mode, online: api.mode === 'local' ? 0 : undefined });
  updateMerit();
}
function updateMerit() {
  const s = state.stats || {};
  $('#merit').textContent = `함께 친 목탁 ${s.moktak || 0}번 · 범종 ${s.bell || 0}번 · 합장 ${s.bow || 0}번`;
}

async function refresh() {
  try { applyState(await api.getState()); } catch (e) { console.warn('[sync]', e.message); }
}

// ── 인터랙션 ──
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pick(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects([...decorations.hits, ...temple.interactives], false);
  return hits[0]?.object || null;
}

function handleTap(x, y) {
  if (!entered || anyModalOpen()) return;
  const obj = pick(x, y);
  if (!obj) return;
  if (obj.userData.itemId) openItem(obj.userData.itemId);
  else if (obj.userData.interact) interact(obj.userData.interact);
}

function interact({ kind, index }) {
  sound.init();
  if (kind === 'moktak') { temple.tapMoktak(); sound.moktak(); react('moktak', '🪵'); }
  else if (kind === 'bell') { temple.strikeBell(); sound.bell(); temple.swingAllChimes(0.12); react('bell', '🔔'); }
  else if (kind === 'chime') { temple.swingChime(index); sound.chime(1); }
}

async function react(type, emoji) {
  emote(emoji);
  try { state.stats = await api.react(type); updateMerit(); } catch { /* 레이트리밋 등은 조용히 무시 */ }
}

function emote(emoji) {
  player?.showEmote(emoji);
  lastEmote = { emote: emoji, emoteAt: Date.now() };
}

function focusItem(id) {
  const pos = decorations.worldPos(id); if (!pos) return;
  const e = decorations.entries.get(id);
  // 처마/걸이대: 정면에서, 연등줄: 트리 쪽(안쪽)에서 바깥을 향해(기둥에 가리지 않도록), 그 외: 바깥에서 트리 쪽으로
  const yaw = ['eave', 'board'].includes(e.zone) ? e.pivot.rotation.y
    : e.zone === 'string' ? Math.atan2(pos.x, pos.z) + Math.PI : null;
  controls.setFocus(pos, e.zone === 'string' || e.zone === 'eave' ? 4.2 : 3.2, yaw);
  decorations.highlight(id);
}

function openItem(id) {
  const item = decorations.get(id) || state.items.find((i) => i.id === id);
  if (!item) { toast('해당 장식을 찾을 수 없어요 (숨김 처리되었을 수 있어요)'); return; }
  focusItem(id);
  sound.chime(0.35);
  const list = sortedVisible();
  const idx = list.findIndex((i) => i.id === id);
  closeModal('card-modal');
  showCard(item, {
    sealUntil: state.settings.sealUntil,
    onPrev: () => list.length && openItem(list[(idx - 1 + list.length) % list.length].id),
    onNext: () => list.length && openItem(list[(idx + 1) % list.length].id),
  });
}
$('#card-modal').addEventListener('closed', () => { if (!anyModalOpen()) controls.clearFocus(); });

// 데스크톱 hover 툴팁 & 커서
const tip = $('#tooltip'); let hoverAt = 0;
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse' || !entered || e.buttons) { tip.hidden = true; return; }
  const now = performance.now(); if (now - hoverAt < 60) return; hoverAt = now;
  const obj = pick(e.clientX, e.clientY);
  let text = null;
  if (obj?.userData.itemId) { const it = decorations.get(obj.userData.itemId); if (it) text = `${ITEM_TYPES[it.type].icon} ${authorName(it)}의 ${ITEM_TYPES[it.type].label}`; }
  else if (obj?.userData.interact) text = `${obj.userData.interact.label} 치기`;
  renderer.domElement.style.cursor = text ? 'pointer' : 'grab';
  tip.hidden = !text; if (text) { tip.textContent = text; tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`; }
});

// ── UI 연결 ──
const compose = setupCompose({
  getDefaults: () => ({ name: me?.name || '', sealed: state.sealed, sealUntil: state.settings.sealUntil }),
  onSubmit: async (input) => {
    const item = await api.addItem(input);
    applyState({ ...state, items: [...state.items, item] }); // 기존 배열을 변경하지 않아야 변경 감지가 됨
    sound.sparkle();
    emote('✨');
    setTimeout(() => focusItem(item.id), 120);
    setTimeout(() => controls.clearFocus(), 4200);
    toast(`${ITEM_TYPES[item.type].icon} ${ITEM_TYPES[item.type].label}을(를) 걸었어요!`);
  },
});
const list = setupList({ getItems: visibleItems, onPick: (it) => { closeModal('list-modal'); openItem(it.id); } });

$('#btn-compose').addEventListener('click', () => compose.open());
$('#btn-list').addEventListener('click', () => list.open());
$('#btn-help').addEventListener('click', () => openModal('help-modal'));
const soundBtn = $('#btn-sound');
const syncSoundBtn = () => { soundBtn.textContent = sound.muted ? '🔇' : '🔊'; };
soundBtn.addEventListener('click', () => { sound.init(); sound.setMuted(!sound.muted); syncSoundBtn(); });
syncSoundBtn();

document.querySelectorAll('[data-react]').forEach((b) => b.addEventListener('click', () => {
  sound.init();
  const r = b.dataset.react;
  if (r === 'bow') { sound.bow(); react('bow', '🙏'); }
  else if (r === 'moktak') { sound.moktak(); temple.tapMoktak(); react('moktak', '🪵'); }
  else if (r === 'bell') { sound.bell(); temple.strikeBell(); temple.swingAllChimes(0.12); react('bell', '🔔'); }
  else if (r === 'wave') { sound.chime(0.5); emote('👋'); }
  else if (r === 'tree') teleport(0, 7.2, Math.PI);
}));

function teleport(x, z, ry) {
  playerPos.set(x, 0, z); resolve(playerPos, 0.4); playerRy = ry;
  controls.clearFocus(); controls.yaw = ry + Math.PI; controls.dist = isPortrait() ? 10 : 7.5; controls.pitch = 0.36;
}

addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { if (!closeTop()) controls.clearFocus(); return; }
  if (!entered || anyModalOpen() || e.target.closest?.('input,textarea')) return;
  if (e.key === 'Enter') { e.preventDefault(); compose.open(); }
});

// ── 접속자(presence) 폴링 ──
async function presenceTick() {
  if (!entered || api.mode !== 'server' || document.hidden) return;
  try {
    const r = await api.presence({ id: myId, name: me.name || '익명', avatar: { body: me.body, color: me.color, hat: me.hat }, x: +playerPos.x.toFixed(2), z: +playerPos.z.toFixed(2), ry: +playerRy.toFixed(2), ...lastEmote });
    remotes.apply(r.players || []);
    setHud({ online: r.online, mode: api.mode });
  } catch { /* 네트워크 일시 오류 무시 */ }
}

// ── 메인 루프 ──
const clock = new THREE.Clock();
const vel = new THREE.Vector3();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (entered && player) {
    const mv = controls.moveInput();
    const speed = mv.run ? 6.5 : 3.8;
    const target = new THREE.Vector3(mv.x, 0, mv.z).multiplyScalar(speed);
    vel.lerp(target, 1 - Math.exp(-dt * 12));
    if (vel.lengthSq() > 0.01) {
      if (controls.focus && target.lengthSq() > 0) { controls.clearFocus(); closeModal('card-modal'); }
      playerPos.addScaledVector(vel, dt); resolve(playerPos, 0.4);
      if (target.lengthSq() > 0) playerRy = Math.atan2(vel.x, vel.z);
    }
    player.group.position.copy(playerPos);
    player.group.rotation.y = dampAngle(player.group.rotation.y, playerRy, 12, dt);
    player.update(dt, vel.length());
    controls.update(dt, playerPos);
  } else {
    // 입장 전: 마을 전경을 천천히 도는 카메라
    controls.yaw += dt * 0.05;
    controls.update(dt, new THREE.Vector3(0, 2.5, -2));
  }
  env.update(dt, camera);
  temple.update(dt);
  tree.update(dt);
  decorations.update(dt);
  villagers.update(dt);
  remotes.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ── 시작 ──
(async function start() {
  api = await createApi();
  try { applyState(await api.getState()); } catch (e) { toast(`⚠️ 데이터를 불러오지 못했어요: ${e.message}`); }
  // 입장 전 오비트 카메라: 트리 중심
  controls.focus = { pos: new THREE.Vector3(0, 3, 0), dist: 24 };
  controls.pitch = 0.32; controls.snap();
  requestAnimationFrame(frame);
  setTimeout(() => { $('#loading').style.opacity = '0'; setTimeout(() => $('#loading').remove(), 600); }, 200);

  const admin = setupAdmin({ api, onStateChange: refresh });
  $('#btn-admin').addEventListener('click', () => admin.open());

  setupEntry({
    room: CONFIG.room,
    defaultName: CONFIG.user,
    onEnter: (appearance) => {
      me = appearance;
      sound.init();
      sound.chime(0.8);
      player = new Character(scene, { body: me.body, color: me.color, hat: me.hat }, ''); // 내 이름표는 숨김
      controls.clearFocus();
      if (CONFIG.focus === 'tree') teleport(0, 7.2, Math.PI);
      else teleport(WORLD.spawn.x, WORLD.spawn.z, Math.PI);
      controls.snap();
      entered = true;
      $('#hud').hidden = false;
      toast(CONFIG.isTouch ? '왼쪽 아래를 끌어 이동 · 화면을 끌어 둘러보기' : 'WASD로 이동 · 드래그로 둘러보기 · 장식을 클릭해 읽어 보세요', 4200);
      if (CONFIG.itemId) setTimeout(() => openItem(CONFIG.itemId), 600);
      if (api.mode === 'server') {
        setInterval(refresh, CONFIG.pollItemsMs);
        setInterval(presenceTick, CONFIG.presenceMs);
        presenceTick();
      }
    },
  });
})();

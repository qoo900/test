// 산사 구조물: 대웅전(기단·기둥·창호·처마·단청), 범종각, 석탑, 석등, 담장, 일주문, 목탁, 풍경, 연등줄, 소원 팻말 걸이대
import * as THREE from 'three';
import { WORLD } from '../config.js';
import { STRING, stringPoint, RACKS, RACK } from './slots.js';
import { addBox, addCircle } from './colliders.js';
import { rng, glowTexture } from '../util.js';

const M = {
  wood: new THREE.MeshStandardMaterial({ color: '#8a3b2a', roughness: 0.7 }),      // 주칠 기둥
  woodDark: new THREE.MeshStandardMaterial({ color: '#5a3a28', roughness: 0.8 }),
  woodLight: new THREE.MeshStandardMaterial({ color: '#a77a4f', roughness: 0.8 }),
  stone: new THREE.MeshStandardMaterial({ color: '#9aa0ab', roughness: 0.95, flatShading: true }),
  stoneDark: new THREE.MeshStandardMaterial({ color: '#7b808c', roughness: 0.95, flatShading: true }),
  snow: new THREE.MeshStandardMaterial({ color: '#f3f6ff', roughness: 1 }),
  green: new THREE.MeshStandardMaterial({ color: '#2f7f6f', roughness: 0.7 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#4f6b5a', metalness: 0.75, roughness: 0.35 }),
  rope: new THREE.LineBasicMaterial({ color: '#3b2b22' }),
};

// 한옥 팔작/우진각 지붕 느낌: 오목한 경사 + 처마 끝 앙곡(모서리 치켜올림) + 눈 덮인 기와 줄무늬
export function makeRoof(w, d, h, lift, { segW = 40, segD = 24, tile = '#3a4256', snowAmt = 0.8 } = {}) {
  const g = new THREE.PlaneGeometry(w, d, segW, segD);
  g.rotateX(-Math.PI / 2);
  const p = g.attributes.position; const colors = new Float32Array(p.count * 3);
  const cTile = new THREE.Color(tile), cSnow = new THREE.Color('#eef2fb'), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const u = x / (w / 2), v = z / (d / 2);
    const e = Math.min((1 - Math.abs(u)) * w / 2, (1 - Math.abs(v)) * d / 2) / (d / 2);
    const s = Math.max(0, Math.min(1, e)); // 경계에서 부동소수 오차로 음수가 되면 pow가 NaN
    let y = h * Math.pow(s, 1.45);
    y += lift * 0.5 * (u ** 4 * v ** 2 + v ** 4 * u ** 2) + lift * 0.15 * (u ** 4 + v ** 4);
    p.setY(i, y);
    const stripe = Math.abs(u) > Math.abs(v) * (w / d) * 0.6 ? Math.sin(z * 9) : Math.sin(x * 9);
    const k = Math.min(1, snowAmt * (stripe > 0.35 ? 0.55 : 1.0) * (0.7 + s * 0.5));
    c.copy(cTile).lerp(cSnow, k);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85, flatShading: false }));
  mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

function dancheongTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 32; const ctx = c.getContext('2d');
  ctx.fillStyle = '#2f7f6f'; ctx.fillRect(0, 0, 256, 32);
  const cols = ['#d94f3d', '#f0c24b', '#2b5ea8', '#f4efe2'];
  for (let i = 0; i < 16; i++) {
    const x = i * 16;
    ctx.fillStyle = cols[i % 4]; ctx.fillRect(x + 2, 6, 12, 20);
    ctx.fillStyle = '#1d4f45'; ctx.fillRect(x, 0, 2, 32);
  }
  ctx.fillStyle = '#c33d32'; ctx.fillRect(0, 0, 256, 4); ctx.fillRect(0, 28, 256, 4);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, x, y, z, seg = 10) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); m.castShadow = true; return m;
}

export function buildTemple(scene) {
  const interactives = [];
  const anims = [];
  const root = new THREE.Group(); scene.add(root);

  // ═══ 대웅전 ═══
  const { hallZ: Z, hallW: W, hallD: D, platformH: PH } = WORLD;
  const hall = new THREE.Group(); hall.position.set(0, 0, Z); root.add(hall);
  // 기단 + 눈
  hall.add(box(W + 3, PH, D + 3, M.stone, 0, PH / 2, 0));
  hall.add(box(W + 3.05, 0.08, D + 3.05, M.snow, 0, PH + 0.04, 0));
  // 계단
  for (let i = 0; i < 4; i++) hall.add(box(4.2, PH * (i + 1) / 4, 0.4, M.stoneDark, 0, PH * (i + 1) / 8, D / 2 + 1.5 + (3 - i) * 0.4 + 0.2));
  addBox(-(W + 3) / 2, (W + 3) / 2, Z - (D + 3) / 2, Z + (D + 3) / 2 + 1.8);
  // 기둥
  const colH = 3.6, top = PH + colH;
  for (let i = 0; i < 6; i++) {
    const x = -W / 2 + 0.4 + (i * (W - 0.8)) / 5;
    hall.add(cyl(0.24, 0.28, colH, M.wood, x, PH + colH / 2, D / 2 - 0.3));
    hall.add(cyl(0.24, 0.28, colH, M.wood, x, PH + colH / 2, -D / 2 + 0.3));
    hall.add(cyl(0.34, 0.38, 0.18, M.stoneDark, x, PH + 0.09, D / 2 - 0.3, 8)); // 주춧돌
  }
  // 벽 + 창호(안에서 불빛이 새어 나오는 문살)
  const doorTex = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 192; const ctx = c.getContext('2d');
    ctx.fillStyle = '#ffd59a'; ctx.fillRect(0, 0, 128, 192);
    const g = ctx.createRadialGradient(64, 110, 10, 64, 110, 120); g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(1, 'rgba(230,140,60,0.4)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 192);
    ctx.strokeStyle = '#6b3a24'; ctx.lineWidth = 3;
    for (let x = 0; x <= 128; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 192); ctx.stroke(); }
    for (let y = 0; y <= 192; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(128, y); ctx.stroke(); }
    ctx.lineWidth = 8; ctx.strokeRect(4, 4, 120, 184);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, emissive: '#ffb060', emissiveMap: doorTex, emissiveIntensity: 0.9 });
  hall.add(box(W - 0.6, colH - 0.3, D - 0.8, new THREE.MeshStandardMaterial({ color: '#e9dcc6', roughness: 0.9 }), 0, PH + colH / 2 - 0.1, 0));
  for (let i = 0; i < 5; i++) {
    const x = -W / 2 + 0.4 + ((i + 0.5) * (W - 0.8)) / 5;
    const door = new THREE.Mesh(new THREE.PlaneGeometry((W - 0.8) / 5 - 0.5, colH - 0.7), doorMat);
    door.position.set(x, PH + colH / 2 - 0.1, D / 2 - 0.39); hall.add(door);
  }
  // 단청 띠(창방)
  const dTex = dancheongTexture(); dTex.repeat.set(6, 1);
  const beamMat = new THREE.MeshStandardMaterial({ map: dTex });
  hall.add(box(W + 0.4, 0.45, 0.35, beamMat, 0, top + 0.1, D / 2 - 0.3));
  hall.add(box(W + 0.4, 0.45, 0.35, beamMat, 0, top + 0.1, -D / 2 + 0.3));
  hall.add(box(0.35, 0.45, D, beamMat, -W / 2 + 0.1, top + 0.1, 0));
  hall.add(box(0.35, 0.45, D, beamMat, W / 2 - 0.1, top + 0.1, 0));
  // 처마 아래 서까래 느낌의 초록 판
  hall.add(box(W + 3.4, 0.25, D + 3.4, M.green, 0, top + 0.45, 0));
  // 지붕 + 용마루 + 현판
  const roof = makeRoof(W + 4, D + 4, 3.2, 1.4); roof.position.y = top + 0.5; hall.add(roof);
  hall.add(box(W - D + 0.6, 0.4, 0.5, new THREE.MeshStandardMaterial({ color: '#e8edf7' }), 0, top + 0.5 + 3.3, 0));
  const plaqueTex = (() => {
    const c = document.createElement('canvas'); c.width = 384; c.height = 128; const ctx = c.getContext('2d');
    ctx.fillStyle = '#2c2a3a'; ctx.fillRect(0, 0, 384, 128); ctx.strokeStyle = '#d7a640'; ctx.lineWidth = 10; ctx.strokeRect(6, 6, 372, 116);
    ctx.fillStyle = '#f2c661'; ctx.font = 'bold 72px "Nanum Myeongjo", "Noto Serif KR", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('大雄殿', 192, 68);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.8), new THREE.MeshStandardMaterial({ map: plaqueTex, emissive: '#3a2a10', emissiveIntensity: 0.4 }));
  plaque.position.set(0, top + 0.1, D / 2 - 0.1); hall.add(plaque);

  // ═══ 풍경(처마 네 귀퉁이) ═══
  const chimes = [];
  const fishGeo = new THREE.ConeGeometry(0.09, 0.28, 4); fishGeo.rotateZ(Math.PI / 2);
  [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(([sx, sz], idx) => {
    const g = new THREE.Group();
    g.position.set(sx * (W / 2 + 1.75), top + 0.5 + 1.55, Z + sz * (D / 2 + 1.75));
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.28, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#6d7d63', metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }));
    bell.position.y = -0.4;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.6), M.woodDark); line.position.y = -0.45;
    const fish = new THREE.Mesh(fishGeo, M.bronze); fish.position.y = -0.85;
    g.add(bell, line, fish);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = -0.5; g.add(hit);
    hit.userData.interact = { kind: 'chime', index: idx, label: '풍경' };
    interactives.push(hit);
    root.add(g); chimes.push({ g, swing: 0, t: Math.random() * 10 });
  });
  anims.push((dt) => chimes.forEach((c) => { c.t += dt; c.swing *= Math.exp(-dt * 1.2); c.g.rotation.z = Math.sin(c.t * 1.3) * 0.04 + Math.sin(c.t * 7) * c.swing; c.g.rotation.x = Math.cos(c.t * 1.1) * 0.03; }));

  // ═══ 범종각 ═══
  const bp = new THREE.Group(); bp.position.set(12.2, 0, -8.6); root.add(bp);
  bp.add(box(4.4, 0.5, 4.4, M.stone, 0, 0.25, 0));
  for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7], [-1.7, 1.7], [1.7, 1.7]]) bp.add(cyl(0.16, 0.18, 3.4, M.wood, x, 0.5 + 1.7, z));
  bp.add(box(3.8, 0.3, 3.8, M.green, 0, 4.0, 0));
  const bpRoof = makeRoof(5.4, 5.4, 1.9, 0.9, { segW: 24, segD: 24 }); bpRoof.position.y = 4.1; bp.add(bpRoof);
  const bellProfile = [[0, 0], [0.62, 0], [0.66, 0.08], [0.6, 0.35], [0.52, 1.0], [0.5, 1.3], [0.42, 1.45], [0.2, 1.52], [0, 1.52]].map(([x, y]) => new THREE.Vector2(x, y));
  const bigBell = new THREE.Mesh(new THREE.LatheGeometry(bellProfile, 24), M.bronze);
  bigBell.position.set(0, 1.7, 0); bigBell.castShadow = true; bp.add(bigBell);
  bp.add(box(0.12, 0.5, 0.12, M.woodDark, 0, 3.5, 0));
  const striker = cyl(0.14, 0.14, 1.8, M.woodLight, 1.5, 2.3, 0); striker.rotation.z = Math.PI / 2; bp.add(striker);
  const bellHit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4), new THREE.MeshBasicMaterial({ visible: false }));
  bellHit.position.y = 2.2; bp.add(bellHit);
  bellHit.userData.interact = { kind: 'bell', label: '범종' };
  interactives.push(bellHit);
  addBox(12.2 - 2.3, 12.2 + 2.3, -8.6 - 2.3, -8.6 + 2.3);
  let strikeT = 99, bellSwing = 0;
  anims.push((dt) => {
    strikeT += dt;
    const k = strikeT < 0.35 ? Math.sin((strikeT / 0.35) * Math.PI) : 0;
    striker.position.x = 1.5 - k * 0.55;
    bellSwing *= Math.exp(-dt * 0.8);
    bigBell.rotation.z = Math.sin(strikeT * 5) * bellSwing;
  });

  // ═══ 석탑 (3층) ═══
  const pg = new THREE.Group(); pg.position.set(-8.8, 0, -8.6); root.add(pg);
  pg.add(box(2.4, 0.5, 2.4, M.stone, 0, 0.25, 0));
  pg.add(box(1.8, 0.7, 1.8, M.stone, 0, 0.85, 0));
  let y = 1.2;
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.18;
    pg.add(box(1.0 * s, 0.75 * s, 1.0 * s, M.stone, 0, y + 0.37 * s, 0)); y += 0.75 * s;
    const r = makeRoof(1.9 * s, 1.9 * s, 0.35 * s, 0.25 * s, { segW: 8, segD: 8, tile: '#8d93a0', snowAmt: 0.9 }); r.position.y = y; pg.add(r);
    y += 0.3 * s;
  }
  pg.add(cyl(0.05, 0.08, 0.9, M.stoneDark, 0, y + 0.45, 0, 6));
  addCircle(-8.8, -8.6, 1.5);

  // ═══ 석등 ═══
  const lampGlow = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffbb66', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  for (const [x, z] of [[-6.5, -11], [6.5, -11], [-5.5, 12.5], [5.5, 12.5]]) {
    const g = new THREE.Group(); g.position.set(x, 0, z); root.add(g);
    g.add(box(0.9, 0.3, 0.9, M.stone, 0, 0.15, 0));
    g.add(cyl(0.16, 0.2, 1.1, M.stone, 0, 0.85, 0, 8));
    g.add(box(0.8, 0.15, 0.8, M.stone, 0, 1.45, 0));
    g.add(box(0.55, 0.55, 0.55, new THREE.MeshStandardMaterial({ color: '#ffcf8a', emissive: '#ff9b3d', emissiveIntensity: 1.4 }), 0, 1.8, 0));
    const r = makeRoof(1.0, 1.0, 0.35, 0.15, { segW: 6, segD: 6, tile: '#8d93a0', snowAmt: 1 }); r.position.y = 2.08; g.add(r);
    const sp = new THREE.Sprite(lampGlow); sp.scale.set(2.2, 2.2, 1); sp.position.y = 1.8; g.add(sp);
    addCircle(x, z, 0.6);
  }

  // ═══ 담장 + 일주문 ═══
  const wallMat = new THREE.MeshStandardMaterial({ color: '#b8a58d', roughness: 1 });
  const wallTop = new THREE.MeshStandardMaterial({ color: '#4a5266' });
  const wall = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1); const g = new THREE.Group();
    g.position.set((x1 + x2) / 2, 0, (z1 + z2) / 2); g.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    g.add(box(len, 1.2, 0.5, wallMat, 0, 0.6, 0), box(len + 0.2, 0.2, 0.9, wallTop, 0, 1.3, 0), box(len + 0.2, 0.08, 0.95, M.snow, 0, 1.44, 0));
    root.add(g);
  };
  wall(-18.5, -14, -18.5, 18); wall(18.5, -14, 18.5, 18);
  wall(-18.5, 18, -3.2, 18); wall(3.2, 18, 18.5, 18);
  wall(-18.5, -14, -(W + 3) / 2, -14); wall((W + 3) / 2, -14, 18.5, -14);
  const gate = new THREE.Group(); gate.position.set(0, 0, 18); root.add(gate);
  for (const x of [-2.6, 2.6]) { gate.add(cyl(0.25, 0.3, 4, M.wood, x, 2, 0)); gate.add(box(0.8, 0.3, 0.8, M.stoneDark, x, 0.15, 0)); }
  gate.add(box(6, 0.4, 0.5, beamMat, 0, 3.9, 0));
  const gRoof = makeRoof(7.6, 2.8, 1.2, 0.7, { segW: 24, segD: 10 }); gRoof.position.y = 4.1; gate.add(gRoof);

  // ═══ 목탁 (마당 앞 받침대) ═══
  const mk = new THREE.Group(); mk.position.set(1.9, 0, -11); root.add(mk);
  mk.add(box(1.1, 0.7, 0.8, M.woodDark, 0, 0.35, 0));
  mk.add(box(1.0, 0.12, 0.7, new THREE.MeshStandardMaterial({ color: '#7a2830' }), 0, 0.76, 0)); // 방석
  const mokBody = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 14), new THREE.MeshStandardMaterial({ color: '#b5651d', roughness: 0.45 }));
  mokBody.scale.set(1.15, 0.85, 1); mokBody.position.y = 1.05; mokBody.castShadow = true; mk.add(mokBody);
  const slit = box(0.4, 0.03, 0.05, new THREE.MeshBasicMaterial({ color: '#2b160a' }), 0, 1.02, 0.29); mk.add(slit);
  const stick = new THREE.Group(); stick.position.set(0.15, 1.3, 0.05);
  const stickRod = cyl(0.025, 0.025, 0.5, M.woodLight, 0.25, 0, 0, 6); stickRod.rotation.z = Math.PI / 2;
  const stickHead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), M.woodLight);
  stick.add(stickRod, stickHead); mk.add(stick);
  const mkHit = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.6, 1.1), new THREE.MeshBasicMaterial({ visible: false })); mkHit.position.y = 0.8; mk.add(mkHit);
  mkHit.userData.interact = { kind: 'moktak', label: '목탁' };
  interactives.push(mkHit);
  addBox(1.9 - 0.6, 1.9 + 0.6, -11.45, -10.55);
  let tapT = 99;
  anims.push((dt) => {
    tapT += dt;
    const k = tapT < 0.18 ? Math.sin((tapT / 0.18) * Math.PI) : 0;
    stick.rotation.z = -0.5 + k * 0.6;
    mokBody.scale.setScalar(1 + k * 0.04); mokBody.scale.x *= 1.15; mokBody.scale.y *= 0.85;
  });

  // ═══ 연등줄 (트리 → 기둥 8개) ═══
  const ptsCount = 24;
  STRING.poles.forEach((p, i) => {
    root.add(cyl(0.09, 0.12, STRING.poleH, M.woodDark, p.x, STRING.poleH / 2, p.y, 6));
    root.add(cyl(0.18, 0.18, 0.12, M.snow, p.x, STRING.poleH + 0.06, p.y, 8));
    addCircle(p.x, p.y, 0.3);
    const pts = []; for (let k = 0; k <= ptsCount; k++) pts.push(stringPoint(i, k / ptsCount));
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), M.rope));
  });

  // ═══ 소원 팻말 걸이대 ═══
  RACKS.forEach((r) => {
    const g = new THREE.Group(); g.position.set(r.x, 0, r.z); g.rotation.y = r.ry; root.add(g);
    const hw = RACK.width / 2;
    for (const x of [-hw, hw]) { g.add(box(0.18, 2.7, 0.18, M.woodDark, x, 1.35, 0)); }
    RACK.rows.forEach((yy) => g.add(box(RACK.width + 0.3, 0.07, 0.07, M.woodLight, 0, yy, 0)));
    const rr = makeRoof(RACK.width + 1.2, 1.1, 0.4, 0.3, { segW: 16, segD: 6 }); rr.position.y = 2.75; g.add(rr);
    // 반대쪽에서도 막히도록 충돌 박스 (랙 축 정렬)
    const ax = Math.abs(Math.sin(r.ry)) > 0.5;
    if (ax) addBox(r.x - 0.35, r.x + 0.35, r.z - hw - 0.2, r.z + hw + 0.2); else addBox(r.x - hw - 0.2, r.x + hw + 0.2, r.z - 0.35, r.z + 0.35);
  });

  // ═══ 마당 안내 팻말 ═══
  const signTex = (() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8d6b4'; ctx.fillRect(0, 0, 256, 128); ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 248, 120);
    ctx.fillStyle = '#4a2f1c'; ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('목탁을', 128, 52); ctx.fillText('두드려 보세요', 128, 92);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sign = new THREE.Group(); sign.position.set(3.4, 0, -10.6); sign.rotation.y = -0.4; root.add(sign);
  sign.add(box(0.08, 1.1, 0.08, M.woodDark, 0, 0.55, 0));
  const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshStandardMaterial({ map: signTex })); sp.position.y = 1.2; sign.add(sp);

  // 마당 곳곳의 작은 눈 더미
  { const r = rng(9); for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.4 + r() * 0.5, 8, 6), M.snow); const a = r() * 6.28; const d = 14 + r() * 3.5; m.position.set(Math.cos(a) * d, -0.15, Math.sin(a) * d * 0.95); m.scale.y = 0.45; root.add(m); } }

  return {
    interactives,
    update: (dt) => anims.forEach((a) => a(dt)),
    strikeBell() { strikeT = 0; bellSwing = 0.06; },
    tapMoktak() { tapT = 0; },
    swingChime(i) { const c = chimes[i]; if (c) c.swing = 0.35; },
    swingAllChimes(s = 0.15) { chimes.forEach((c) => { c.swing = Math.max(c.swing, s); }); },
  };
}

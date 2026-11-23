// 크리스마스 거실 (레퍼런스: 어두운 벽돌 벽, 가운데 아치형 벽난로, 왼쪽 커튼 창, 오른쪽 트리)
//  - 벽난로: 아치 돌 테두리, 불꽃, 전구 가랜드, 양말 4개, 양옆 랜턴, 앞쪽 빨간 초, 위에 시계 화환
//  - 왼쪽: 크림색 커튼 창(전구 테두리·촛불·창밖 눈), 갈색 가죽 윙체어(빨간 담요·산타 모자·눈사람 인형)
//  - 바닥: 흰 털 러그, 앞쪽을 따라 놓인 전구 줄
// 저사양 폰을 위해: 그림자 없음, Lambert 재질, 캔버스 텍스처, 전구/눈은 Points 1회 드로우
import * as THREE from 'three';
import { rng, glowTexture } from '../util.js';

export const ROOM = { w: 9, d: 7, h: 3.8 };
const HW = ROOM.w / 2, HD = ROOM.d / 2;

function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  return t;
}
// 어두운 갈색 벽돌
const brickTex = (seed = 12, tone = 1) => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#2a1d16'; ctx.fillRect(0, 0, w, h);
  const r = rng(seed); const bh = 26, bw = 64;
  for (let y = 0; y < h; y += bh) for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < w; x += bw) {
    const v = (0.7 + r() * 0.45) * tone;
    ctx.fillStyle = `rgb(${84 * v},${56 * v},${40 * v})`; ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
    ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(x + 2, y + bh - 7, bw - 4, 5);
  }
});
const stoneTex = () => canvasTex(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#8a7b6a'; ctx.fillRect(0, 0, w, h);
  const r = rng(3);
  for (let i = 0; i < 300; i++) { const v = 100 + r() * 70; ctx.fillStyle = `rgba(${v},${v * 0.9},${v * 0.8},0.5)`; ctx.fillRect(r() * w, r() * h, 2 + r() * 4, 2 + r() * 4); }
});
const floorTex = () => canvasTex(256, 256, (ctx, w, h) => {
  const r = rng(8); const n = 6; const pw = h / n;
  for (let i = 0; i < n; i++) {
    const v = 0.8 + r() * 0.2;
    ctx.fillStyle = `rgb(${110 * v},${72 * v},${45 * v})`; ctx.fillRect(0, i * pw, w, pw);
    ctx.fillStyle = 'rgba(30,15,5,0.5)'; ctx.fillRect(0, i * pw, w, 2); ctx.fillRect(r() * w, i * pw, 2, pw);
  }
}, [4, 3]);
const leatherTex = () => canvasTex(128, 128, (ctx, w, h) => {
  ctx.fillStyle = '#4a2c1c'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let y = 8; y < h; y += 24) for (let x = (y / 24) % 2 ? 0 : 12; x < w; x += 24) { ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill(); } // 체스터필드 단추
  ctx.fillStyle = 'rgba(255,220,180,0.06)'; ctx.fillRect(0, 0, w, h / 2);
}, [2, 2]);
const clockTex = () => canvasTex(256, 256, (ctx, w) => {
  ctx.fillStyle = '#e9dcc4'; ctx.beginPath(); ctx.arc(128, 128, 124, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 8; ctx.stroke();
  ctx.fillStyle = '#3a2a1c'; ctx.font = 'bold 30px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; ctx.fillText(String(i), 128 + Math.cos(a) * 95, 128 + Math.sin(a) * 95); }
  ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128, 62); ctx.stroke(); // 12시
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(178, 128); ctx.stroke();
  ctx.beginPath(); ctx.arc(128, 128, 8, 0, 7); ctx.fill();
});
const outsideTex = () => canvasTex(128, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#05070f'); g.addColorStop(1, '#1b2236');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
});

function wallWithHoles(width, height, holes, mat, scale = 1.6) {
  const s = new THREE.Shape(); s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(width / 2, height); s.lineTo(-width / 2, height); s.closePath();
  holes.forEach(([x, y, w, h]) => { const p = new THREE.Path(); p.moveTo(x - w / 2, y - h / 2); p.lineTo(x - w / 2, y + h / 2); p.lineTo(x + w / 2, y + h / 2); p.lineTo(x + w / 2, y - h / 2); p.closePath(); s.holes.push(p); });
  const g = new THREE.ShapeGeometry(s);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / scale, uv.getY(i) / scale);
  return new THREE.Mesh(g, mat);
}
const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
const glowSprite = (color, sx, sy, opacity = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity })); s.scale.set(sx, sy, 1); return s; };
// 전구 줄: 점 목록 → 가산 혼합 Points (색 섞기 가능)
function fairyLights(points, { size = 0.13, colors = null, color = '#ffd98a' } = {}) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors.flat(), 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size, map: glowTexture(), color: colors ? '#ffffff' : color, vertexColors: !!colors, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
}

export function buildCabin(scene, { quality }) {
  const updaters = [];
  const root = new THREE.Group(); scene.add(root);
  scene.background = new THREE.Color('#0d0806');

  // ── 조명: 어둡고 따뜻하게. 주 광원은 벽난로 ──
  scene.add(new THREE.HemisphereLight('#ffb879', '#2a160c', 0.45));
  const fireLight = new THREE.PointLight('#ff8a35', 14, 9, 1.3); fireLight.position.set(0, 0.8, -2.5); scene.add(fireLight);
  const winLight = new THREE.PointLight('#ffb060', 4, 5, 1.5); winLight.position.set(-3.0, 2.0, -3.0); scene.add(winLight);

  // ── 벽/바닥/천장 ──
  const wallMat = L('#ffffff', { map: brickTex() });
  const win = [-3.0, 1.95, 1.5, 1.9]; // 왼쪽 창 x, y, w, h
  const back = wallWithHoles(ROOM.w, ROOM.h, [win], wallMat); back.position.z = -HD; root.add(back);
  const left = wallWithHoles(ROOM.d, ROOM.h, [], wallMat); left.rotation.y = Math.PI / 2; left.position.x = -HW; root.add(left);
  const right = wallWithHoles(ROOM.d, ROOM.h, [], wallMat); right.rotation.y = -Math.PI / 2; right.position.x = HW; root.add(right);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), L('#ffffff', { map: floorTex() }));
  floor.rotation.x = -Math.PI / 2; root.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), L('#1e130c')); ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; root.add(ceil);

  // ── 왼쪽 창: 나무 창틀, 크림색 커튼(빛이 비침), 창틀 전구, 창턱 촛불 ──
  const wg = new THREE.Group(); wg.position.set(win[0], win[1], -HD); root.add(wg);
  const [ww, wh] = [win[2], win[3]]; const t = 0.09; const wood = L('#3a2414');
  wg.add(box(ww + t * 2, t, 0.16, wood, 0, wh / 2 + t / 2, 0), box(ww + t * 2, t, 0.16, wood, 0, -wh / 2 - t / 2, 0));
  wg.add(box(t, wh, 0.16, wood, -ww / 2 - t / 2, 0, 0), box(t, wh, 0.16, wood, ww / 2 + t / 2, 0, 0));
  wg.add(box(0.06, wh, 0.06, wood, 0, 0, 0), box(ww, 0.06, 0.06, wood, 0, -0.15, 0));
  wg.add(box(ww + 0.5, 0.08, 0.35, wood, 0, -wh / 2 - 0.12, 0.15)); // 창턱
  const curtainMat = new THREE.MeshLambertMaterial({ color: '#f6dcb0', emissive: '#c77a2a', emissiveIntensity: 0.55, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  const curtainGeo = new THREE.PlaneGeometry(0.75, wh + 1.3, 10, 1);
  { const p = curtainGeo.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 22) * 0.04); curtainGeo.computeVertexNormals(); } // 주름
  const cl = new THREE.Mesh(curtainGeo, curtainMat); cl.position.set(-ww / 2 - 0.15, 0.25, 0.22); wg.add(cl);
  const cr = new THREE.Mesh(curtainGeo, curtainMat); cr.position.set(ww / 2 + 0.15, 0.25, 0.22); wg.add(cr);
  wg.add(box(ww + 1.8, 0.04, 0.04, L('#1c120a'), 0, wh / 2 + 0.85, 0.25));
  const winPts = []; for (let i = 0; i <= 22; i++) { const tt = i / 22; winPts.push([-ww / 2 - 0.02 + tt * (ww + 0.04), wh / 2 + 0.02 - Math.sin(tt * Math.PI * 4) ** 2 * 0.05, 0.12]); }
  for (let i = 0; i <= 12; i++) { const tt = i / 12; winPts.push([-ww / 2 - 0.02, wh / 2 - tt * wh, 0.12], [ww / 2 + 0.02, wh / 2 - tt * wh, 0.12]); }
  wg.add(fairyLights(winPts, { size: 0.11 }));
  const sillCandles = [];
  [[-0.45, 0.22], [-0.25, 0.14], [0.4, 0.3]].forEach(([x, h]) => {
    wg.add(box(0.07, h, 0.07, L('#f3e8d4'), x, -wh / 2 - 0.08 + h / 2, 0.15));
    const f = glowSprite('#ffc35a', 0.3, 0.38); f.position.set(x, -wh / 2 - 0.05 + h, 0.15); wg.add(f); sillCandles.push(f);
  });
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), new THREE.MeshBasicMaterial({ map: outsideTex() }));
  outside.position.set(win[0], 2, -HD - 2.6); root.add(outside);
  const n = quality.snow; const pos = new Float32Array(n * 3); const seed = new Float32Array(n); const r = rng(5);
  for (let i = 0; i < n; i++) { pos.set([win[0] + (r() - 0.5) * 2.6, r() * 3.6, -HD - 0.3 - r() * 1.8], i * 3); seed[i] = r(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.06, map: glowTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
  snow.frustumCulled = false; root.add(snow);
  let st = 0;
  updaters.push((dt) => {
    st += dt;
    for (let i = 0; i < n; i++) { const k = i * 3; const s = seed[i]; pos[k + 1] -= (0.3 + s * 0.4) * dt; pos[k] += Math.sin(st * 0.7 + s * 30) * 0.1 * dt; if (pos[k + 1] < 0.6) pos[k + 1] += 3.2; }
    sg.attributes.position.needsUpdate = true;
  });

  // ── 가운데 벽난로: 아치형 돌 테두리 ──
  const fp = new THREE.Group(); fp.position.set(0, 0, -HD); root.add(fp);
  // 굴뚝 몸체(벽돌, 살짝 앞으로)
  const chimTex = brickTex(21, 1.1); chimTex.repeat.set(1.6, 2.4);
  fp.add(box(2.6, ROOM.h, 0.35, L('#ffffff', { map: chimTex }), 0, ROOM.h / 2, 0.17));
  const surround = new THREE.Shape(); const SW = 2.5, SH = 1.55;
  surround.moveTo(-SW / 2, 0); surround.lineTo(SW / 2, 0); surround.lineTo(SW / 2, SH); surround.lineTo(-SW / 2, SH); surround.closePath();
  const arch = new THREE.Path(); const AW = 1.5, AH = 0.95;
  arch.moveTo(-AW / 2, 0.18); arch.lineTo(-AW / 2, AH); arch.absarc(0, AH, AW / 2, Math.PI, 0, true); arch.lineTo(AW / 2, 0.18); arch.closePath();
  surround.holes.push(arch);
  const sGeo = new THREE.ExtrudeGeometry(surround, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
  const sMat = L('#ffffff', { map: stoneTex() });
  const sm = new THREE.Mesh(sGeo, sMat); sm.position.z = 0.36; fp.add(sm);
  fp.add(box(1.5, 1.4, 0.1, L('#2a120a'), 0, 0.85, 0.38)); // 안쪽 그을음
  fp.add(box(2.9, 0.12, 0.6, L('#4a3626'), 0, 1.61, 0.62)); // 맨틀
  fp.add(box(2.7, 0.18, 0.85, sMat, 0, 0.09, 0.65));     // 화로 단
  const logM = L('#3a2112');
  [[-0.2, 0.3, 0.25], [0.2, 0.3, -0.25], [0, 0.42, 0.05]].forEach(([x, y, rz]) => {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 7), logM); lg.rotation.set(0, 0.25, Math.PI / 2 + rz); lg.position.set(x, y, 0.55); fp.add(lg);
  });
  const flameTex = canvasTex(64, 128, (ctx) => {
    const g = ctx.createRadialGradient(32, 100, 2, 32, 80, 64);
    g.addColorStop(0, 'rgba(255,250,215,1)'); g.addColorStop(0.25, 'rgba(255,205,90,0.95)'); g.addColorStop(0.55, 'rgba(255,115,30,0.6)'); g.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(32, 0); ctx.bezierCurveTo(60, 50, 64, 90, 32, 128); ctx.bezierCurveTo(0, 90, 4, 50, 32, 0); ctx.fill();
  });
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    fp.add(sp); flames.push({ sp, x: (i - 2.5) * 0.13, ph: i * 1.7, s: 0.5 + (i % 3) * 0.14 });
  }
  const ember = glowSprite('#ff7a2a', 2.2, 1.5, 0.75); ember.position.set(0, 0.55, 0.75); fp.add(ember);
  let ft = 0;
  updaters.push((dt) => {
    ft += dt;
    flames.forEach((f) => {
      const k = 0.75 + 0.25 * Math.sin(ft * 9 + f.ph) + 0.12 * Math.sin(ft * 23 + f.ph * 2);
      f.sp.scale.set(f.s * 0.6, f.s * 1.3 * k, 1);
      f.sp.position.set(f.x + Math.sin(ft * 5 + f.ph) * 0.03, 0.45 + f.s * 0.6 * k, 0.58);
    });
    fireLight.intensity = 13 + Math.sin(ft * 11) * 2 + Math.sin(ft * 27) * 1.2;
    ember.material.opacity = 0.65 + Math.sin(ft * 7) * 0.1;
  });
  // 맨틀 가랜드 + 전구
  const gpts = []; for (let i = 0; i <= 16; i++) { const tt = i / 16; gpts.push(new THREE.Vector3(-1.45 + tt * 2.9, 1.72 + Math.sin(tt * 37) * 0.03, 0.82)); }
  fp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gpts), 24, 0.09, 5), L('#24452a')));
  const mPts = []; for (let i = 0; i <= 34; i++) { const tt = i / 34; mPts.push([-1.45 + tt * 2.9, 1.7 + Math.sin(i * 2.3) * 0.08, 0.9]); }
  for (let i = 0; i <= 8; i++) { const tt = i / 8; mPts.push([-1.42, 1.65 - tt * 0.6, 0.9], [1.42, 1.65 - tt * 0.6, 0.9]); }
  const mantelLights = fairyLights(mPts, { size: 0.14 }); fp.add(mantelLights);
  // 양말 4개 (흰/빨강 교차)
  const red = L('#a8182a'), white = L('#ece4d6');
  [-0.85, -0.3, 0.3, 0.85].forEach((x, i) => {
    const m = i % 2 ? red : white; const cuff = i % 2 ? white : red;
    const s = new THREE.Group(); s.position.set(x, 1.55, 0.95); s.rotation.z = (i - 1.5) * 0.05;
    s.add(box(0.2, 0.36, 0.08, m, 0, -0.22, 0), box(0.3, 0.13, 0.08, m, 0.05, -0.4, 0), box(0.25, 0.1, 0.1, cuff, 0, 0, 0));
    fp.add(s);
  });
  // 양옆 랜턴
  const lanternGlows = [];
  [-1.15, 1.15].forEach((x) => {
    const lg = new THREE.Group(); lg.position.set(x, 0.18, 0.85); fp.add(lg);
    const blk = L('#1f1712');
    lg.add(box(0.22, 0.03, 0.22, blk, 0, 0, 0), box(0.22, 0.03, 0.22, blk, 0, 0.36, 0));
    [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]].forEach(([a, b]) => lg.add(box(0.02, 0.36, 0.02, blk, a, 0.18, b)));
    lg.add(new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.12, 4), blk).translateY(0.43));
    const g = glowSprite('#ff9a40', 0.55, 0.6); g.position.y = 0.17; lg.add(g); lanternGlows.push(g);
  });
  // 시계 화환
  const clock = new THREE.Group(); clock.position.set(0, 2.95, 0.36); fp.add(clock);
  clock.add(new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), L('#ffffff', { map: clockTex() })));
  clock.add(new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.11, 6, 24), L('#2a4a2c')));
  const cPts = []; for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; const rr = 0.47 + ((i * 5) % 3 - 1) * 0.08; cPts.push([Math.cos(a) * rr, Math.sin(a) * rr, 0.1]); }
  clock.add(fairyLights(cPts, { size: 0.12 }));

  // 빨간 초 (벽난로 앞 / 의자 앞)
  const redCandle = L('#b3121f', { emissive: '#3a0306' });
  const floorCandles = [];
  [[0.55, 0.35, 0.95], [0.8, 0.28, 1.05], [1.0, 0.38, 0.9], [-2.3, 0.25, 0.5], [-2.05, 0.3, 0.65]].forEach(([x, h, z]) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 10), redCandle); c.position.set(x, h / 2, -HD + z + (x < 0 ? 2.2 : 0.4)); root.add(c);
    const f = glowSprite('#ffc35a', 0.3, 0.4); f.position.set(c.position.x, h + 0.08, c.position.z); root.add(f); floorCandles.push(f);
  });

  // ── 왼쪽: 갈색 가죽 윙체어 + 빨간 담요 + 산타 모자 + 눈사람 인형 ──
  const chair = new THREE.Group(); chair.position.set(-3.1, 0, -1.6); chair.rotation.y = 0.5; root.add(chair);
  const leather = L('#ffffff', { map: leatherTex() });
  chair.add(box(1.05, 0.42, 0.95, leather, 0, 0.42, 0));
  chair.add(box(1.05, 1.25, 0.25, leather, 0, 1.05, -0.38));
  chair.add(box(0.2, 0.55, 0.85, leather, -0.55, 0.65, 0.05), box(0.2, 0.55, 0.85, leather, 0.55, 0.65, 0.05));
  chair.add(box(0.18, 0.45, 0.45, leather, -0.5, 1.2, -0.25), box(0.18, 0.45, 0.45, leather, 0.5, 1.2, -0.25)); // 날개
  const legM = L('#1c120a'); [[-0.42, -0.36], [0.42, -0.36], [-0.42, 0.36], [0.42, 0.36]].forEach(([x, z]) => chair.add(box(0.07, 0.22, 0.07, legM, x, 0.11, z)));
  const blanket = L('#a3141e');
  chair.add(box(0.75, 0.05, 0.9, blanket, -0.15, 0.66, 0.05), box(0.05, 0.6, 0.6, blanket, -0.67, 0.45, 0.15));
  const hat = new THREE.Group(); hat.position.set(-0.45, 1.72, -0.38); hat.rotation.z = 0.5; chair.add(hat);
  hat.add(new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 10), L('#b3121f')).translateY(0.2));
  hat.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 6, 14), white).rotateX(Math.PI / 2));
  hat.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), white).translateY(0.42));
  // 눈사람 인형 (의자 위 + 트리 옆에서 재사용)
  const snowman = () => {
    const g = new THREE.Group(); const sw = L('#f4f1ea');
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), sw).translateY(0.12));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), sw).translateY(0.3));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 5, 12), red).rotateX(Math.PI / 2).translateZ(-0.22));
    const hh = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), red); hh.position.y = 0.44; g.add(hh);
    return g;
  };
  const sm1 = snowman(); sm1.position.set(0.3, 0.64, 0.1); chair.add(sm1);
  const sm2 = snowman(); sm2.position.set(-0.7, 0.18, -2.62); sm2.scale.setScalar(1.1); root.add(sm2);

  // ── 바닥: 흰 털 러그 + 앞쪽 전구 줄 ──
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 32), L('#f2ede4'));
  rug.rotation.x = -Math.PI / 2; rug.scale.set(1.3, 0.55, 1); rug.position.set(0.1, 0.012, -1.6); root.add(rug);
  const fur = []; const fr = rng(31); // 털 느낌: 가장자리 작은 반구
  for (let i = 0; i < 40; i++) { const a = (i / 40) * Math.PI * 2; fur.push([Math.cos(a) * 1.3 * (0.95 + fr() * 0.1), Math.sin(a) * 0.55 * (0.95 + fr() * 0.1)]); }
  const furGeo = new THREE.SphereGeometry(0.07, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  const furM = new THREE.InstancedMesh(furGeo, L('#f2ede4'), fur.length); const m4 = new THREE.Matrix4();
  fur.forEach(([x, z], i) => { m4.makeTranslation(0.1 + x, 0, -1.6 + z); furM.setMatrixAt(i, m4); }); root.add(furM);
  const floorPts = []; const floorCols = []; const fc = rng(40);
  const warmC = new THREE.Color('#ffd98a');
  for (let i = 0; i <= 60; i++) { const tt = i / 60; floorPts.push([-4.2 + tt * 8.4, 0.03, -0.35 + Math.sin(tt * 11) * 0.25 + fc() * 0.05]); floorCols.push([warmC.r, warmC.g, warmC.b]); }
  const floorLights = fairyLights(floorPts, { size: 0.12, colors: floorCols }); root.add(floorLights);

  let ct = 0;
  updaters.push((dt) => {
    ct += dt;
    [...sillCandles, ...floorCandles].forEach((c, i) => { const k = 1 + Math.sin(ct * 13 + i * 2) * 0.08; c.scale.y = 0.4 * k; });
    lanternGlows.forEach((g, i) => { g.material.opacity = 0.85 + Math.sin(ct * 9 + i) * 0.1; });
    mantelLights.material.opacity = 0.85 + Math.sin(ct * 2) * 0.12;
  });

  return { update: (dt) => updaters.forEach((u) => u(dt)) };
}

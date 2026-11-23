// 통나무 오두막 거실: 벽/바닥/천장 들보, 벽난로(불꽃), 양말, 화환, 창문 밖 눈, 안락의자, 전구 줄
// 저사양 폰을 위해: 그림자 없음, Lambert 재질, 캔버스 텍스처, 파티클 최소화
import * as THREE from 'three';
import { rng, glowTexture } from '../util.js';

export const ROOM = { w: 9, d: 7, h: 3.4 };
const HW = ROOM.w / 2, HD = ROOM.d / 2;

// ── 캔버스 텍스처 ──
function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  return t;
}
const logTex = () => canvasTex(256, 256, (ctx, w, h) => {
  const r = rng(4); const n = 8; const lh = h / n;
  for (let i = 0; i < n; i++) {
    const y = i * lh;
    const g = ctx.createLinearGradient(0, y, 0, y + lh);
    const base = 120 + r() * 25;
    g.addColorStop(0, `rgb(${base * 0.55},${base * 0.33},${base * 0.18})`);
    g.addColorStop(0.35, `rgb(${base},${base * 0.62},${base * 0.36})`);
    g.addColorStop(0.8, `rgb(${base * 0.8},${base * 0.48},${base * 0.27})`);
    g.addColorStop(1, `rgb(${base * 0.35},${base * 0.2},${base * 0.1})`);
    ctx.fillStyle = g; ctx.fillRect(0, y, w, lh);
    ctx.strokeStyle = 'rgba(60,30,10,0.25)';
    for (let k = 0; k < 5; k++) { ctx.beginPath(); const yy = y + lh * (0.25 + r() * 0.5); ctx.moveTo(0, yy); ctx.bezierCurveTo(w * 0.3, yy + 2, w * 0.6, yy - 2, w, yy); ctx.stroke(); }
  }
});
const floorTex = () => canvasTex(256, 256, (ctx, w, h) => {
  const r = rng(8); const n = 6; const pw = h / n;
  for (let i = 0; i < n; i++) {
    const v = 95 + r() * 30;
    ctx.fillStyle = `rgb(${v},${v * 0.62},${v * 0.38})`; ctx.fillRect(0, i * pw, w, pw);
    ctx.fillStyle = 'rgba(30,15,5,0.6)'; ctx.fillRect(0, i * pw, w, 2);
    const cut = r() * w; ctx.fillRect(cut, i * pw, 2, pw);
  }
}, [4, 3]);
const stoneTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#4a4440'; ctx.fillRect(0, 0, w, h);
  const r = rng(12);
  for (let y = 0; y < h; y += 30) for (let x = (y / 30) % 2 ? -20 : 0; x < w; x += 44) {
    const v = 110 + r() * 50; ctx.fillStyle = `rgb(${v},${v * 0.95},${v * 0.9})`;
    ctx.beginPath(); ctx.ellipse(x + 22, y + 15, 19 + r() * 3, 12 + r() * 2, r() * 0.3, 0, 7); ctx.fill();
  }
}, [1, 1]);
const rugTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#8f1d22'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(20,60,35,0.55)';
  for (let i = 0; i < w; i += 64) { ctx.fillRect(i + 20, 0, 18, h); ctx.fillRect(0, i + 20, w, 18); }
  ctx.fillStyle = 'rgba(240,200,120,0.35)';
  for (let i = 0; i < w; i += 64) { ctx.fillRect(i + 50, 0, 3, h); ctx.fillRect(0, i + 50, w, 3); }
}, [2, 2]);
// 창밖 풍경: 밤하늘, 눈 덮인 언덕, 소나무 실루엣
const outsideTex = () => canvasTex(512, 256, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#0d1a3d'); g.addColorStop(0.6, '#2c4a7c'); g.addColorStop(1, '#6d8bbd');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = rng(30);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  for (let i = 0; i < 60; i++) ctx.fillRect(r() * w, r() * h * 0.5, 1.5, 1.5);
  ctx.fillStyle = '#16294f';
  for (let i = 0; i < 14; i++) { const x = r() * w, s = 30 + r() * 50, by = h * 0.72; ctx.beginPath(); ctx.moveTo(x, by - s * 1.6); ctx.lineTo(x - s * 0.5, by); ctx.lineTo(x + s * 0.5, by); ctx.fill(); }
  ctx.fillStyle = '#dfe9fb'; ctx.beginPath(); ctx.moveTo(0, h * 0.75);
  for (let x = 0; x <= w; x += 32) ctx.lineTo(x, h * 0.72 + Math.sin(x * 0.02) * 8);
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
  ctx.fillStyle = 'rgba(255,214,140,0.9)'; ctx.fillRect(w * 0.78, h * 0.6, 8, 6); // 먼 이웃집 불빛
});

// 구멍(창문) 뚫린 벽: ShapeGeometry UV가 미터 단위라 텍스처 반복이 자연스러움
function wallWithHoles(width, height, holes, mat) {
  const s = new THREE.Shape(); s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(width / 2, height); s.lineTo(-width / 2, height); s.closePath();
  holes.forEach(([x, y, w, h]) => { const p = new THREE.Path(); p.moveTo(x - w / 2, y - h / 2); p.lineTo(x - w / 2, y + h / 2); p.lineTo(x + w / 2, y + h / 2); p.lineTo(x + w / 2, y - h / 2); p.closePath(); s.holes.push(p); });
  const g = new THREE.ShapeGeometry(s);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.2, uv.getY(i) / 2.2);
  return new THREE.Mesh(g, mat);
}

const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }

export function buildCabin(scene, { quality }) {
  const updaters = [];
  const root = new THREE.Group(); scene.add(root);
  scene.background = new THREE.Color('#120a08');

  // ── 조명: 따뜻한 실내광 + 벽난로 불빛(깜빡임) + 창가 달빛 ──
  scene.add(new THREE.HemisphereLight('#ffd9b0', '#3a2216', 0.55));
  const moon = new THREE.DirectionalLight('#8fb0ff', 0.35); moon.position.set(6, 5, -8); scene.add(moon);
  const fireLight = new THREE.PointLight('#ff8a3d', 13, 12, 1.4); fireLight.position.set(-1.5, 0.9, -2.5); scene.add(fireLight);
  const lampLight = new THREE.PointLight('#ffc98a', 5, 8, 1.6); lampLight.position.set(-3.4, 1.6, 0.6); scene.add(lampLight);

  // ── 벽/바닥/천장 ──
  const logMat = L('#ffffff', { map: logTex() });
  const winBack = [3.3, 1.75, 1.5, 1.4];  // x, y, w, h (뒷벽 창)
  const winLeft = [0.2, 1.75, 1.6, 1.4];  // z기준 (왼벽 창)
  const back = wallWithHoles(ROOM.w, ROOM.h, [winBack], logMat); back.position.z = -HD; root.add(back);
  const left = wallWithHoles(ROOM.d, ROOM.h, [[-winLeft[0], winLeft[1], winLeft[2], winLeft[3]]], logMat);
  left.rotation.y = Math.PI / 2; left.position.x = -HW; root.add(left);
  const right = wallWithHoles(ROOM.d, ROOM.h, [], logMat); right.rotation.y = -Math.PI / 2; right.position.x = HW; root.add(right);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), L('#ffffff', { map: floorTex() }));
  floor.rotation.x = -Math.PI / 2; root.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), L('#5a3a24'));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; root.add(ceil);
  const beamMat = L('#3e2616');
  for (let x = -3; x <= 3; x += 2) root.add(box(0.28, 0.3, ROOM.d, beamMat, x, ROOM.h - 0.15, 0));
  root.add(box(ROOM.w, 0.12, 0.12, beamMat, 0, 0.06, -HD + 0.06)); // 걸레받이
  // 러그
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 40), L('#ffffff', { map: rugTex() }));
  rug.rotation.x = -Math.PI / 2; rug.scale.set(2.2, 1.5, 1); rug.position.set(-1.2, 0.01, -0.6); root.add(rug);

  // ── 창문(나무 틀 + 십자 창살 + 바깥 눈 쌓인 창턱) ──
  const frameMat = L('#f1ebe0');
  const makeWindow = (w, h) => {
    const g = new THREE.Group(); const t = 0.09;
    g.add(box(w + t * 2, t, 0.16, frameMat, 0, h / 2 + t / 2, 0), box(w + t * 2, t, 0.16, frameMat, 0, -h / 2 - t / 2, 0));
    g.add(box(t, h, 0.16, frameMat, -w / 2 - t / 2, 0, 0), box(t, h, 0.16, frameMat, w / 2 + t / 2, 0, 0));
    g.add(box(0.05, h, 0.06, frameMat, 0, 0, 0), box(w, 0.05, 0.06, frameMat, 0, 0, 0));
    g.add(box(w + 0.3, 0.06, 0.3, frameMat, 0, -h / 2 - t - 0.03, 0.12)); // 실내 창턱
    g.add(box(w, 0.12, 0.25, L('#f4f8ff', { emissive: '#223355' }), 0, -h / 2 + 0.06, -0.2)); // 바깥 눈
    return g;
  };
  const wb = makeWindow(winBack[2], winBack[3]); wb.position.set(winBack[0], winBack[1], -HD); root.add(wb);
  const wl = makeWindow(winLeft[2], winLeft[3]); wl.rotation.y = Math.PI / 2; wl.position.set(-HW, winLeft[1], winLeft[0]); root.add(wl);
  // 창 너머 풍경 (조명 영향 없음)
  const outMat = new THREE.MeshBasicMaterial({ map: outsideTex() });
  const ob = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), outMat); ob.position.set(winBack[0], 1.9, -HD - 3.5); root.add(ob);
  const ol = new THREE.Mesh(new THREE.PlaneGeometry(9, 4.5), outMat); ol.rotation.y = Math.PI / 2; ol.position.set(-HW - 3.5, 1.9, winLeft[0]); root.add(ol);
  // 창밖 눈: 창 바로 바깥의 작은 상자 영역에서만 순환 (파티클 수 최소화)
  const snowAreas = [
    { cx: winBack[0], cz: -HD - 1.4, sx: 3.0, sz: 2.4 },
    { cx: -HW - 1.4, cz: winLeft[0], sx: 2.4, sz: 3.0 },
  ];
  const per = quality.snow; const n = per * snowAreas.length;
  const pos = new Float32Array(n * 3); const seed = new Float32Array(n); const r = rng(5);
  snowAreas.forEach((a, ai) => { for (let i = 0; i < per; i++) { const k = (ai * per + i); pos.set([a.cx + (r() - 0.5) * a.sx, r() * 3.6, a.cz + (r() - 0.5) * a.sz], k * 3); seed[k] = r(); } });
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.07, map: glowTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
  snow.frustumCulled = false; root.add(snow);
  let st = 0;
  updaters.push((dt) => {
    st += dt;
    for (let i = 0; i < n; i++) {
      const k = i * 3; const s = seed[i];
      pos[k + 1] -= (0.35 + s * 0.45) * dt;
      pos[k] += Math.sin(st * 0.8 + s * 30) * 0.12 * dt;
      if (pos[k + 1] < 0.3) pos[k + 1] += 3.4;
    }
    sg.attributes.position.needsUpdate = true;
  });

  // ── 벽난로 ──
  const fp = new THREE.Group(); fp.position.set(-1.5, 0, -HD); root.add(fp);
  const stone = L('#ffffff', { map: stoneTex() });
  fp.add(box(0.55, 1.35, 0.7, stone, -0.95, 0.675, 0.35), box(0.55, 1.35, 0.7, stone, 0.95, 0.675, 0.35));
  fp.add(box(2.45, 0.4, 0.7, stone, 0, 1.55, 0.35));
  fp.add(box(1.9, 1.65, 0.55, stone, 0, 2.6, 0.27)); // 굴뚝 몸체
  fp.add(box(2.8, 0.14, 1.0, stone, 0, 0.07, 0.5));  // 화로 바닥
  fp.add(box(1.4, 1.35, 0.1, L('#120806'), 0, 0.675, 0.05)); // 안쪽 그을음
  fp.add(box(2.7, 0.12, 0.85, L('#5b361d'), 0, 1.81, 0.42)); // 맨틀 선반
  const logM = L('#4a2c18');
  [[-0.25, 0.25, 0.3], [0.25, 0.25, -0.3], [0, 0.38, 0.05]].forEach(([x, y, rz]) => {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.9, 7), logM); lg.rotation.set(0, 0.2, Math.PI / 2 + rz); lg.position.set(x * 0.6, y, 0.35); fp.add(lg);
  });
  // 불꽃: 캔버스 불꽃 텍스처 스프라이트 몇 장을 흔들기 (가벼움)
  const flameTex = canvasTex(64, 128, (ctx) => {
    const g = ctx.createRadialGradient(32, 96, 2, 32, 80, 60);
    g.addColorStop(0, 'rgba(255,250,210,1)'); g.addColorStop(0.25, 'rgba(255,200,80,0.95)'); g.addColorStop(0.55, 'rgba(255,110,30,0.6)'); g.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(32, 0); ctx.bezierCurveTo(60, 50, 64, 90, 32, 128); ctx.bezierCurveTo(0, 90, 4, 50, 32, 0); ctx.fill();
  });
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const x = (i - 2.5) * 0.15; sp.position.set(x, 0.62, 0.38); fp.add(sp);
    flames.push({ sp, x, ph: i * 1.7, s: 0.45 + (i % 3) * 0.12 });
  }
  const ember = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff7a2a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  ember.scale.set(2.2, 1.4, 1); ember.position.set(0, 0.5, 0.5); fp.add(ember);
  let ft = 0;
  updaters.push((dt) => {
    ft += dt;
    flames.forEach((f) => {
      const k = 0.75 + 0.25 * Math.sin(ft * 9 + f.ph) + 0.12 * Math.sin(ft * 23 + f.ph * 2);
      f.sp.scale.set(f.s * 0.6 * (0.9 + 0.1 * Math.sin(ft * 13 + f.ph)), f.s * 1.3 * k, 1);
      f.sp.position.set(f.x + Math.sin(ft * 5 + f.ph) * 0.03, 0.38 + f.s * 0.6 * k, 0.38);
    });
    fireLight.intensity = 12 + Math.sin(ft * 11) * 2.5 + Math.sin(ft * 27) * 1.5;
    ember.material.opacity = 0.65 + Math.sin(ft * 7) * 0.12;
  });
  // 맨틀 위 양말 3개
  const red = L('#b5162a'), white = L('#f5f1ea'), green = L('#1d5a37');
  [[-0.8, red], [0, green], [0.8, red]].forEach(([x, m]) => {
    const s = new THREE.Group(); s.position.set(x, 1.68, 0.82);
    s.add(box(0.2, 0.36, 0.08, m, 0, -0.2, 0), box(0.28, 0.12, 0.08, m, 0.05, -0.38, 0), box(0.24, 0.09, 0.1, white, 0, 0, 0));
    s.rotation.z = 0.05 * (x || 1); fp.add(s);
  });
  // 맨틀 위 가랜드 + 촛불
  const gpts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; gpts.push(new THREE.Vector3(-1.3 + t * 2.6, 1.92 - Math.sin(t * Math.PI * 3) ** 2 * 0.06, 0.82)); }
  fp.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(gpts), 24, 0.06, 5), L('#1f5a3a')));
  [-1.1, 1.1].forEach((x) => {
    fp.add(box(0.08, 0.28, 0.08, white, x, 2.01, 0.5));
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcc66', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    c.scale.set(0.35, 0.45, 1); c.position.set(x, 2.22, 0.5); fp.add(c);
  });
  // 화환
  const wreath = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.11, 6, 20), L('#1f5a3a'));
  wreath.position.set(0, 2.65, 0.57); fp.add(wreath);
  const bow = box(0.22, 0.14, 0.06, red, 0, 2.28, 0.62); fp.add(bow);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), red); b.position.set(Math.cos(a) * 0.42, 2.65 + Math.sin(a) * 0.42, 0.68); fp.add(b); }

  // ── 안락의자 + 협탁(램프, 머그) ──
  const chair = new THREE.Group(); chair.position.set(-3.3, 0, 0.3); chair.rotation.y = 0.9; root.add(chair);
  const fabric = L('#7a1f24');
  chair.add(box(1.0, 0.45, 0.9, fabric, 0, 0.32, 0), box(1.0, 0.85, 0.22, fabric, 0, 0.75, -0.38));
  chair.add(box(0.2, 0.6, 0.9, fabric, -0.5, 0.45, 0), box(0.2, 0.6, 0.9, fabric, 0.5, 0.45, 0));
  chair.add(box(0.7, 0.12, 0.6, L('#e9dcc2'), 0, 0.6, 0.05)); // 담요
  const table = new THREE.Group(); table.position.set(-3.6, 0, 1.35); root.add(table);
  const wood = L('#5b361d');
  table.add(box(0.6, 0.06, 0.6, wood, 0, 0.6, 0), box(0.06, 0.6, 0.06, wood, 0, 0.3, 0), box(0.4, 0.04, 0.4, wood, 0, 0.02, 0));
  table.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 10), L('#c8202f')).translateY(0.68).translateX(0.15));
  table.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 8), L('#c9a35a')).translateY(0.88).translateX(-0.12));
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 0.26, 12, 1, true), L('#f5e2b8', { emissive: '#ffbb66', emissiveIntensity: 0.7, side: THREE.DoubleSide }));
  shade.position.set(-0.12, 1.2, 0); table.add(shade);

  // ── 천장 아래 전구 줄 (뒷벽 + 왼벽) ──
  const bulbN = 46; const palette = ['#ffd77a', '#ff5a5a', '#6fd0ff', '#8cff8a', '#ffb0f0'].map((c) => new THREE.Color(c));
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), bulbN);
  const m4 = new THREE.Matrix4(); const bulbPh = [];
  for (let i = 0; i < bulbN; i++) {
    const t = i / (bulbN - 1);
    let x, z; if (t < 0.62) { x = -HW + 0.1 + (t / 0.62) * (ROOM.w - 0.2); z = -HD + 0.08; } else { x = -HW + 0.08; z = -HD + 0.1 + ((t - 0.62) / 0.38) * (ROOM.d - 0.2); }
    const sag = Math.abs(Math.sin(i * 0.9)) * 0.12;
    m4.makeTranslation(x, ROOM.h - 0.3 - sag, z); bulbs.setMatrixAt(i, m4);
    bulbs.setColorAt(i, palette[i % palette.length]); bulbPh.push(Math.random() * 6);
  }
  root.add(bulbs);
  const tmp = new THREE.Color(); let bt = 0;
  updaters.push((dt) => {
    bt += dt;
    for (let i = 0; i < bulbN; i++) bulbs.setColorAt(i, tmp.copy(palette[i % palette.length]).multiplyScalar(0.55 + 0.45 * (0.5 + 0.5 * Math.sin(bt * 2 + bulbPh[i]))));
    bulbs.instanceColor.needsUpdate = true;
  });

  return { update: (dt) => updaters.forEach((u) => u(dt)) };
}

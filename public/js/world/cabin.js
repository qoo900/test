// 크리스마스 거실: 황금빛 나무 판자 벽, 붉은 벽돌 벽난로(불꽃·전구·촛대·양말·화환), 빨간 커튼 창(창밖 눈·곰인형),
// 빨간 안락의자와 니트 담요, 사과 바구니, 바닥 랜턴
// 저사양 폰을 위해: 그림자 없음, Lambert 재질, 캔버스 텍스처, 전구/눈은 Points 1회 드로우
import * as THREE from 'three';
import { rng, glowTexture } from '../util.js';

export const ROOM = { w: 9, d: 7, h: 3.6 };
const HW = ROOM.w / 2, HD = ROOM.d / 2;

function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat);
  return t;
}
// 세로 나무 판자 (황금빛)
const plankTex = () => canvasTex(256, 256, (ctx, w, h) => {
  const r = rng(4); const n = 6; const pw = w / n;
  for (let i = 0; i < n; i++) {
    const v = 0.85 + r() * 0.2;
    ctx.fillStyle = `rgb(${190 * v},${120 * v},${62 * v})`; ctx.fillRect(i * pw, 0, pw, h);
    ctx.strokeStyle = 'rgba(110,60,25,0.18)';
    for (let k = 0; k < 6; k++) { const x = i * pw + r() * pw; ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 3, h * 0.3, x - 3, h * 0.6, x + 1, h); ctx.stroke(); }
    ctx.fillStyle = 'rgba(70,35,12,0.55)'; ctx.fillRect(i * pw, 0, 2, h);
  }
});
const floorTex = () => canvasTex(256, 256, (ctx, w, h) => {
  const r = rng(8); const n = 6; const pw = h / n;
  for (let i = 0; i < n; i++) {
    const v = 0.85 + r() * 0.2;
    ctx.fillStyle = `rgb(${160 * v},${100 * v},${55 * v})`; ctx.fillRect(0, i * pw, w, pw);
    ctx.fillStyle = 'rgba(60,30,10,0.5)'; ctx.fillRect(0, i * pw, w, 2); ctx.fillRect(r() * w, i * pw, 2, pw);
  }
}, [4, 3]);
// 붉은 벽돌
const brickTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#d9c3a5'; ctx.fillRect(0, 0, w, h); // 줄눈
  const r = rng(12); const bh = 32, bw = 64;
  for (let y = 0; y < h; y += bh) for (let x = (y / bh) % 2 ? -bw / 2 : 0; x < w; x += bw) {
    const v = 0.8 + r() * 0.3;
    ctx.fillStyle = `rgb(${178 * v},${88 * v},${58 * v})`; ctx.fillRect(x + 3, y + 3, bw - 6, bh - 6);
    ctx.fillStyle = 'rgba(255,220,180,0.12)'; ctx.fillRect(x + 3, y + 3, bw - 6, 4);
  }
}, [1, 1]);
const knitTex = (base) => canvasTex(64, 64, (ctx, w, h) => {
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
  for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 8); ctx.lineTo(x + 8, y); ctx.stroke(); }
}, [3, 3]);
const pillowTex = () => canvasTex(128, 96, (ctx, w, h) => {
  ctx.fillStyle = '#c5222b'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#f3e3c8'; ctx.font = 'bold 54px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🦌', w / 2, h / 2 + 4);
  ctx.fillRect(0, 10, w, 4); ctx.fillRect(0, h - 14, w, 4);
});
const outsideTex = () => canvasTex(256, 512, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#060a18'); g.addColorStop(0.7, '#141c34'); g.addColorStop(1, '#2a3550');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#dde6f5'; ctx.fillRect(0, h * 0.86, w, h * 0.14);
});

function wallWithHoles(width, height, holes, mat) {
  const s = new THREE.Shape(); s.moveTo(-width / 2, 0); s.lineTo(width / 2, 0); s.lineTo(width / 2, height); s.lineTo(-width / 2, height); s.closePath();
  holes.forEach(([x, y, w, h]) => { const p = new THREE.Path(); p.moveTo(x - w / 2, y - h / 2); p.lineTo(x - w / 2, y + h / 2); p.lineTo(x + w / 2, y + h / 2); p.lineTo(x + w / 2, y - h / 2); p.closePath(); s.holes.push(p); });
  const g = new THREE.ShapeGeometry(s);
  const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2.0, uv.getY(i) / 2.0);
  return new THREE.Mesh(g, mat);
}
const L = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
function box(w, h, d, mat, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; }
const glowSprite = (color, sx, sy, opacity = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity })); s.scale.set(sx, sy, 1); return s; };

export function buildCabin(scene, { quality }) {
  const updaters = [];
  const root = new THREE.Group(); scene.add(root);
  scene.background = new THREE.Color('#1a0d06');

  // ── 조명: 황금빛 ──
  scene.add(new THREE.HemisphereLight('#ffcf94', '#4a2a14', 0.75));
  const fireLight = new THREE.PointLight('#ff8f3a', 10, 9, 1.4); fireLight.position.set(-1.7, 0.7, -2.6); scene.add(fireLight);
  const warmFill = new THREE.PointLight('#ffb766', 6, 12, 1.2); warmFill.position.set(0, 2.6, 0.5); scene.add(warmFill);

  // ── 벽/바닥/천장 ──
  const wallMat = L('#ffffff', { map: plankTex() });
  const win = [3.65, 1.75, 1.3, 2.1]; // 뒷벽 창 x, y, w, h
  const back = wallWithHoles(ROOM.w, ROOM.h, [win], wallMat); back.position.z = -HD; root.add(back);
  const left = wallWithHoles(ROOM.d, ROOM.h, [], wallMat); left.rotation.y = Math.PI / 2; left.position.x = -HW; root.add(left);
  const right = wallWithHoles(ROOM.d, ROOM.h, [], wallMat); right.rotation.y = -Math.PI / 2; right.position.x = HW; root.add(right);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), L('#ffffff', { map: floorTex() }));
  floor.rotation.x = -Math.PI / 2; root.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), L('#3a2414')); ceil.rotation.x = Math.PI / 2; ceil.position.y = ROOM.h; root.add(ceil);
  root.add(box(ROOM.w, 0.14, 0.06, L('#5a3218'), 0, 0.07, -HD + 0.03)); // 걸레받이

  // ── 창 + 빨간 커튼 + 창턱 곰인형 ──
  const frame = L('#efe6d8');
  const wg = new THREE.Group(); wg.position.set(win[0], win[1], -HD); root.add(wg);
  const [ww, wh] = [win[2], win[3]]; const t = 0.08;
  wg.add(box(ww + t * 2, t, 0.14, frame, 0, wh / 2 + t / 2, 0), box(ww + t * 2, t, 0.14, frame, 0, -wh / 2 - t / 2, 0));
  wg.add(box(t, wh, 0.14, frame, -ww / 2 - t / 2, 0, 0), box(t, wh, 0.14, frame, ww / 2 + t / 2, 0, 0));
  wg.add(box(0.05, wh, 0.05, frame, 0, 0, 0)); [-wh / 6, wh / 6].forEach((y) => wg.add(box(ww, 0.05, 0.05, frame, 0, y, 0)));
  wg.add(box(ww + 0.5, 0.08, 0.45, frame, 0, -wh / 2 - 0.12, 0.2)); // 창턱 벤치
  const curtain = L('#8e1a1f');
  wg.add(box(0.45, wh + 0.9, 0.1, curtain, -ww / 2 - 0.3, 0.25, 0.15));
  wg.add(box(0.3, wh + 0.9, 0.1, curtain, ww / 2 + 0.2, 0.25, 0.15));
  wg.add(box(ww + 1.2, 0.05, 0.05, L('#3a2210'), 0, wh / 2 + 0.6, 0.18)); // 커튼봉
  // 곰인형
  const bear = new THREE.Group(); bear.position.set(0.35, -wh / 2 - 0.08 + 0.02, 0.25);
  const fur = L('#8a5a36');
  const bBody = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), fur); bBody.position.y = 0.13; bBody.scale.y = 1.1;
  const bHead = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fur); bHead.position.y = 0.32;
  bear.add(bBody, bHead);
  [-0.07, 0.07].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), fur); e.position.set(x, 0.41, 0); bear.add(e); });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.025, 5, 12), L('#c5222b')); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.24; bear.add(scarf);
  wg.add(bear);
  // 창밖 (조명 영향 없음) + 눈
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(4, 5), new THREE.MeshBasicMaterial({ map: outsideTex() }));
  outside.position.set(win[0], 1.8, -HD - 2.6); root.add(outside);
  const n = quality.snow; const pos = new Float32Array(n * 3); const seed = new Float32Array(n); const r = rng(5);
  for (let i = 0; i < n; i++) { pos.set([win[0] + (r() - 0.5) * 2.6, r() * 3.6, -HD - 0.3 - r() * 1.8], i * 3); seed[i] = r(); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.06, map: glowTexture(), transparent: true, depthWrite: false, color: '#ffffff' }));
  snow.frustumCulled = false; root.add(snow);
  let st = 0;
  updaters.push((dt) => {
    st += dt;
    for (let i = 0; i < n; i++) { const k = i * 3; const s = seed[i]; pos[k + 1] -= (0.3 + s * 0.4) * dt; pos[k] += Math.sin(st * 0.7 + s * 30) * 0.1 * dt; if (pos[k + 1] < 0.4) pos[k + 1] += 3.2; }
    sg.attributes.position.needsUpdate = true;
  });

  // ── 벽난로 (붉은 벽돌) ──
  const fp = new THREE.Group(); fp.position.set(-1.75, 0, -HD); root.add(fp);
  const brick = L('#ffffff', { map: brickTex() });
  fp.add(box(0.55, 1.75, 0.6, brick, -0.95, 0.875, 0.3), box(0.55, 1.75, 0.6, brick, 0.95, 0.875, 0.3));
  fp.add(box(2.45, 0.55, 0.6, brick, 0, 1.475, 0.3));
  fp.add(box(2.45, 0.22, 0.75, brick, 0, 0.11, 0.38)); // 화로 단
  fp.add(box(1.36, 1.0, 0.1, L('#7a3a22'), 0, 0.72, 0.04)); // 안쪽 벽돌 그을음
  fp.add(box(1.36, 0.02, 0.5, L('#2a140a'), 0, 0.23, 0.3));
  fp.add(box(2.75, 0.1, 0.72, L('#3b2010'), 0, 1.8, 0.34)); // 맨틀
  const logM = L('#3a2112');
  [[-0.2, 0.3, 0.25], [0.2, 0.3, -0.25], [0, 0.42, 0.05]].forEach(([x, y, rz]) => {
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 7), logM); lg.rotation.set(0, 0.25, Math.PI / 2 + rz); lg.position.set(x, y, 0.3); fp.add(lg);
  });
  const flameTex = canvasTex(64, 128, (ctx) => {
    const g = ctx.createRadialGradient(32, 100, 2, 32, 80, 64);
    g.addColorStop(0, 'rgba(255,250,215,1)'); g.addColorStop(0.25, 'rgba(255,205,90,0.95)'); g.addColorStop(0.55, 'rgba(255,115,30,0.6)'); g.addColorStop(1, 'rgba(200,40,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(32, 0); ctx.bezierCurveTo(60, 50, 64, 90, 32, 128); ctx.bezierCurveTo(0, 90, 4, 50, 32, 0); ctx.fill();
  });
  const flames = [];
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const x = (i - 2.5) * 0.14; fp.add(sp); flames.push({ sp, x, ph: i * 1.7, s: 0.42 + (i % 3) * 0.12 });
  }
  const ember = glowSprite('#ff7a2a', 2.0, 1.3, 0.7); ember.position.set(0, 0.5, 0.5); fp.add(ember);
  let ft = 0;
  updaters.push((dt) => {
    ft += dt;
    flames.forEach((f) => {
      const k = 0.75 + 0.25 * Math.sin(ft * 9 + f.ph) + 0.12 * Math.sin(ft * 23 + f.ph * 2);
      f.sp.scale.set(f.s * 0.6, f.s * 1.3 * k, 1);
      f.sp.position.set(f.x + Math.sin(ft * 5 + f.ph) * 0.03, 0.42 + f.s * 0.6 * k, 0.32);
    });
    fireLight.intensity = 9 + Math.sin(ft * 11) * 1.6 + Math.sin(ft * 27) * 1;
    ember.material.opacity = 0.6 + Math.sin(ft * 7) * 0.1;
  });

  // 벽난로 테두리 + 맨틀을 따라 늘어진 웜화이트 전구 (Points)
  const fairy = [];
  for (let i = 0; i <= 30; i++) { const tt = i / 30; fairy.push([-1.32 + tt * 2.64, 1.74 - Math.sin(tt * Math.PI * 5) ** 2 * 0.08, 0.72]); }
  for (let i = 0; i <= 14; i++) { const tt = i / 14; fairy.push([-1.28 + Math.sin(tt * 9) * 0.03, 1.7 - tt * 1.5, 0.62]); fairy.push([1.28 + Math.sin(tt * 9) * 0.03, 1.7 - tt * 1.5, 0.62]); }
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fairy.flat(), 3));
  const fairyPts = new THREE.Points(fg, new THREE.PointsMaterial({ size: 0.16, map: glowTexture(), color: '#ffe1a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  fp.add(fairyPts);
  // 양말 2개
  const red = L('#b5162a'), white = L('#f5ecdc');
  [[-0.75], [0.75]].forEach(([x], i) => {
    const s = new THREE.Group(); s.position.set(x, 1.68, 0.72); s.rotation.z = i ? -0.08 : 0.08;
    s.add(box(0.22, 0.42, 0.08, red, 0, -0.26, 0), box(0.32, 0.14, 0.08, red, i ? -0.06 : 0.06, -0.46, 0), box(0.27, 0.11, 0.1, white, 0, 0, 0));
    fp.add(s);
  });
  // 벽돌 위 작은 화환
  const smallWreath = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 5, 16), L('#2c5a2e')); smallWreath.position.set(0, 1.5, 0.62); fp.add(smallWreath);
  // 맨틀 위: 5구 촛대, 빨간 랜턴, 화분
  const brass = L('#c9a14a', { emissive: '#3a2a08' });
  const cand = new THREE.Group(); cand.position.set(0.55, 1.85, 0.32); fp.add(cand);
  cand.add(box(0.6, 0.03, 0.03, brass, 0, 0.18, 0), box(0.03, 0.2, 0.03, brass, 0, 0.09, 0), box(0.16, 0.03, 0.12, brass, 0, 0.01, 0));
  const candles = [];
  [-0.28, -0.14, 0, 0.14, 0.28].forEach((x) => {
    cand.add(box(0.035, 0.16, 0.035, white, x, 0.28, 0));
    const fl = glowSprite('#ffcf70', 0.22, 0.3); fl.position.set(x, 0.39, 0); cand.add(fl); candles.push(fl);
  });
  const lantern = new THREE.Group(); lantern.position.set(-0.45, 1.85, 0.4); fp.add(lantern);
  lantern.add(box(0.16, 0.26, 0.16, L('#a1161e', { emissive: '#3a0505' }), 0, 0.13, 0));
  const lglow = glowSprite('#ffb050', 0.5, 0.5, 0.8); lglow.position.y = 0.13; lantern.add(lglow);
  const plant = new THREE.Group(); plant.position.set(-1.15, 1.85, 0.4); fp.add(plant);
  plant.add(box(0.14, 0.16, 0.14, L('#d8d2c4'), 0, 0.08, 0));
  for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), red); b.position.set(Math.cos(i) * 0.1, 0.3 + (i % 2) * 0.08, Math.sin(i) * 0.05); plant.add(b); }
  plant.add(new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), L('#2c5a2e')).translateY(0.3));
  // 벽에 걸린 큰 화환 (빛나는 전구)
  const wreath = new THREE.Group(); wreath.position.set(-0.05, 2.75, 0.06); fp.add(wreath);
  wreath.add(new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.14, 7, 24), L('#2c5a2e')));
  const wl = []; for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; const rr = 0.45 + ((i * 7) % 3 - 1) * 0.08; wl.push(Math.cos(a) * rr, Math.sin(a) * rr, 0.12); }
  const wlg = new THREE.BufferGeometry(); wlg.setAttribute('position', new THREE.Float32BufferAttribute(wl, 3));
  wreath.add(new THREE.Points(wlg, new THREE.PointsMaterial({ size: 0.16, map: glowTexture(), color: '#ffe1a0', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), red); b.position.set(Math.cos(a) * 0.45, Math.sin(a) * 0.45, 0.13); wreath.add(b); }
  wreath.add(box(0.24, 0.14, 0.06, red, 0, -0.45, 0.15));

  // ── 왼쪽: 빨간 안락의자 + 니트 담요 + 사슴 쿠션 ──
  const chair = new THREE.Group(); chair.position.set(-3.75, 0, -1.4); chair.rotation.y = 0.45; root.add(chair);
  const fabric = L('#7d1a1f');
  chair.add(box(1.1, 0.45, 0.95, fabric, 0, 0.32, 0), box(1.1, 0.95, 0.24, fabric, 0, 0.8, -0.4));
  chair.add(box(0.22, 0.65, 0.95, fabric, -0.55, 0.48, 0), box(0.22, 0.65, 0.95, fabric, 0.55, 0.48, 0));
  const knit = L('#ffffff', { map: knitTex('#9b1b22') });
  chair.add(box(0.95, 0.06, 1.0, knit, 0.05, 0.58, 0.05), box(0.95, 0.5, 0.05, knit, 0.05, 0.35, 0.53));
  const pillow = box(0.55, 0.38, 0.14, L('#ffffff', { map: pillowTex() }), 0.05, 0.82, -0.22); pillow.rotation.x = -0.15; chair.add(pillow);
  // 사과 바구니
  const basket = new THREE.Group(); basket.position.set(-2.95, 0, -0.35); root.add(basket);
  basket.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.26, 0.24, 12, 1, true), L('#8a5a2c', { side: THREE.DoubleSide })).translateY(0.12));
  const appleM = L('#c01c22', { emissive: '#2a0000' });
  for (let i = 0; i < 9; i++) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), appleM); const an = i * 2.4; const rr = i ? 0.17 : 0; a.position.set(Math.cos(an) * rr, 0.26 + (i > 5 ? 0.06 : 0), Math.sin(an) * rr); basket.add(a); }
  // 바닥 랜턴 (벽난로 옆)
  const fl = new THREE.Group(); fl.position.set(-0.45, 0, -2.75); root.add(fl);
  const black = L('#1c1714');
  fl.add(box(0.26, 0.04, 0.26, black, 0, 0.02, 0), box(0.26, 0.04, 0.26, black, 0, 0.5, 0));
  [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([x, z]) => fl.add(box(0.02, 0.48, 0.02, black, x, 0.26, z)));
  fl.add(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.14, 4), black).translateY(0.58));
  fl.add(box(0.07, 0.16, 0.07, white, 0, 0.12, 0));
  const flg = glowSprite('#ffc060', 0.55, 0.65); flg.position.y = 0.28; fl.add(flg);

  let ct = 0;
  updaters.push((dt) => {
    ct += dt;
    candles.forEach((c, i) => { const k = 1 + Math.sin(ct * 13 + i * 2) * 0.08; c.scale.set(0.22 * k, 0.3 * k, 1); });
    flg.material.opacity = 0.85 + Math.sin(ct * 9) * 0.1;
    fairyPts.material.opacity = 0.85 + Math.sin(ct * 2) * 0.12;
  });

  return { update: (dt) => updaters.forEach((u) => u(dt)) };
}

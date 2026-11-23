// 창밖 3D 풍경: 눈 덮인 땅, 소나무 숲, 겹겹 설산, 이웃 오두막(불 켜진 창·굴뚝 연기), 가로등, 울타리, 하늘(달·별/해·구름), 깊이감 있는 눈
// 걸어 다닐 때 원근감이 살도록 평면 그림 대신 실제 오브젝트로 배치. 저사양을 위해 InstancedMesh + Lambert 위주.
import * as THREE from 'three';
import { glowTexture, rng } from '../util.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const L = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });

function skyTexture(day) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512; const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 512);
  if (day) { g.addColorStop(0, '#5f93d6'); g.addColorStop(0.55, '#a9c8ec'); g.addColorStop(0.85, '#e4eef9'); g.addColorStop(1, '#f6f9fd'); }
  else { g.addColorStop(0, '#03060f'); g.addColorStop(0.45, '#0e1a3a'); g.addColorStop(0.8, '#2a3f6e'); g.addColorStop(1, '#4b6299'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildOutside(scene, { low }) {
  const root = new THREE.Group(); scene.add(root);
  const updaters = []; const r = rng(314);
  // 실내(6m 이내)는 영향 없고 먼 풍경만 옅어지도록 안개
  scene.fog = new THREE.Fog('#24365e', 9, 70);

  // ── 하늘: 반구 돔 ──
  const skyNight = skyTexture(false), skyDay = skyTexture(true);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(120, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ map: skyNight, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.position.set(0, -2, -10); root.add(sky);
  // 별
  const sp = []; for (let i = 0; i < 500; i++) { const a = r() * Math.PI - Math.PI, el = 0.08 + r() * 1.3; sp.push(Math.sin(a) * Math.cos(el) * 110, Math.sin(el) * 110 - 2, Math.cos(a) * Math.cos(el) * 110 - 10); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: '#dfe7ff', transparent: true, opacity: 0.85, fog: false, depthWrite: false })); root.add(stars);
  // 달 / 해
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(3.2, 32), new THREE.MeshBasicMaterial({ color: '#fff6dc', fog: false }));
  moonDisc.position.set(22, 30, -95); moonDisc.lookAt(0, 1.5, 0); root.add(moonDisc);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#cfdcff', transparent: true, opacity: 0.55, fog: false, depthWrite: false })); moonGlow.scale.setScalar(26); moonGlow.position.copy(moonDisc.position); root.add(moonGlow);
  // 구름(낮): 부드러운 흰 스프라이트 덩어리
  const clouds = new THREE.Group(); root.add(clouds);
  for (let i = 0; i < 9; i++) {
    const cg = new THREE.Group(); cg.position.set(-50 + r() * 100, 18 + r() * 14, -70 - r() * 25);
    for (let k = 0; k < 5; k++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, opacity: 0.55, fog: false, depthWrite: false })); s.scale.set(10 + r() * 8, 4 + r() * 3, 1); s.position.set((k - 2) * 4 + r() * 2, r() * 2, 0); cg.add(s); }
    clouds.add(cg);
  }

  // ── 땅: 살짝 굴곡진 눈밭 ──
  const gg = new THREE.PlaneGeometry(160, 120, 64, 48); gg.rotateX(-Math.PI / 2);
  { const p = gg.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const d = Math.max(0, -z - 4); p.setY(i, (Math.sin(x * 0.12) * 0.6 + Math.cos(z * 0.09 + x * 0.05) * 0.8) * Math.min(1, d / 20)); } gg.computeVertexNormals(); }
  const ground = new THREE.Mesh(gg, L('#e9eef8', { emissive: '#1d2b4d' })); ground.position.set(0, -0.02, -62); root.add(ground);

  // ── 겹겹 설산 ──
  const mtn = L('#5d6b92', { flatShading: true }), cap = L('#f1f5ff', { flatShading: true });
  for (let i = 0; i < 16; i++) {
    const x = -80 + i * 11 + r() * 6, z = -70 - r() * 30, h = 18 + r() * 22, rad = 14 + r() * 12;
    const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 7), mtn); m.position.set(x, h / 2 - 1, z); m.rotation.y = r() * 3; root.add(m);
    const c = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.38, h * 0.38, 7), cap); c.position.set(x, h - 1 - h * 0.19 + 0.1, z); c.rotation.y = m.rotation.y; root.add(c);
  }

  // ── 소나무 숲 (인스턴싱): 줄기 + 잎 2단 + 눈 모자 ──
  const spots = [];
  for (let i = 0; i < (low ? 70 : 120); i++) {
    const z = -5 - Math.pow(r(), 0.8) * 38, x = -18 + r() * 40;
    if (z > -19 && x > -0.5 && x < 7.5) continue; // 창으로 보이는 방향은 탁 트인 눈밭으로 비워 둠
    spots.push([x, z, 0.7 + r() * 0.9, r() * 6]);
  }
  [[-1.2, -6.5, 1.1], [8.6, -8, 1.3], [-2.4, -10, 1.2], [9.5, -12, 1.0], [3.2, -21, 1.2], [5.4, -23, 1.4]].forEach(([x, z, s]) => spots.push([x, z, s, r() * 6])); // 창 양옆을 감싸는 나무
  // 소나무: 매끈한 곡선 단 3개(살짝 오목한 실루엣) + 꼭대기에만 눈. 디테일을 줄여 차분하게
  function tier(r0, h, y0) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(r0 * (1 - t) * (1 - 0.18 * Math.sin(t * Math.PI)), y0 + h * t)); }
    pts.unshift(new THREE.Vector2(0, y0)); return new THREE.LatheGeometry(pts, 16);
  }
  const foliageGeo = mergeGeometries([tier(1.3, 1.9, 0.7), tier(1.0, 1.6, 1.75), tier(0.7, 1.4, 2.7)]);
  const snowGeo = (() => { const g = tier(0.42, 0.62, 3.48); return g; })();
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.15, 0.9, 8).translate(0, 0.45, 0);
  const treeParts = [[trunkGeo, L('#4a3627')], [foliageGeo, L('#2f5e3f')], [snowGeo, L('#f3f6fc')]];
  const treeMats = [treeParts[1][1]];
  const calm = spots.filter((_, i) => i % 2 === 0); // 절반만 → 듬성듬성
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); const tint = new THREE.Color();
  for (const [geo, mat] of treeParts) {
    const im = new THREE.InstancedMesh(geo, mat, calm.length);
    calm.forEach(([x, z, s, ry], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry); sc.set(s, s * (0.95 + (i % 4) * 0.05), s); m4.compose(new THREE.Vector3(x, 0, z), q, sc); im.setMatrixAt(i, m4);
      if (geo === foliageGeo) { tint.setHSL(0.36, 0.3, 0.9 + ((i * 53) % 10) / 70); im.setColorAt(i, tint); }
    });
    root.add(im);
  }

  // ── 이웃 오두막: 불 켜진 창 + 굴뚝 연기 ──
  const cabin = new THREE.Group(); cabin.position.set(10.5, 0, -30); cabin.rotation.y = -0.6; cabin.scale.setScalar(0.9); root.add(cabin);
  const logs = L('#6b4a32'); const snowM = L('#f3f6fd');
  cabin.add(new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 4), logs).translateY(1.3));
  const roofG = new THREE.CylinderGeometry(0.01, 3.6, 1.8, 4, 1); roofG.rotateY(Math.PI / 4); roofG.scale(1.05, 1, 0.78);
  const roof = new THREE.Mesh(roofG, L('#3a2c26')); roof.position.y = 3.5; cabin.add(roof);
  const roofSnow = new THREE.Mesh(roofG.clone().scale(1.02, 0.55, 1.02), snowM); roofSnow.position.y = 3.95; cabin.add(roofSnow);
  const winMat = new THREE.MeshBasicMaterial({ color: '#ffbe6a' });
  [[-1.2, 1.4], [1.1, 1.4]].forEach(([x, y]) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.8), winMat); w.position.set(x, y, 2.01); cabin.add(w); });
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.6), L('#3b2618')); door.position.set(0, 0.8, 2.01); cabin.add(door);
  const cabGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb35c', transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })); cabGlow.scale.set(3.2, 1.6, 1); cabGlow.position.set(0, 1.4, 2.4); cabin.add(cabGlow);
  cabin.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, 0.5), L('#6e6862')).translateX(1.4).translateY(4.0));
  const smoke = []; for (let i = 0; i < 10; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#c9d0de', transparent: true, opacity: 0.0, depthWrite: false })); cabin.add(s); smoke.push({ s, t: i / 10 }); }
  updaters.push((dt) => smoke.forEach((p) => { p.t = (p.t + dt * 0.08) % 1; const k = p.t; p.s.position.set(1.4 + Math.sin(k * 6) * 0.3 + k * 1.2, 4.9 + k * 4, 0); p.s.scale.setScalar(0.6 + k * 2.2); p.s.material.opacity = 0.32 * Math.sin(k * Math.PI); }));

  // ── 가로등 + 울타리 ──
  const lampPost = new THREE.Group(); lampPost.position.set(0.4, 0, -5.6); root.add(lampPost);
  lampPost.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.8, 8), L('#1e1e22')).translateY(1.4));
  lampPost.add(new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.36, 0.28), new THREE.MeshBasicMaterial({ color: '#ffd59a' })).translateY(2.95));
  lampPost.add(new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 4).rotateY(Math.PI / 4), L('#1e1e22')).translateY(3.22));
  const postGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc77a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending })); postGlow.scale.setScalar(1.1); postGlow.position.y = 2.95; lampPost.add(postGlow);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(1.6, 24), new THREE.MeshBasicMaterial({ map: glowTexture(), color: '#ffcf8a', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }));
  pool.rotation.x = -Math.PI / 2; pool.position.set(0.4, 0.02, -5.6); root.add(pool);
  const fence = new THREE.Group(); root.add(fence); const wood = L('#5a4030');
  for (let i = 0; i < 16; i++) { const x = -2 + i * 0.9; fence.add(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.9, 0.09), wood).translateX(x).translateY(0.45).translateZ(-7.5)); fence.add(new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.06, 0.11), snowM).translateX(x).translateY(0.93).translateZ(-7.5)); }
  [0.35, 0.7].forEach((y) => fence.add(new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.06, 0.05), wood).translateX(4.75).translateY(y).translateZ(-7.5)));

  // ── 눈: 창 앞(가까움)부터 먼 곳까지 깊이감 있게 ──
  const n = low ? 700 : 1400; const pos = new Float32Array(n * 3); const sd = new Float32Array(n);
  for (let i = 0; i < n; i++) { const near = i < n * 0.45; pos.set([-3 + r() * 11, r() * 6, near ? -2.95 - r() * 2.5 : -5.5 - r() * 14], i * 3); sd[i] = r(); }
  const snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const snow = new THREE.Points(snowG, new THREE.PointsMaterial({ size: 0.06, map: glowTexture(), color: '#f4f7ff', transparent: true, depthWrite: false }));
  snow.frustumCulled = false; root.add(snow);
  let st = 0;
  updaters.push((dt) => {
    st += dt;
    for (let i = 0; i < n; i++) { const k = i * 3; pos[k + 1] -= (0.4 + sd[i] * 0.5) * dt; pos[k] += (Math.sin(st * 0.6 + sd[i] * 40) * 0.25 + 0.12) * dt; if (pos[k + 1] < 0) { pos[k + 1] += 6; pos[k] = -3 + Math.random() * 11; } }
    snowG.attributes.position.needsUpdate = true;
  });

  function setTime(day) {
    sky.material.map = day ? skyDay : skyNight; sky.material.needsUpdate = true;
    stars.visible = !day; clouds.visible = day;
    moonDisc.material.color.set(day ? '#fffaf0' : '#fff6dc'); moonDisc.scale.setScalar(day ? 1.4 : 1); moonDisc.position.set(day ? -30 : 22, day ? 40 : 30, -95); moonDisc.lookAt(0, 1.5, 0);
    moonGlow.position.copy(moonDisc.position); moonGlow.material.color.set(day ? '#fff2cf' : '#cfdcff'); moonGlow.material.opacity = day ? 0.7 : 0.55; moonGlow.scale.setScalar(day ? 40 : 26);
    scene.fog.color.set(day ? '#dfe8f4' : '#24365e'); scene.fog.near = day ? 14 : 9; scene.fog.far = day ? 90 : 70;
    ground.material.color.set(day ? '#f4f7fc' : '#e9eef8'); ground.material.emissive.set(day ? '#000000' : '#1d2b4d');
    winMat.color.set(day ? '#9a7a55' : '#ffbe6a'); cabGlow.visible = !day; postGlow.visible = !day; pool.visible = !day;
    snow.material.color.set(day ? '#ffffff' : '#f4f7ff');
    treeMats.forEach((m) => m.color.set(day ? '#2f5e3f' : '#1d3346'));
  }
  setTime(false);
  return { root, snow, update: (dt) => updaters.forEach((u) => u(dt)), setTime };
}

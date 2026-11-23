// 메타버스 거실 뷰: 구매한 거실 모델(GLB) + 밤 분위기 조명 + 빛 번짐 + 창밖 눈
// 모델 좌표: 원본 단위가 1/100 → 100배. 방 크기 약 5.6m x 5.6m, 천장 3.2m
//   벽난로: 뒷벽 가운데 (0, -, -2.8) / 트리: (-1.6, -, -1.9) / 스탠드: (-1.8, -, -1.5)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { glowTexture, rng } from '../util.js';
import { Walker } from './walker.js';
import { RoomOrnaments } from './ornaments.js';
import { buildOutside } from './outside.js';

export const MODEL_URL = './models/room.glb';
const SCALE = 100;
const SPOT = {
  fire: new THREE.Vector3(0, 0.42, -2.55),
  tree: new THREE.Vector3(-1.78, 0, -1.95),   // 트리 줄기 축 (모델 측정)
  star: new THREE.Vector3(-1.81, 2.46, -1.88), // 꼭대기 별 중심 (모델 측정)
  lamp: new THREE.Vector3(-2.55, 1.5, -0.19),   // 스탠드 전등 갓 (왼쪽 벽 앞)
  window: { x0: 1.17, x1: 2.43, y0: 0.38, y1: 2.82, z: -2.8 }, // 뒷벽 오른쪽 큰 창
};

export async function modelAvailable() {
  try { const r = await fetch(MODEL_URL, { method: 'HEAD' }); return r.ok; } catch { return false; }
}

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// 창밖: 깊은 남색 밤하늘, 눈 덮인 언덕과 소나무, 멀리 이웃집 불빛
const nightTex = () => canvasTex(1024, 512, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#060b1f'); g.addColorStop(0.55, '#16264a'); g.addColorStop(1, '#3b5584');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = rng(9);
  ctx.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 120; i++) ctx.fillRect(r() * w, r() * h * 0.45, 1.4, 1.4);
  const ridge = (y0, amp, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.006 + y0) * amp); ctx.lineTo(w, h); ctx.fill(); };
  ridge(h * 0.62, 18, '#2a3d63');
  ctx.fillStyle = '#122040';
  for (let i = 0; i < 40; i++) { const x = r() * w, s = 18 + r() * 40, by = h * 0.72 + r() * 10; ctx.beginPath(); ctx.moveTo(x, by - s * 1.8); ctx.lineTo(x - s * 0.45, by); ctx.lineTo(x + s * 0.45, by); ctx.fill(); }
  for (let i = 0; i < 9; i++) { const x = r() * w, y = h * 0.66 + r() * 30; ctx.fillStyle = 'rgba(255,200,120,.95)'; ctx.fillRect(x, y, 5, 4); ctx.fillStyle = 'rgba(255,190,110,.18)'; ctx.beginPath(); ctx.arc(x + 2, y + 2, 14, 0, 7); ctx.fill(); }
  ridge(h * 0.78, 10, '#cfdcf2'); ridge(h * 0.86, 6, '#e8eefb');
});

// 낮 창밖: 맑은 겨울 하늘, 눈 덮인 언덕과 소나무
const dayTex = () => canvasTex(1024, 512, (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8fb6e8'); g.addColorStop(0.55, '#cfe0f5'); g.addColorStop(1, '#f2f6fb');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const r = rng(19);
  ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(r() * w, 40 + r() * 120, 80 + r() * 90, 18 + r() * 14, 0, 0, 7); ctx.fill(); }
  const ridge = (y0, amp, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w; x += 16) ctx.lineTo(x, y0 + Math.sin(x * 0.006 + y0) * amp); ctx.lineTo(w, h); ctx.fill(); };
  ridge(h * 0.6, 18, '#b9c9df');
  for (let i = 0; i < 40; i++) { const x = r() * w, s = 18 + r() * 40, by = h * 0.72 + r() * 10; ctx.fillStyle = '#3d5a4a'; ctx.beginPath(); ctx.moveTo(x, by - s * 1.8); ctx.lineTo(x - s * 0.45, by); ctx.lineTo(x + s * 0.45, by); ctx.fill(); ctx.fillStyle = '#f4f8ff'; ctx.beginPath(); ctx.moveTo(x, by - s * 1.8); ctx.lineTo(x - s * 0.18, by - s * 1.1); ctx.lineTo(x + s * 0.18, by - s * 1.1); ctx.fill(); }
  ridge(h * 0.78, 10, '#eef3fb'); ridge(h * 0.86, 6, '#ffffff');
});

export function buildRoomView(container, { low, onReady, onPick, canInteract = () => true }) {
  const renderer = new THREE.WebGLRenderer({ antialias: !low, powerPreference: low ? 'default' : 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  container.append(renderer.domElement);
  const grade = document.createElement('div'); grade.className = 'room-grade'; container.append(grade);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070f');
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
  const updaters = [];

  // ── 조명: 밤. 주 광원은 벽난로 / 트리 전구 / 스탠드 ──
  const hemi = new THREE.HemisphereLight('#ffcf9e', '#2b1a10', 0.08); scene.add(hemi);
  const moon = new THREE.DirectionalLight('#7f9cff', 0.22); moon.position.set(4, 5, -6); scene.add(moon);
  let fireBase = 4.8;
  const fire = new THREE.PointLight('#ff7a2c', 5, 0, 2); fire.position.copy(SPOT.fire).add(new THREE.Vector3(0, 0.1, 0.45)); scene.add(fire);
  const treeL = new THREE.PointLight('#ffc477', 1.7, 0, 2); treeL.position.copy(SPOT.tree).add(new THREE.Vector3(0.55, 1.5, 1.25)); scene.add(treeL);
  // 스탠드: 모델에는 갓·기둥만 있어서 전구와 빛을 직접 만듦
  //  - 갓 아래로 원뿔 모양 빛(바닥·벽 아래쪽에 빛 웅덩이), 갓 위로 약한 빛(벽·천장), 갓 천은 안에서 비치는 듯 은은하게
  const bulbPos = SPOT.lamp.clone().add(new THREE.Vector3(0, -0.04, 0));
  const lampDown = new THREE.SpotLight('#ffc27a', 3.2, 3.5, Math.PI / 3.4, 0.75, 2); lampDown.position.copy(bulbPos);
  lampDown.target.position.set(bulbPos.x + 0.15, 0, bulbPos.z); scene.add(lampDown, lampDown.target);
  const lampUp = new THREE.SpotLight('#ffcf94', 1.4, 2.5, Math.PI / 4.2, 0.85, 2); lampUp.position.copy(bulbPos);
  lampUp.target.position.set(bulbPos.x + 0.1, 3.3, bulbPos.z); scene.add(lampUp, lampUp.target);
  const lampFill = new THREE.PointLight('#ffc98a', 0.18, 0, 2); lampFill.position.copy(bulbPos).add(new THREE.Vector3(0.45, -0.3, 0)); scene.add(lampFill);

  // ── 창밖 3D 풍경 (숲·설산·이웃 오두막·가로등·눈) ──
  const outside = buildOutside(scene, { low });
  updaters.push((dt) => outside.update(dt));

  // ── 창틀: 모델의 창은 뚫린 구멍뿐이라 흰 나무 창틀·창살·창턱·유리를 덧붙임 ──
  {
    const W = SPOT.window; const fm = new THREE.MeshStandardMaterial({ color: '#efe8dc', roughness: 0.6 });
    const g = new THREE.Group(); scene.add(g);
    const bx = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), fm); m.position.set(x, y, z); g.add(m); };
    const cx = (W.x0 + W.x1) / 2, cy = (W.y0 + W.y1) / 2, w = W.x1 - W.x0, h = W.y1 - W.y0, t = 0.09, z = W.z;
    bx(w + t * 2, t, 0.18, cx, W.y1 + t / 2, z); bx(w + t * 2, t, 0.18, cx, W.y0 - t / 2, z);        // 위·아래 틀
    bx(t, h, 0.18, W.x0 - t / 2, cy, z); bx(t, h, 0.18, W.x1 + t / 2, cy, z);                        // 좌·우 틀
    bx(0.06, h, 0.08, cx, cy, z);                                                                     // 가운데 세로 창살
    [W.y0 + h * 0.36, W.y0 + h * 0.68].forEach((yy) => bx(w, 0.045, 0.06, cx, yy, z));               // 가로 창살
    bx(w + 0.36, 0.05, 0.3, cx, W.y0 - t - 0.02, z + 0.12);                                          // 실내 창턱
    // 유리: 아주 옅은 반사감 (눈 풍경은 그대로 보이게)
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#9fb4e0', roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.08, depthWrite: false }));
    glass.position.set(cx, cy, z - 0.01); g.add(glass);
    // 창 안쪽 아래에 눈이 살짝 쌓인 창턱(바깥)
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.25), new THREE.MeshBasicMaterial({ color: '#c9d6ee' })); sill.position.set(cx, W.y0 + 0.03, z - 0.16); g.add(sill);
  }

  // ── 후처리: 밝은 부분(불꽃·전구)만 은은하게 번지게 ──
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), low ? 0.35 : 0.45, 0.45, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ── 낮·밤 ──
  let shadeOn = null, shadeOff = null, shadeMesh = null, lampGlow = null, starGlow = null;
  // 낮 햇빛이 창살 모양으로 바닥에 드리우는 빛
  const patchTex = canvasTex(256, 256, (ctx, w, h) => {
    const cw = w / 2, ch = h / 3;
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) {
      const g = ctx.createLinearGradient(0, j * ch, 0, (j + 1) * ch); g.addColorStop(0, 'rgba(255,246,225,.9)'); g.addColorStop(1, 'rgba(255,240,210,.65)');
      ctx.fillStyle = g; ctx.fillRect(i * cw + 6, j * ch + 6, cw - 12, ch - 12);
    }
    ctx.globalCompositeOperation = 'destination-in';
    const f = ctx.createLinearGradient(0, 0, 0, h); f.addColorStop(0, 'rgba(0,0,0,1)'); f.addColorStop(1, 'rgba(0,0,0,.15)');
    ctx.fillStyle = f; ctx.fillRect(0, 0, w, h);
  });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.9), new THREE.MeshBasicMaterial({ map: patchTex, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
  patch.rotation.x = -Math.PI / 2; patch.rotation.z = 0.12; patch.position.set(1.62, 0.012, -1.75); patch.visible = false; scene.add(patch);
  const fade = document.createElement('div'); fade.className = 'room-fade'; container.append(fade);
  let timeMode = 'night';
  function applyTime(mode) {
    timeMode = mode; const day = mode === 'day';
    hemi.intensity = day ? 1.15 : 0.08; hemi.color.set(day ? '#eef3ff' : '#ffcf9e'); hemi.groundColor.set(day ? '#8c6e52' : '#2b1a10');
    moon.color.set(day ? '#fff1dc' : '#7f9cff'); moon.intensity = day ? 1.7 : 0.22; moon.position.set(day ? 3 : 4, day ? 6 : 5, day ? -8 : -6);
    fireBase = day ? 2.2 : 4.8; treeL.intensity = day ? 0.5 : 1.7;
    lampDown.intensity = day ? 0 : 3.2; lampUp.intensity = day ? 0 : 1.4; lampFill.intensity = day ? 0 : 0.18;
    if (shadeMesh) shadeMesh.material = day ? shadeOff : shadeOn;
    if (lampGlow) lampGlow.visible = !day;
    if (starGlow) starGlow.material.opacity = day ? 0.25 : 0.5;
    renderer.toneMappingExposure = day ? 1.0 : 0.9; bloom.strength = day ? 0.18 : (low ? 0.35 : 0.45);
    outside.setTime(day);
    scene.background.set(day ? '#cfe0f5' : '#05070f');
    patch.visible = day;
    document.body.classList.toggle('day', day);
  }
  function setTime(mode) {
    if (mode === timeMode) return;
    fade.classList.add('on');
    setTimeout(() => { applyTime(mode); fade.classList.remove('on'); }, 380);
  }

  // ── 모델 로드 ──
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const glow = (color, size, opacity = 1) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity })); s.scale.setScalar(size); return s; };
  // 메시(인스턴스 포함)의 정점을 월드 좌표로 샘플링 — 최적화 과정에서 반복 오브젝트가 InstancedMesh로 묶이기 때문
  const tmpM = new THREE.Matrix4(); const tmpW = new THREE.Matrix4();
  function sampleVerts(o, maxPerInstance, cb) {
    const pos = o.geometry.attributes.position; const step = Math.max(1, Math.floor(pos.count / maxPerInstance));
    const count = o.isInstancedMesh ? o.count : 1; const p = new THREE.Vector3();
    for (let k = 0; k < count; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, tmpM); tmpW.multiplyMatrices(o.matrixWorld, tmpM); } else tmpW.copy(o.matrixWorld);
      for (let i = 0; i < pos.count; i += step) cb(p.fromBufferAttribute(pos, i).applyMatrix4(tmpW));
    }
  }
  loader.load(MODEL_URL, (gltf) => {
    const root = gltf.scene; root.scale.setScalar(SCALE); scene.add(root);
    root.updateMatrixWorld(true);
    const treeVerts = []; const mantelVerts = []; const swagVerts = []; const v = new THREE.Vector3();
    root.traverse((o) => {
      if (!o.isMesh) return;
      const m = o.material; const name = m?.name || '';
      if (m?.isMeshStandardMaterial) { m.envMapIntensity = 0; m.roughness = Math.max(m.roughness ?? 1, 0.55); m.metalness = Math.min(m.metalness ?? 0, 0.2); }
      // 불꽃(_2)·연기(__)·스탠드 빛(_Color_A03_) 텍스처 평면은 스스로 빛나게
      if (name === '_2' || name === '_Color_A03_') {
        o.material = new THREE.MeshBasicMaterial({ map: m.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, color: name === '_2' ? new THREE.Color(1.25, 1.0, 0.8) : new THREE.Color(0.28, 0.24, 0.18) });
        if (name === '_2') { const base = o.scale.clone(); updaters.push((dt, t) => { const k = 1 + Math.sin(t * 9) * 0.05 + Math.sin(t * 23) * 0.03; o.scale.set(base.x, base.y * k, base.z); }); }
      }
      if (name === 'Color_A02' || name === '_Color_A03_10') { o.material = m.clone(); o.material.color.multiplyScalar(0.35); }
      if (name === '_Color_A03_28') { // 스탠드 전등 갓: 안에서 불이 켜진 것처럼
        // 조명 계산에서 빼고(가까운 광원에 하얗게 타는 것 방지) 은은한 주황빛으로만
        shadeOff = m; shadeMesh = o;
        shadeOn = new THREE.MeshBasicMaterial({ map: m.map || null, color: '#dfa462', side: THREE.DoubleSide });
        o.material = shadeOn;
      }
      // 실내 식물(트리·화환·맨틀 가랜드 잎)을 더 싱그러운 초록으로 — 원래 색(#94af88)은 따뜻한 조명 아래 누렇게 보임
      if (name === '_Color_A03_2') { m.color.set('#367c4b'); m.roughness = 0.8; }
      if (name === '_Color_A03_10') m.color.set('#1f5232');
      if (name === '_Color_A03_') o.visible = false; // 트리 옆 사각 빛 평면은 어색해서 숨김
      if (name === '__') { o.material = new THREE.MeshBasicMaterial({ map: m.map, transparent: true, depthWrite: false, opacity: 0.35, side: THREE.DoubleSide }); }
      // 벽 위쪽 가랜드 줄(_Color_A03_38) → 작은 전구
      if (name === '_Color_A03_38') sampleVerts(o, 400, (q) => swagVerts.push(q.clone()));
      if (name === '_Color_A03_2') {
        const per = o.isInstancedMesh ? Math.max(12, Math.floor(40000 / o.count)) : 20000;
        sampleVerts(o, per, (q) => {
          if (Math.hypot(q.x - SPOT.tree.x, q.z - SPOT.tree.z) < 0.95) treeVerts.push(q.clone());
          else if (Math.abs(q.x) < 1.3 && q.z < -2.4 && q.y > 1.1 && q.y < 1.6) mantelVerts.push(q.clone()); // 맨틀 가랜드
        });
      }
    });

    // 트리 전구: 바깥쪽 정점 중에서 골라 웜화이트 위주로 (빛 번짐 대상)
    const rr = rng(21); const lightN = low ? 220 : 380; const lp = []; const lc = []; const col = new THREE.Color();
    const pal = ['#ffd28a', '#ffd28a', '#ffd28a', '#fff1d0', '#ffb36b', '#ff8f8f'];
    for (let i = 0; i < lightN && treeVerts.length; i++) {
      const p = treeVerts[Math.floor(rr() * treeVerts.length)];
      const d = new THREE.Vector3(p.x - SPOT.tree.x, 0, p.z - SPOT.tree.z).normalize().multiplyScalar(0.03);
      lp.push(p.x + d.x, p.y, p.z + d.z); col.set(pal[i % pal.length]).multiplyScalar(2.4); lc.push(col.r, col.g, col.b);
    }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3));
    const treeLights = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.085, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    scene.add(treeLights);
    updaters.push((dt, t) => { treeLights.material.size = 0.085 + Math.sin(t * 2.1) * 0.01; });
    // 맨틀 가랜드·벽 가랜드에도 웜화이트 전구
    const fairy = (verts, n, size, seed) => {
      if (!verts.length) return null; const r2 = rng(seed); const pts = []; const cs = [];
      for (let i = 0; i < n; i++) { const p = verts[Math.floor(r2() * verts.length)]; pts.push(p.x, p.y - 0.02, p.z); col.set(i % 4 ? '#ffd690' : '#fff0cf').multiplyScalar(1.4); cs.push(col.r, col.g, col.b); }
      const g2 = new THREE.BufferGeometry(); g2.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); g2.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
      const m2 = new THREE.Points(g2, new THREE.PointsMaterial({ size, map: glowTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      scene.add(m2); return m2;
    };
    if (!mantelVerts.length) for (let i = 0; i <= 40; i++) { const t2 = i / 40; mantelVerts.push(new THREE.Vector3(-1.0 + t2 * 2.0, 1.24 - Math.sin(t2 * Math.PI * 4) ** 2 * 0.07, -2.38)); }
    const mantelLights = fairy(mantelVerts, 40, 0.06, 31);
    const swagLights = fairy(swagVerts, low ? 90 : 150, 0.07, 41);
    updaters.push((dt, t) => {
      if (mantelLights) mantelLights.material.opacity = 0.85 + Math.sin(t * 1.7) * 0.15;
      if (swagLights) swagLights.material.opacity = 0.8 + Math.sin(t * 1.3 + 1) * 0.2;
    });
    // 공기 중에 천천히 떠다니는 따뜻한 빛 입자 (벽난로 앞)
    const moteN = low ? 30 : 60; const mp = new Float32Array(moteN * 3); const ms = new Float32Array(moteN); const r3 = rng(77);
    for (let i = 0; i < moteN; i++) { mp.set([-1.8 + r3() * 3.6, 0.3 + r3() * 2.4, -2.4 + r3() * 3.4], i * 3); ms[i] = r3(); }
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    const motes = new THREE.Points(mg, new THREE.PointsMaterial({ size: 0.025, map: glowTexture(), color: '#ffcf8a', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(motes);
    updaters.push((dt, t) => {
      for (let i = 0; i < moteN; i++) { const k = i * 3; mp[k + 1] += (0.03 + ms[i] * 0.04) * dt; mp[k] += Math.sin(t * 0.4 + ms[i] * 20) * 0.03 * dt; if (mp[k + 1] > 2.8) mp[k + 1] = 0.3; }
      mg.attributes.position.needsUpdate = true;
    });
    // 은은한 후광: 벽난로, 트리 꼭대기, 스탠드
    const fg = glow('#ff8a3a', 1.3, 0.35); fg.position.copy(SPOT.fire).add(new THREE.Vector3(0, 0.05, 0.25)); scene.add(fg);
    const lgd = glow('#ffcf8a', 0.42, 0.5); lgd.position.copy(SPOT.lamp).add(new THREE.Vector3(0, -0.13, 0)); scene.add(lgd); // 갓 아래로 보이는 전구 빛
    lampGlow = lgd;
    const tg = glow('#ffd98a', 0.5, 0.5); tg.position.copy(SPOT.star); scene.add(tg); starGlow = tg;
    updaters.push((dt, t) => {
      fire.intensity = fireBase + Math.sin(t * 11) * fireBase * 0.17 + Math.sin(t * 27) * fireBase * 0.1;
      fg.material.opacity = 0.32 + Math.sin(t * 9) * 0.06;
    });
    // 앞쪽 벽: 모델에 없어서 뒷벽과 같은 벽지 재질로 막음
    {
      const rc = new THREE.Raycaster(new THREE.Vector3(-2.2, 1.8, 0), new THREE.Vector3(0, 0, -1)); rc.far = 3.2;
      const hit = rc.intersectObject(root, true)[0];
      const wm = hit ? hit.object.material.clone() : new THREE.MeshStandardMaterial({ color: '#d8cbb8' });
      if (wm.map) { wm.map = wm.map.clone(); wm.map.wrapS = wm.map.wrapT = THREE.RepeatWrapping; wm.map.repeat.set(3, 1.8); wm.map.needsUpdate = true; }
      wm.side = THREE.DoubleSide;
      const front = new THREE.Mesh(new THREE.PlaneGeometry(5.62, 3.27), wm); front.position.set(0, 1.635, 2.8); front.rotation.y = Math.PI; scene.add(front);
      const base = new THREE.Mesh(new THREE.BoxGeometry(5.62, 0.14, 0.03), new THREE.MeshStandardMaterial({ color: '#efe8dc', roughness: 0.6 })); base.position.set(0, 0.07, 2.78); scene.add(base);
    }
    // 롤링페이퍼 장식
    ornaments = new RoomOrnaments(scene, new THREE.Vector3(SPOT.tree.x, 0, SPOT.tree.z), treeVerts);
    if (pendingItems) ornaments.sync(pendingItems);
    applyTime(timeMode);
    updaters.push((dt) => ornaments.update(dt));
    console.info('[room] tree/mantel/swag verts', treeVerts.length, mantelVerts.length, swagVerts.length, 'slots', ornaments.slots.length);
    if (new URLSearchParams(location.search).has('debug')) window.__room = { scene, camera, root, THREE };
    onReady?.();
  }, undefined, (e) => console.error('[room] 모델 로드 실패', e));

  // ── 걷기 카메라 ──
  let ornaments = null; let pendingItems = null;
  const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
  const walker = new Walker(camera, renderer.domElement, {
    joystick: document.getElementById('joystick'),
    onTap: (x, y) => {
      if (!ornaments || !canInteract()) return;
      ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
      const h = ray.intersectObjects(ornaments.hits, false)[0];
      if (h) onPick?.(h.object.userData.itemId);
    },
  });
  updaters.push((dt) => walker.update(dt));
  const q = new URLSearchParams(location.search);
  const presets = { tree: [-0.55, 0.15, 0.47, 0.05], window: [0.5, 0.8, -0.35, 0.0], lamp: [0.3, 1.2, 1.1, -0.05], fire: [0.4, 0.6, 0.12, -0.12] };
  if (presets[q.get('cam')]) { const [x, z, yaw, pitch] = presets[q.get('cam')]; walker.pos.set(x, 1.5, z); walker.yaw = yaw; walker.pitch = pitch; }

  function onResize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h); composer.setSize(w, h);
    camera.aspect = w / h; camera.fov = w / h < 0.8 ? 70 : 55; camera.updateProjectionMatrix();
  }
  addEventListener('resize', onResize); onResize();

  const clock = new THREE.Clock(); let t = 0;
  (function frame() {
    const dt = Math.min(clock.getDelta(), 0.05); t += dt;
    updaters.forEach((u) => u(dt, t));
    composer.render();
    requestAnimationFrame(frame);
  })();

  return {
    mode: 'room',
    sync(items) { pendingItems = items; ornaments?.sync(items); },
    highlight(id) { if (!ornaments) return; const p = ornaments.worldPos(id); if (!p) return; ornaments.highlight(id); walker.focusOn(p, ornaments.outward(id)); },
    unfocus() { ornaments?.clear(); walker.unfocus(); },
    setEnabled(v) { walker.enabled = v; if (!v) walker.keys.clear(); },
    setTime, applyTime, get time() { return timeMode; },
  };
}

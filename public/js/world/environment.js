// 하늘 / 달 / 별 / 산 / 소나무 / 눈 덮인 땅 / 마당 / 조명 / 눈 내리는 파티클
import * as THREE from 'three';
import { rng, glowTexture } from '../util.js';
import { addCircle } from './colliders.js';

export function buildEnvironment(scene, { quality }) {
  const updaters = [];

  // ── 하늘: 그라디언트 셰이더 돔 ──
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#0b1030') }, mid: { value: new THREE.Color('#2b2f5e') }, bottom: { value: new THREE.Color('#8a6f8f') } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
        void main(){ float h = vP.y; vec3 c = h > 0.12 ? mix(mid, top, smoothstep(0.12, 0.7, h)) : mix(bottom, mid, smoothstep(-0.05, 0.12, h)); gl_FragColor = vec4(c, 1.); }`,
    }),
  );
  scene.add(sky);
  scene.fog = new THREE.Fog('#3a3a62', 38, 140);

  // 별
  {
    const r = rng(7); const n = 900; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = r() * Math.PI * 2; const ph = Math.acos(0.15 + r() * 0.85);
      pos.set([Math.sin(ph) * Math.cos(th) * 380, Math.cos(ph) * 380, Math.sin(ph) * Math.sin(th) * 380], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, color: '#dfe6ff', fog: false, transparent: true, opacity: 0.8 }));
    scene.add(stars);
  }
  // 달
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff6dc', fog: false, depthWrite: false }));
  moon.position.set(-120, 120, -260); moon.scale.set(60, 60, 1); scene.add(moon);
  const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(9, 32), new THREE.MeshBasicMaterial({ color: '#fffbea', fog: false }));
  moonDisc.position.copy(moon.position); moonDisc.lookAt(0, 0, 0); scene.add(moonDisc);

  // ── 조명 ──
  scene.add(new THREE.HemisphereLight('#9aa8e8', '#3b3346', 0.9));
  const moonLight = new THREE.DirectionalLight('#c9d4ff', 1.1);
  moonLight.position.set(-30, 50, 20);
  if (quality.shadows) {
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.set(2048, 2048);
    Object.assign(moonLight.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 140 });
    moonLight.shadow.bias = -0.0008;
  }
  scene.add(moonLight);
  const warm = new THREE.PointLight('#ffb36b', 30, 26, 1.6); // 트리 주변 따뜻한 빛
  warm.position.set(0, 4, 0); scene.add(warm);
  const hallGlow = new THREE.PointLight('#ffae5c', 24, 18, 1.6); // 대웅전 창호 빛
  hallGlow.position.set(0, 3, -13.5); scene.add(hallGlow);

  // ── 땅(눈) ──
  const groundGeo = new THREE.PlaneGeometry(320, 320, 80, 80);
  groundGeo.rotateX(-Math.PI / 2);
  { // 마당 바깥은 살짝 굴곡
    const p = groundGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); const d = Math.max(Math.abs(x), Math.abs(z));
      if (d > 26) p.setY(i, (Math.sin(x * 0.11) + Math.cos(z * 0.09)) * 0.6 * Math.min(1, (d - 26) / 20));
    }
    groundGeo.computeVertexNormals();
  }
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ color: '#e9eef8', roughness: 0.95 }));
  ground.receiveShadow = true; scene.add(ground);

  // 마당: 눈이 살짝 쌓인 박석 무늬(캔버스 텍스처)
  const yardTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const ctx = c.getContext('2d');
    ctx.fillStyle = '#cfd3dc'; ctx.fillRect(0, 0, 512, 512);
    const r = rng(3);
    for (let y = 0; y < 512; y += 64) for (let x = (y / 64) % 2 ? -32 : 0; x < 512; x += 64) {
      const v = 200 + Math.floor(r() * 30);
      ctx.fillStyle = `rgb(${v},${v + 3},${v + 10})`; ctx.fillRect(x + 3, y + 3, 58, 58);
    }
    for (let i = 0; i < 300; i++) { ctx.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.5})`; ctx.beginPath(); ctx.arc(r() * 512, r() * 512, 4 + r() * 18, 0, 7); ctx.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(6, 6); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const yard = new THREE.Mesh(new THREE.PlaneGeometry(32, 31), new THREE.MeshStandardMaterial({ map: yardTex, roughness: 0.9 }));
  yard.rotation.x = -Math.PI / 2; yard.position.set(0, 0.01, 1.5); yard.receiveShadow = true; scene.add(yard);

  // ── 먼 산 (눈 덮인 봉우리) ──
  {
    const r = rng(11);
    const mtnMat = new THREE.MeshStandardMaterial({ color: '#5a5f86', roughness: 1, flatShading: true });
    const capMat = new THREE.MeshStandardMaterial({ color: '#f2f5ff', roughness: 1, flatShading: true });
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 + r() * 0.2; const d = 110 + r() * 60;
      const h = 28 + r() * 40; const rad = 30 + r() * 25;
      const m = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6 + Math.floor(r() * 3), 1), mtnMat);
      m.position.set(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d); m.rotation.y = r() * 3; scene.add(m);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.36, h * 0.36, m.geometry.parameters.radialSegments, 1), capMat);
      cap.position.set(m.position.x, h - 2 - h * 0.18 + 0.2, m.position.z); cap.rotation.y = m.rotation.y; scene.add(cap);
    }
  }

  // ── 소나무 (InstancedMesh로 가볍게) ──
  {
    const r = rng(21);
    const spots = [];
    for (let i = 0; i < 140; i++) {
      const a = r() * Math.PI * 2; const d = 22 + r() * 50;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z > 14 && Math.abs(x) < 6) continue; // 입구 길 비우기
      spots.push([x, z, 0.8 + r() * 0.9, r() * 3]);
    }
    // 마당 안쪽 가장자리 몇 그루
    [[-15, 13], [15, 13], [-15.5, -6], [15.5, -2], [-14, -12], [14.5, -12.5]].forEach(([x, z]) => { spots.push([x, z, 0.9, r() * 3]); addCircle(x, z, 0.8); });
    const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 2, 6); trunkG.translate(0, 1, 0);
    const leafG = new THREE.ConeGeometry(1.6, 2.6, 7); leafG.translate(0, 3, 0);
    const leaf2G = new THREE.ConeGeometry(1.2, 2.2, 7); leaf2G.translate(0, 4.4, 0);
    const snowG = new THREE.ConeGeometry(0.75, 1.1, 7); snowG.translate(0, 5.25, 0);
    const mats = [new THREE.MeshStandardMaterial({ color: '#5b3d2b' }), new THREE.MeshStandardMaterial({ color: '#1f4a3c', flatShading: true }), new THREE.MeshStandardMaterial({ color: '#25574a', flatShading: true }), new THREE.MeshStandardMaterial({ color: '#f4f7ff', flatShading: true })];
    const geos = [trunkG, leafG, leaf2G, snowG];
    const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const s = new THREE.Vector3();
    geos.forEach((g, gi) => {
      const im = new THREE.InstancedMesh(g, mats[gi], spots.length);
      spots.forEach(([x, z, sc, ry], i) => { q.setFromEuler(new THREE.Euler(0, ry, 0)); s.setScalar(sc); m4.compose(new THREE.Vector3(x, 0, z), q, s); im.setMatrixAt(i, m4); });
      im.castShadow = gi > 0 && quality.shadows; scene.add(im);
    });
  }

  // ── 눈 내리는 파티클: 카메라 주변 박스 안에서 순환 ──
  {
    const n = quality.snow; const box = 46, hgt = 26;
    const pos = new Float32Array(n * 3); const seed = new Float32Array(n);
    const r = rng(5);
    for (let i = 0; i < n; i++) { pos[i * 3] = (r() - 0.5) * box; pos[i * 3 + 1] = r() * hgt; pos[i * 3 + 2] = (r() - 0.5) * box; seed[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const snow = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.16, map: glowTexture(), transparent: true, depthWrite: false, color: '#ffffff', opacity: 0.95 }));
    snow.frustumCulled = false; scene.add(snow);
    let t = 0;
    updaters.push((dt, camera) => {
      t += dt;
      const cx = camera.position.x, cz = camera.position.z;
      for (let i = 0; i < n; i++) {
        const k = i * 3; const s = seed[i];
        pos[k + 1] -= (0.6 + s * 0.9) * dt;
        pos[k] += Math.sin(t * 0.7 + s * 20) * 0.25 * dt + 0.08 * dt;
        pos[k + 2] += Math.cos(t * 0.5 + s * 13) * 0.2 * dt;
        if (pos[k + 1] < 0) pos[k + 1] += hgt;
        // 카메라 기준으로 랩어라운드
        let dx = pos[k] - cx; if (dx > box / 2) pos[k] -= box; else if (dx < -box / 2) pos[k] += box;
        let dz = pos[k + 2] - cz; if (dz > box / 2) pos[k + 2] -= box; else if (dz < -box / 2) pos[k + 2] += box;
      }
      g.attributes.position.needsUpdate = true;
    });
  }

  return { update: (dt, camera) => updaters.forEach((u) => u(dt, camera)) };
}

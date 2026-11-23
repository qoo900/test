// 거실 크리스마스 트리: 풍성한 가지(인스턴싱) + 촘촘한 웜화이트 전구(Points 1회 드로우) + 선물 더미
import * as THREE from 'three';
import { TREE, TREE_POS, treeRadiusAt } from './slots.js';
import { glowTexture, rng } from '../util.js';

function starShape(outer, inner, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const r = i % 2 ? inner : outer; const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
export const STAR_GEO = new THREE.ExtrudeGeometry(starShape(1, 0.45), { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 1 });
STAR_GEO.center();

// 빨강/금 체크무늬 포장지
function wrapTexture(bg, line) {
  const c = document.createElement('canvas'); c.width = c.height = 64; const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = line; ctx.globalAlpha = 0.35;
  for (let i = 0; i < 64; i += 16) { ctx.fillRect(i, 0, 5, 64); ctx.fillRect(0, i, 64, 5); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return t;
}

export function buildTree(scene, { quality }) {
  const g = new THREE.Group(); g.position.copy(TREE_POS); scene.add(g);
  const r = rng(42);

  // 몸통 원뿔(안쪽 볼륨)
  const coreMat = new THREE.MeshLambertMaterial({ color: '#1c4a25' });
  const span = TREE.topY - TREE.baseY; const tiers = 6;
  for (let i = 0; i < tiers; i++) {
    const y0 = TREE.baseY + (i * span) / tiers * 0.92; const h = (span / tiers) * 1.7;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(treeRadiusAt(y0) * 0.95, h, 12, 1), coreMat);
    cone.position.y = y0 + h / 2; cone.rotation.y = i; g.add(cone);
  }
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.5, 8), new THREE.MeshLambertMaterial({ color: '#4a2c18' }));
  trunk.position.y = 0.25; g.add(trunk);

  // 가지 끝: 바깥으로 뻗은 작은 원뿔을 인스턴싱 → 풍성한 실루엣
  const tipN = quality.low ? 260 : 420;
  const tipGeo = new THREE.ConeGeometry(0.08, 0.32, 5); tipGeo.translate(0, 0.16, 0); tipGeo.rotateX(Math.PI / 2); // +z 방향으로 뻗음
  const tips = new THREE.InstancedMesh(tipGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), tipN);
  const m4 = new THREE.Matrix4(); const q = new THREE.Quaternion(); const e = new THREE.Euler(); const s = new THREE.Vector3(); const p = new THREE.Vector3();
  const greens = ['#1f4d27', '#285c2f', '#2f6a35', '#21522a'].map((c) => new THREE.Color(c));
  for (let i = 0; i < tipN; i++) {
    const y = TREE.baseY + 0.1 + Math.pow(r(), 0.8) * (span - 0.25);
    const a = r() * Math.PI * 2; const rr = treeRadiusAt(y) * (0.7 + r() * 0.15);
    p.set(Math.cos(a) * rr, y, Math.sin(a) * rr);
    e.set(0.35 + r() * 0.3, Math.atan2(p.x, p.z), 0, 'YXZ'); q.setFromEuler(e);
    const sc = 0.6 + (treeRadiusAt(y) / TREE.radius) * 0.45 + r() * 0.2; s.set(sc, sc, sc);
    m4.compose(p, q, s); tips.setMatrixAt(i, m4); tips.setColorAt(i, greens[i % greens.length]);
  }
  g.add(tips);

  // 웜화이트 전구: 글로우 텍스처 Points (가산 혼합) — 수백 개도 1회 드로우
  const lightN = quality.low ? 260 : 420;
  const lp = new Float32Array(lightN * 3); const lph = new Float32Array(lightN);
  for (let i = 0; i < lightN; i++) {
    const y = TREE.baseY + 0.12 + Math.pow(r(), 0.85) * (span - 0.2);
    const a = (i / lightN) * Math.PI * 2 * 23 + r() * 0.6; const rr = treeRadiusAt(y) * (0.92 + r() * 0.2);
    lp.set([Math.cos(a) * rr, y, Math.sin(a) * rr], i * 3); lph[i] = r() * 6.28;
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lights = new THREE.Points(lg, new THREE.PointsMaterial({ size: 0.24, map: glowTexture(), color: '#ffcf6a', toneMapped: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  g.add(lights);
  // 트리 전체의 은은한 후광
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb84d', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
  halo.scale.set(4.2, 4.6, 1); halo.position.set(0, 1.7, 0.3); g.add(halo);

  // 꼭대기 별
  const star = new THREE.Mesh(STAR_GEO, new THREE.MeshLambertMaterial({ color: '#ffd45a', emissive: '#ffae1a', emissiveIntensity: 1.2 }));
  star.scale.setScalar(0.18); star.position.y = TREE.starY; g.add(star);
  const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd27a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  starGlow.scale.set(1.0, 1.0, 1); starGlow.position.y = TREE.starY; g.add(starGlow);

  const treeLight = new THREE.PointLight('#ffcf80', 9, 6, 1.5); treeLight.position.set(0, 1.5, 1.2); g.add(treeLight);

  // 장식용 선물 더미 (클릭 대상 아님): 빨강/금 포장
  const wraps = [
    new THREE.MeshLambertMaterial({ map: wrapTexture('#b51d25', '#f2c46a') }),
    new THREE.MeshLambertMaterial({ map: wrapTexture('#d9a55a', '#b51d25') }),
    new THREE.MeshLambertMaterial({ map: wrapTexture('#c8322e', '#ffffff') }),
  ];
  const ribbon = new THREE.MeshLambertMaterial({ color: '#f0d27a' });
  const gifts = [
    [-0.9, 0.55, 0.5, 0.4, 0.5], [-0.35, 0.9, 0.45, 0.5, 0.4], [0.3, 1.0, 0.6, 0.35, 0.45], [0.95, 0.6, 0.5, 0.45, 0.5],
    [1.25, 0.05, 0.45, 0.6, 0.45], [-1.2, -0.05, 0.4, 0.35, 0.4], [0.0, 1.25, 0.35, 0.28, 0.35], [0.6, 0.35, 0.4, 0.3, 0.4],
    [-0.6, 0.3, 0.35, 0.55, 0.35], [1.1, 0.95, 0.35, 0.25, 0.35],
  ];
  gifts.forEach(([x, z, w, h, d], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wraps[i % wraps.length]);
    b.position.set(x, h / 2, z); b.rotation.y = (i * 0.7) % 1 - 0.5; g.add(b);
    const rb = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, h + 0.01, 0.05), ribbon); rb.position.copy(b.position); rb.rotation.y = b.rotation.y; g.add(rb);
  });

  let t = 0;
  return {
    group: g,
    update(dt) {
      t += dt;
      star.rotation.y += dt * 0.4;
      lights.material.size = 0.24 + Math.sin(t * 2.2) * 0.02;
      halo.material.opacity = 0.32 + Math.sin(t * 1.3) * 0.04;
      starGlow.material.opacity = 0.8 + Math.sin(t * 2) * 0.15;
    },
  };
}

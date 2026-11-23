// 마당 중앙 크리스마스 트리: 층층이 쌓인 원뿔 + 눈 + 반짝이는 전구(InstancedMesh) + 꼭대기 별
import * as THREE from 'three';
import { TREE, treeRadiusAt } from './slots.js';
import { addCircle } from './colliders.js';
import { glowTexture, rng } from '../util.js';

function starShape(outer, inner, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const r = i % 2 ? inner : outer; const a = (i / (n * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  return s;
}
export const STAR_GEO = new THREE.ExtrudeGeometry(starShape(1, 0.45), { depth: 0.25, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 1 });
STAR_GEO.center();

export function buildTree(scene, { quality }) {
  const g = new THREE.Group(); scene.add(g);
  const leafMat = new THREE.MeshStandardMaterial({ color: '#1e5b43', roughness: 0.8, flatShading: true });
  const snowMat = new THREE.MeshStandardMaterial({ color: '#f5f8ff', roughness: 1, flatShading: true });
  // 기단(돌 화분) + 줄기
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 0.6, 12), new THREE.MeshStandardMaterial({ color: '#8f949f', flatShading: true }));
  pot.position.y = 0.3; pot.receiveShadow = true; g.add(pot);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 1.4, 8), new THREE.MeshStandardMaterial({ color: '#5b3d2b' }));
  trunk.position.y = 1.0; g.add(trunk);

  const tiers = 5; const span = TREE.topY - TREE.baseY;
  for (let i = 0; i < tiers; i++) {
    const y0 = TREE.baseY + (i * span) / tiers * 0.95;
    const h = (span / tiers) * 1.7;
    const r = treeRadiusAt(y0) * 1.05;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 12, 1), leafMat);
    cone.position.y = y0 + h / 2; cone.castShadow = quality.shadows; cone.receiveShadow = true; g.add(cone);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, h * 0.42, 12, 1), snowMat);
    cap.position.y = y0 + h - h * 0.2; cap.rotation.y = 0.13; g.add(cap);
  }

  // 꼭대기 별
  const star = new THREE.Mesh(STAR_GEO, new THREE.MeshStandardMaterial({ color: '#ffd45a', emissive: '#ffb21a', emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.3 }));
  star.scale.setScalar(0.55); star.position.y = TREE.starY; g.add(star);
  const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf66', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  starGlow.scale.set(4, 4, 1); starGlow.position.y = TREE.starY; g.add(starGlow);

  // 전구: 나선형으로 감은 작은 구슬들
  const n = 150; const r = rng(42);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
  const palette = ['#ffdf7a', '#ff6b6b', '#7ad1ff', '#9dff8a', '#ffffff'].map((c) => new THREE.Color(c));
  const base = []; const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const t = i / n; const y = TREE.baseY + 0.3 + t * (span - 0.6);
    const a = t * Math.PI * 2 * 7; const rr = treeRadiusAt(y) * 0.98 + 0.06;
    m4.makeTranslation(Math.cos(a) * rr, y, Math.sin(a) * rr); bulbs.setMatrixAt(i, m4);
    base.push({ c: palette[i % palette.length], ph: r() * 6.28, sp: 1.5 + r() * 2.5 });
    bulbs.setColorAt(i, base[i].c);
  }
  g.add(bulbs);
  addCircle(0, 0, 3.4);

  let t = 0; const tmp = new THREE.Color();
  return {
    group: g,
    update(dt) {
      t += dt;
      star.rotation.y += dt * 0.6;
      starGlow.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;
      for (let i = 0; i < n; i++) {
        const b = base[i]; const k = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * b.sp + b.ph));
        bulbs.setColorAt(i, tmp.copy(b.c).multiplyScalar(k * 1.3));
      }
      bulbs.instanceColor.needsUpdate = true;
    },
  };
}

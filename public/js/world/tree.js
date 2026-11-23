// 거실 크리스마스 트리: 층층 원뿔 + 반짝이는 전구 + 금빛 가랜드 + 꼭대기 별 + 트리 스커트
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

export function buildTree(scene) {
  const g = new THREE.Group(); g.position.copy(TREE_POS); scene.add(g);
  const leaf = new THREE.MeshLambertMaterial({ color: '#1f5c3c' });
  const leafDark = new THREE.MeshLambertMaterial({ color: '#174a30' });
  // 스커트 + 줄기
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.06, 24), new THREE.MeshLambertMaterial({ color: '#a3162a' }));
  skirt.position.y = 0.03; g.add(skirt);
  const trim = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.04, 6, 32), new THREE.MeshLambertMaterial({ color: '#f5f1ea' }));
  trim.rotation.x = Math.PI / 2; trim.position.y = 0.06; g.add(trim);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.6, 8), new THREE.MeshLambertMaterial({ color: '#4a2c18' }));
  trunk.position.y = 0.3; g.add(trunk);

  const tiers = 5; const span = TREE.topY - TREE.baseY;
  for (let i = 0; i < tiers; i++) {
    const y0 = TREE.baseY + (i * span) / tiers * 0.93;
    const h = (span / tiers) * 1.75;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(treeRadiusAt(y0) * 1.05, h, 14, 1), i % 2 ? leafDark : leaf);
    cone.position.y = y0 + h / 2; cone.rotation.y = i * 0.4; g.add(cone);
  }

  // 금빛 가랜드 (나선 튜브)
  const pts = [];
  for (let i = 0; i <= 120; i++) { const t = i / 120; const y = TREE.baseY + 0.15 + t * (span - 0.4); const a = t * Math.PI * 2 * 4.5; const r = treeRadiusAt(y) * 0.98 + 0.03; pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); }
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.018, 4), new THREE.MeshLambertMaterial({ color: '#e8c25a', emissive: '#6b4a10' })));

  // 꼭대기 별
  const star = new THREE.Mesh(STAR_GEO, new THREE.MeshLambertMaterial({ color: '#ffd45a', emissive: '#ffae1a', emissiveIntensity: 1.2 }));
  star.scale.setScalar(0.2); star.position.y = TREE.starY; g.add(star);
  const starGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf66', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  starGlow.scale.set(1.3, 1.3, 1); starGlow.position.y = TREE.starY; g.add(starGlow);

  // 전구
  const n = 90; const r = rng(42);
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), n);
  const palette = ['#ffdf7a', '#ff6b6b', '#7ad1ff', '#9dff8a', '#ffffff'].map((c) => new THREE.Color(c));
  const base = []; const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const t = i / n; const y = TREE.baseY + 0.1 + t * (span - 0.3);
    const a = t * Math.PI * 2 * 9 + 1; const rr = treeRadiusAt(y) * 0.98 + 0.04;
    m4.makeTranslation(Math.cos(a) * rr, y, Math.sin(a) * rr); bulbs.setMatrixAt(i, m4);
    base.push({ c: palette[i % palette.length], ph: r() * 6.28, sp: 1.2 + r() * 2 });
    bulbs.setColorAt(i, base[i].c);
  }
  g.add(bulbs);
  const treeLight = new THREE.PointLight('#ffd08a', 5, 5, 1.6); treeLight.position.set(0, 1.6, 0.9); g.add(treeLight);

  let t = 0; const tmp = new THREE.Color();
  return {
    group: g,
    update(dt) {
      t += dt;
      star.rotation.y += dt * 0.5;
      starGlow.material.opacity = 0.75 + Math.sin(t * 2) * 0.2;
      for (let i = 0; i < n; i++) { const b = base[i]; bulbs.setColorAt(i, tmp.copy(b.c).multiplyScalar(0.5 + 0.6 * (0.5 + 0.5 * Math.sin(t * b.sp + b.ph)))); }
      bulbs.instanceColor.needsUpdate = true;
    },
  };
}

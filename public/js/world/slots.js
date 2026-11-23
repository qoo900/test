// 트리 위 장식 배치 좌표 (트리 중심 기준 로컬 좌표)
// 작성 순서대로 슬롯을 배정하므로 위치를 저장하지 않아도 모두에게 같은 자리로 보입니다.
import * as THREE from 'three';

export const TREE_POS = new THREE.Vector3(2.55, 0, -2.0); // 벽난로 오른쪽
export const TREE = { baseY: 0.32, topY: 3.1, radius: 1.35, starY: 3.2 };
export const treeRadiusAt = (y) => Math.max(0.08, TREE.radius * (1 - (y - TREE.baseY) / (TREE.topY - TREE.baseY + 0.1)));

function vdc(n, b = 2) { let v = 0, d = 1; while (n) { d *= b; v += (n % b) / d; n = Math.floor(n / b); } return v; }

export function slotFor(zone, i) {
  if (zone === 'base') { // 트리 앞쪽 선물 더미 맨 앞줄
    const ring = Math.floor(i / 7); const k = i % 7;
    const a = Math.PI * 0.5 + ((k - 3) / 7) * Math.PI * 1.1 + (ring % 2) * 0.2;
    const r = 1.55 + (ring % 2) * 0.3;
    return { pos: new THREE.Vector3(Math.cos(a) * r, 0.14 + Math.floor(ring / 2) * 0.26, Math.sin(a) * r), ry: a, hang: 0 };
  }
  // 앞쪽 220° 범위에 고르게 (카메라에서 보이는 면 위주)
  const cap = 140; const lap = Math.floor(i / cap); const k = i % cap;
  const y = TREE.baseY + 0.3 + vdc(k + 1) * (TREE.topY - TREE.baseY - 0.6);
  const a = Math.PI * 0.5 + (((k * 0.618034) % 1) - 0.5) * Math.PI * 1.25 + lap * 0.3;
  const r = treeRadiusAt(y) * 0.95 + 0.1;
  return { pos: new THREE.Vector3(Math.cos(a) * r, y - 0.1, Math.sin(a) * r), ry: Math.PI / 2 - a, hang: 0.1 };
}

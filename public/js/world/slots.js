// 트리 위 장식 배치 좌표 (트리 중심 기준 로컬 좌표)
// 작성 순서대로 슬롯을 배정하므로 위치를 저장하지 않아도 모두에게 같은 자리로 보입니다.
import * as THREE from 'three';

export const TREE_POS = new THREE.Vector3(2.0, 0, -1.35); // 거실 오른쪽, 창가
export const TREE = { baseY: 0.5, topY: 3.0, radius: 1.2, starY: 3.12 };
export const treeRadiusAt = (y) => Math.max(0.08, TREE.radius * (1 - (y - TREE.baseY) / (TREE.topY - TREE.baseY + 0.15)));

function vdc(n, b = 2) { let v = 0, d = 1; while (n) { d *= b; v += (n % b) / d; n = Math.floor(n / b); } return v; }

// 앞쪽(카메라 쪽, +z)부터 채워지도록 각도 범위를 앞면 위주로
export function slotFor(zone, i) {
  if (zone === 'base') {
    const ring = Math.floor(i / 9); const k = i % 9;
    const a = Math.PI * 0.5 + ((k - 4) / 9) * Math.PI * 1.6 + ring * 0.17;
    const r = 1.4 + (ring % 2) * 0.3;
    return { pos: new THREE.Vector3(Math.cos(a) * r, 0.14 + Math.floor(ring / 2) * 0.26, Math.sin(a) * r), ry: a, hang: 0 };
  }
  const cap = 120; const lap = Math.floor(i / cap); const k = i % cap;
  const y = TREE.baseY + 0.25 + vdc(k + 1) * (TREE.topY - TREE.baseY - 0.55);
  // 앞쪽 240° 범위에 황금각 분포
  const a = Math.PI * 0.5 + (((k * 0.618034) % 1) - 0.5) * Math.PI * 1.35 + lap * 0.3;
  const r = treeRadiusAt(y) * 0.9 + 0.07;
  return { pos: new THREE.Vector3(Math.cos(a) * r, y - 0.1, Math.sin(a) * r), ry: Math.PI / 2 - a, hang: 0.1 };
}

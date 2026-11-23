// 구역(zone)별 장식 배치 좌표 계산.
// 아이템 순서(작성 시각)대로 슬롯 번호를 배정하므로 서버에 좌표를 저장하지 않아도 모두에게 같은 위치로 보입니다.
import * as THREE from 'three';
import { WORLD } from '../config.js';

// ── 트리 ──
export const TREE = { baseY: 0.9, topY: 7.6, radius: 3.3, starY: 8.25 };
export const treeRadiusAt = (y) => Math.max(0.15, TREE.radius * (1 - (y - TREE.baseY) / (TREE.topY - TREE.baseY + 0.4)));

function vdc(n, base = 2) { let v = 0, d = 1; while (n) { d *= base; v += (n % base) / d; n = Math.floor(n / base); } return v; }

// ── 연등줄: 트리 꼭대기 아래(hub)에서 기둥 8개로 뻗는 줄 ──
export const STRING = {
  hub: new THREE.Vector3(0, 7.5, 0),
  poleR: 10, poleH: 4.2, sag: 0.9,
  poles: Array.from({ length: 8 }, (_, i) => { const a = Math.PI / 8 + (i * Math.PI) / 4; return new THREE.Vector2(Math.cos(a) * 10, Math.sin(a) * 10); }),
};
export function stringPoint(lineIdx, t, out = new THREE.Vector3()) {
  const p = STRING.poles[lineIdx];
  out.set(
    STRING.hub.x + (p.x - STRING.hub.x) * t,
    STRING.hub.y + (STRING.poleH - STRING.hub.y) * t - STRING.sag * 4 * t * (1 - t),
    STRING.hub.z + (p.y - STRING.hub.z) * t,
  );
  return out;
}

// ── 소원 팻말 걸이대 ──
export const RACKS = [
  { x: -13, z: 3.2, ry: Math.PI / 2 },   // 서쪽, 동쪽(트리)을 바라봄
  { x: -13, z: -3.4, ry: Math.PI / 2 },
  { x: 13, z: 3.2, ry: -Math.PI / 2 },   // 동쪽
];
export const RACK = { width: 4.6, rows: [2.15, 1.6, 1.05], cols: 9, spacing: 0.48 };

// ── 대웅전 처마 ──
export const EAVE = { z: WORLD.hallZ + WORLD.hallD / 2 + 2, halfW: WORLD.hallW / 2 + 2, y: 5.0 };

/**
 * @returns {{ pos: THREE.Vector3, ry: number, hang: number|null, anchor?: THREE.Vector3 }}
 *  pos: 장식 중심, ry: 회전, hang: 매단 줄 길이(없으면 null)
 */
export function slotFor(zone, i) {
  switch (zone) {
    case 'tree': {
      const cap = 200; const lap = Math.floor(i / cap); const k = i % cap;
      const v = vdc(k + 1);
      const y = TREE.baseY + 0.35 + v * (TREE.topY - TREE.baseY - 1.0);
      const a = k * 2.399963 + lap * 0.7;
      const r = treeRadiusAt(y) * 0.92 + 0.12 + lap * 0.05;
      return { pos: new THREE.Vector3(Math.cos(a) * r, y - 0.18, Math.sin(a) * r), ry: -a + Math.PI / 2, hang: 0.18 };
    }
    case 'base': {
      const ring = Math.floor(i / 14); const k = i % 14;
      const a = (k / 14) * Math.PI * 2 + ring * 0.23 + 0.1;
      const r = 2.5 + (ring % 2) * 0.6;
      return { pos: new THREE.Vector3(Math.cos(a) * r, 0.2 + Math.floor(ring / 2) * 0.42, Math.sin(a) * r), ry: a * 1.7, hang: null };
    }
    case 'string': {
      const per = 10; const n = STRING.poles.length;
      const lap = Math.floor(i / (n * per)); const k = i % (n * per);
      const line = k % n; const idx = Math.floor(k / n);
      const t = 0.95 - idx * 0.065 - lap * 0.0325;
      const anchor = stringPoint(line, t);
      const hang = 0.32 + ((k * 7) % 3) * 0.08;
      return { pos: anchor.clone().add(new THREE.Vector3(0, -hang, 0)), anchor, ry: 0, hang };
    }
    case 'eave': {
      // 정면 처마: 가운데부터 좌우로 번갈아 / 2줄, 그다음 측면
      const front = Math.floor((EAVE.halfW * 2 - 1) / 0.95);
      const list = [];
      for (let row = 0; row < 2; row++) for (let j = 0; j < front; j++) {
        const off = (j % 2 ? -1 : 1) * Math.ceil(j / 2) * 0.95 + (row ? 0.475 : 0);
        if (Math.abs(off) < EAVE.halfW - 0.4) list.push({ x: off, z: EAVE.z - 0.25, hang: 0.55 + row * 0.6 });
      }
      for (let j = 0; j < 8; j++) for (const s of [-1, 1]) list.push({ x: s * (EAVE.halfW - 0.25), z: EAVE.z - 1.2 - j * 0.95, hang: 0.6 });
      const lap = Math.floor(i / list.length); const s = list[i % list.length];
      const edgeLift = 0.6 * Math.pow(Math.abs(s.x) / EAVE.halfW, 4);
      const anchor = new THREE.Vector3(s.x + lap * 0.22, EAVE.y - 0.1 + edgeLift, s.z);
      const hang = s.hang + lap * 0.35;
      return { pos: anchor.clone().add(new THREE.Vector3(0, -hang, 0)), anchor, ry: 0, hang };
    }
    case 'board': {
      const perRack = RACK.rows.length * RACK.cols; const total = perRack * RACKS.length;
      const lap = Math.floor(i / total); const k = i % total;
      // 랙을 번갈아 채워 고르게 보이도록
      const rack = RACKS[k % RACKS.length]; const kk = Math.floor(k / RACKS.length);
      const row = Math.floor(kk / RACK.cols) % RACK.rows.length; const col = kk % RACK.cols;
      const local = (col - (RACK.cols - 1) / 2) * RACK.spacing + lap * 0.2;
      // 랙 로컬 x축 → 월드 (ry 회전)
      const cos = Math.cos(rack.ry), sin = Math.sin(rack.ry);
      const fwd = 0.08 + lap * 0.05;
      const pos = new THREE.Vector3(rack.x + local * cos + fwd * sin, RACK.rows[row] - 0.3, rack.z - local * sin + fwd * cos);
      return { pos, ry: rack.ry, hang: 0.12 };
    }
    default:
      return { pos: new THREE.Vector3(0, 1, 0), ry: 0, hang: null };
  }
}

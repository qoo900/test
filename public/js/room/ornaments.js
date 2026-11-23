// 모델 트리 위에 롤링페이퍼 장식(메시지) 걸기
// 트리 잎 정점 중 바깥쪽·방 쪽을 향한 점들을 골라 슬롯을 만들고, 작성 순서대로 배정 → 모두에게 같은 자리
import * as THREE from 'three';
import { ITEM_TYPES } from '../data/catalog.js';
import { buildMesh } from '../world/decorations.js';
import { rng, glowTexture } from '../util.js';

export class RoomOrnaments {
  constructor(scene, treeCenter, treeVerts) {
    this.scene = scene; this.center = treeCenter; this.entries = new Map(); this.hits = [];
    this.root = new THREE.Group(); scene.add(this.root);
    this.slots = this.makeSlots(treeVerts); this.baseSlots = this.makeBaseSlots();
    this.t = 0; this.hl = null;
    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffe2a6', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    this.halo.scale.setScalar(0.45); scene.add(this.halo);
  }

  makeSlots(verts) {
    const c = this.center; const toRoom = Math.atan2(-c.x, -c.z); // 트리 → 방 중앙 방향
    // 높이별 최대 반경을 구해서 바깥쪽 점만
    // 높이 구간별 반경 85% 분위수 (튀는 점 영향 줄이기)
    const lists = new Map(); verts.forEach((v) => { const k = Math.round(v.y * 5); if (!lists.has(k)) lists.set(k, []); lists.get(k).push(Math.hypot(v.x - c.x, v.z - c.z)); });
    const band = new Map(); for (const [k, arr] of lists) { arr.sort((a, b) => a - b); band.set(k, arr[Math.floor(arr.length * 0.85)]); }
    const cand = verts.filter((v) => {
      if (v.y < 0.45 || v.y > 2.25) return false;
      const r = Math.hypot(v.x - c.x, v.z - c.z); if (r < (band.get(Math.round(v.y * 5)) || 0) * 0.55) return false;
      let d = Math.atan2(v.x - c.x, v.z - c.z) - toRoom; d = Math.atan2(Math.sin(d), Math.cos(d));
      return Math.abs(d) < 1.9; // 방에서 보이는 쪽 약 220°
    });
    console.info('[room] slot candidates', cand.length, 'of', verts.length, 'bands', band.size);
    const r = rng(2026); const slots = [];
    for (let tries = 0; tries < 20000 && slots.length < 140 && cand.length; tries++) {
      const p = cand[Math.floor(r() * cand.length)];
      const minD = slots.length < 50 ? 0.17 : 0.12;
      if (slots.every((s) => s.distanceToSquared(p) > minD * minD)) slots.push(p.clone());
    }
    return slots.length ? slots : [new THREE.Vector3(c.x + 0.4, 1.2, c.z + 0.4)];
  }

  makeBaseSlots() {
    const c = this.center; const toRoom = Math.atan2(-c.x, -c.z); const out = [];
    for (let i = 0; i < 24; i++) { const ring = Math.floor(i / 8), k = i % 8; const a = toRoom + ((k - 3.5) / 8) * 2.4 + ring * 0.15; const rr = 0.95 + ring * 0.25;
      out.push(new THREE.Vector3(c.x + Math.sin(a) * rr, 0.12, c.z + Math.cos(a) * rr)); }
    return out;
  }

  sync(items) {
    const vis = items.filter((it) => it.status === 'visible' && ITEM_TYPES[it.type])
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
    let ti = 0, bi = 0; const keep = new Set();
    for (const it of vis) {
      const base = ITEM_TYPES[it.type].kind === 'gift';
      const slotKey = base ? `b${bi}` : `t${ti}`;
      const pos = base ? this.baseSlots[bi++ % this.baseSlots.length] : this.slots[ti++ % this.slots.length];
      keep.add(it.id);
      const e = this.entries.get(it.id);
      if (e && e.slotKey === slotKey) { e.item = it; continue; }
      if (e) this.remove(it.id);
      this.add(it, pos, slotKey, base);
    }
    for (const id of [...this.entries.keys()]) if (!keep.has(id)) this.remove(id);
  }

  add(item, pos, slotKey, base) {
    const pivot = new THREE.Group(); pivot.position.copy(pos);
    const out = new THREE.Vector3(pos.x - this.center.x, 0, pos.z - this.center.z).normalize();
    pivot.rotation.y = Math.atan2(out.x, out.z);
    const body = buildMesh(item); body.scale.setScalar(base ? 0.75 : 0.62);
    body.traverse((o) => { if (o.isMesh && o.material?.isMeshLambertMaterial) { o.material = o.material.clone(); o.material.emissiveIntensity = (o.material.emissiveIntensity || 0) + 0.15; } });
    if (!base) { body.position.y = -0.07; const str = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.08), new THREE.MeshBasicMaterial({ color: '#d9b56a' })); str.position.y = 0; pivot.add(str); }
    pivot.add(body);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(base ? 0.2 : 0.13, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = base ? 0.05 : -0.07; hit.userData.itemId = item.id; pivot.add(hit);
    this.root.add(pivot); this.hits.push(hit);
    this.entries.set(item.id, { item, pivot, body, hit, slotKey, phase: Math.random() * 6, base });
  }

  remove(id) { const e = this.entries.get(id); if (!e) return; this.root.remove(e.pivot); this.hits = this.hits.filter((h) => h !== e.hit); this.entries.delete(id); }
  worldPos(id) { const e = this.entries.get(id); return e ? e.hit.getWorldPosition(new THREE.Vector3()) : null; }
  outward(id) { const p = this.worldPos(id); return p ? new THREE.Vector3(p.x - this.center.x, 0, p.z - this.center.z) : new THREE.Vector3(0, 0, 1); }
  highlight(id) { this.hl = id; this.hlT = 0; }
  clear() { this.hl = null; }

  update(dt) {
    this.t += dt;
    for (const e of this.entries.values()) if (!e.base) e.pivot.rotation.z = Math.sin(this.t * 1.1 + e.phase) * 0.05;
    const e = this.hl && this.entries.get(this.hl);
    if (e) {
      this.hlT += dt; this.halo.position.copy(this.worldPos(this.hl));
      this.halo.material.opacity = 0.55 + Math.sin(this.hlT * 4) * 0.2;
      e.body.scale.setScalar((e.base ? 0.75 : 0.62) * (1 + Math.max(0, Math.sin(this.hlT * 5)) * 0.25 * Math.max(0, 1 - this.hlT / 2.5)));
    } else this.halo.material.opacity = Math.max(0, this.halo.material.opacity - dt * 2);
  }
}

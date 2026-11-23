// 모델 트리 위에 롤링페이퍼 장식(메시지) 걸기
// 트리 잎 정점 중 바깥쪽·방 쪽을 향한 점들을 골라 슬롯을 만들고, 작성 순서대로 배정 → 모두에게 같은 자리
import * as THREE from 'three';
import { ITEM_TYPES } from '../data/catalog.js';
import { buildMesh } from '../world/decorations.js';
import { rng, glowTexture, hashStr } from '../util.js';

export class RoomOrnaments {
  constructor(scene, treeCenter, treeVerts) {
    this.scene = scene; this.center = treeCenter; this.entries = new Map(); this.hits = [];
    this.root = new THREE.Group(); scene.add(this.root);
    this.slots = this.makeSlots(treeVerts); this.giftSlots = this.makeGiftSlots();
    this.gifts = new Map(); this.ready = false; // 처음 불러온 선물은 바로 놓고, 이후 새로 온 선물만 떨어지는 연출
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

  // 메시지가 늘수록 트리 밑에서부터 바깥으로, 그다음 위로 쌓이는 선물 자리
  makeGiftSlots() {
    const c = this.center; const toRoom = Math.atan2(-c.x, -c.z); const ground = [];
    const blocked = (x, z) => x < -2.6 || x > 2.6 || z < -2.65 || z > 2.6 || (x > -1.3 && z < -2.15) /* 벽난로 */ || (x > 0.05 && x < 1.45 && z > -1.85 && z < 0.05) /* 테이블 */;
    for (let ring = 0; ring < 5; ring++) {
      const r = 0.95 + ring * 0.26; const span = 1.85 + ring * 0.06; const n = Math.max(4, Math.floor((r * span * 2) / 0.3));
      const ringSlots = [];
      for (let k = 0; k < n; k++) {
        const u = n === 1 ? 0.5 : k / (n - 1); const a = toRoom + (u - 0.5) * 2 * span + (ring % 2) * 0.09;
        const x = c.x + Math.sin(a) * r, z = c.z + Math.cos(a) * r;
        if (!blocked(x, z)) ringSlots.push({ x, z, y: 0, a, center: Math.abs(u - 0.5) });
      }
      ringSlots.sort((p, q) => p.center - q.center); // 가운데(방 쪽)부터 채우기
      ground.push(...ringSlots);
    }
    // 위로 쌓기: 안쪽 두 링 위에 2층, 3층
    const stacked = [];
    for (let layer = 1; layer <= 2; layer++) ground.slice(0, Math.floor(ground.length * (layer === 1 ? 0.55 : 0.3))).forEach((g, i) => stacked.push({ ...g, x: g.x + (i % 2 ? 0.04 : -0.04), z: g.z + (layer % 2 ? 0.03 : -0.03), y: layer * 0.27 }));
    return [...ground, ...stacked];
  }

  makeGift(item) {
    const h = hashStr(item.id); const pr = rng(h); const big = ITEM_TYPES[item.type].kind === 'gift';
    const pal = [['#b3202f', '#f0cf78'], ['#2a7048', '#f6efe0'], ['#f4ecdc', '#b51d2c'], ['#d4ab55', '#9b1626'], ['#c8323c', '#f6efe0'], ['#f3e6c8', '#2a7048'], ['#3a5e9a', '#f0cf78'], ['#8e2440', '#f2d590']];
    const [c1, c2] = pal[h % pal.length];
    const w = (big ? 0.27 : 0.16) + pr() * 0.1, hh = (big ? 0.22 : 0.12) + pr() * 0.1, d = w * (0.75 + pr() * 0.4);
    const g = new THREE.Group(); const m1 = new THREE.MeshLambertMaterial({ color: c1 }), m2 = new THREE.MeshLambertMaterial({ color: c2, emissive: c2, emissiveIntensity: 0.08 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m1); box.position.y = hh / 2; g.add(box);
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, hh + 0.004, 0.025), m2); r1.position.y = hh / 2; g.add(r1);
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, hh + 0.004, d + 0.004), m2); r2.position.y = hh / 2; g.add(r2);
    const bowG = new THREE.TorusGeometry(0.022 + w * 0.06, 0.008, 6, 12);
    [-1, 1].forEach((sd) => { const b = new THREE.Mesh(bowG, m2); b.position.set(sd * 0.025, hh + 0.018, 0); b.rotation.set(0, Math.PI / 2, sd * 0.5); g.add(b); });
    g.rotation.y = pr() * Math.PI; g.userData.h = hh;
    return g;
  }

  sync(items) {
    const vis = items.filter((it) => it.status === 'visible' && ITEM_TYPES[it.type])
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
    let ti = 0; const keep = new Set();
    vis.forEach((it, gi) => {
      keep.add(it.id);
      // 트리 장식 (선물 상자 종류는 트리에 걸지 않고 선물 더미에만)
      if (ITEM_TYPES[it.type].kind !== 'gift') {
        const slotKey = `t${ti}`; const pos = this.slots[ti++ % this.slots.length];
        const e = this.entries.get(it.id);
        if (!(e && e.slotKey === slotKey)) { if (e) this.remove(it.id); this.add(it, pos, slotKey, false); } else e.item = it;
      } else if (this.entries.has(it.id)) this.remove(it.id);
      // 선물 더미: 메시지 하나에 선물 하나
      const g = this.gifts.get(it.id);
      if (!g || g.slot !== gi) { if (g) this.removeGift(it.id); this.addGift(it, gi); }
    });
    for (const id of [...this.entries.keys()]) if (!keep.has(id)) this.remove(id);
    for (const id of [...this.gifts.keys()]) if (!keep.has(id)) this.removeGift(id);
    this.ready = true;
  }

  addGift(item, gi) {
    const s = this.giftSlots[gi % this.giftSlots.length]; const lap = Math.floor(gi / this.giftSlots.length);
    const mesh = this.makeGift(item);
    const y = s.y + lap * 0.25;
    mesh.position.set(s.x, y, s.z); this.root.add(mesh);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, mesh.userData.h / 2, 0); hit.userData.itemId = item.id; mesh.add(hit); this.hits.push(hit);
    const drop = this.ready ? { t: 0, from: y + 1.4, to: y } : null; if (drop) mesh.position.y = drop.from;
    this.gifts.set(item.id, { mesh, hit, slot: gi, drop, item });
  }
  removeGift(id) { const g = this.gifts.get(id); if (!g) return; this.root.remove(g.mesh); this.hits = this.hits.filter((h) => h !== g.hit); this.gifts.delete(id); }

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
  worldPos(id) { const e = this.entries.get(id) || this.gifts.get(id); return e ? e.hit.getWorldPosition(new THREE.Vector3()) : null; }
  outward(id) { const p = this.worldPos(id); return p ? new THREE.Vector3(p.x - this.center.x, 0, p.z - this.center.z) : new THREE.Vector3(0, 0, 1); }
  highlight(id) { this.hl = id; this.hlT = 0; }
  clear() { this.hl = null; }

  update(dt) {
    this.t += dt;
    for (const e of this.entries.values()) if (!e.base) e.pivot.rotation.z = Math.sin(this.t * 1.1 + e.phase) * 0.05;
    for (const g of this.gifts.values()) if (g.drop) {
      g.drop.t += dt; const t = Math.min(1, g.drop.t / 0.9);
      const bounce = t < 0.7 ? 1 - (t / 0.7) ** 2 : Math.abs(Math.sin(((t - 0.7) / 0.3) * Math.PI)) * 0.12;
      g.mesh.position.y = g.drop.to + (g.drop.from - g.drop.to) * (t < 0.7 ? bounce : 0) + (t >= 0.7 ? bounce : 0);
      g.mesh.rotation.y += dt * (1 - t) * 3;
      if (t >= 1) { g.mesh.position.y = g.drop.to; g.drop = null; }
    }
    const e = this.hl && this.entries.get(this.hl);
    const ge = this.hl && !e && this.gifts.get(this.hl);
    if (ge) { this.hlT += dt; this.halo.position.copy(this.worldPos(this.hl)); this.halo.material.opacity = 0.55 + Math.sin(this.hlT * 4) * 0.2; }
    if (e) {
      this.hlT += dt; this.halo.position.copy(this.worldPos(this.hl));
      this.halo.material.opacity = 0.55 + Math.sin(this.hlT * 4) * 0.2;
      e.body.scale.setScalar((e.base ? 0.75 : 0.62) * (1 + Math.max(0, Math.sin(this.hlT * 5)) * 0.25 * Math.max(0, 1 - this.hlT / 2.5)));
    } else if (!ge) this.halo.material.opacity = Math.max(0, this.halo.material.opacity - dt * 2);
  }
}

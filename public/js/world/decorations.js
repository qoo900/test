// 트리 장식(편지/오너먼트/별/사탕/벨/선물) 메시 생성 + 배치 동기화 + 선택/하이라이트
import * as THREE from 'three';
import { ITEM_TYPES } from '../data/catalog.js';
import { slotFor, TREE_POS } from './slots.js';
import { STAR_GEO } from './tree.js';
import { hashStr, glowTexture } from '../util.js';

const G = {
  ball: new THREE.SphereGeometry(0.1, 12, 8),
  cap: new THREE.CylinderGeometry(0.022, 0.022, 0.03, 8),
  envelope: new THREE.BoxGeometry(0.26, 0.18, 0.015),
  flap: new THREE.CylinderGeometry(0.13, 0.13, 0.016, 3),
  seal: new THREE.CylinderGeometry(0.025, 0.025, 0.012, 10),
  candyStick: new THREE.CylinderGeometry(0.015, 0.015, 0.2, 6),
  candyHook: new THREE.TorusGeometry(0.04, 0.015, 5, 10, Math.PI),
  bell: new THREE.CylinderGeometry(0.03, 0.075, 0.1, 10, 1, true),
  bellTop: new THREE.SphereGeometry(0.035, 8, 6),
  gift: new THREE.BoxGeometry(0.32, 0.26, 0.32),
  ribbonA: new THREE.BoxGeometry(0.33, 0.265, 0.05),
  ribbonB: new THREE.BoxGeometry(0.05, 0.265, 0.33),
  bow: new THREE.TorusGeometry(0.045, 0.016, 5, 10),
  hit: new THREE.SphereGeometry(0.17, 8, 6),
};
const cache = new Map();
const lam = (color, extra = {}) => { const k = color + JSON.stringify(extra); if (!cache.has(k)) cache.set(k, new THREE.MeshLambertMaterial({ color, ...extra })); return cache.get(k); };
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const GIFT = [['#a3162a', '#f0d27a'], ['#1d5a37', '#f5f1ea'], ['#2b4f8c', '#f0d27a'], ['#f5f1ea', '#c8202f']];

function buildMesh(item) {
  const type = ITEM_TYPES[item.type]; const g = new THREE.Group(); const h = hashStr(item.id);
  switch (type.kind) {
    case 'ball': {
      g.add(new THREE.Mesh(G.ball, lam(type.color, { emissive: type.color, emissiveIntensity: 0.25 })));
      const c = new THREE.Mesh(G.cap, lam('#d8c27a')); c.position.y = 0.105; g.add(c);
      break;
    }
    case 'letter': {
      g.add(new THREE.Mesh(G.envelope, lam('#f6ead2')));
      const flap = new THREE.Mesh(G.flap, lam('#ead9b8')); flap.rotation.set(Math.PI / 2, 0, Math.PI); flap.scale.set(1, 1, 0.45); flap.position.set(0, 0.035, 0.009); g.add(flap);
      const seal = new THREE.Mesh(G.seal, lam('#b3202a', { emissive: '#400' })); seal.rotation.x = Math.PI / 2; seal.position.z = 0.016; g.add(seal);
      g.rotation.z = ((h % 7) - 3) * 0.06;
      break;
    }
    case 'star': {
      const s = new THREE.Mesh(STAR_GEO, lam('#ffd45a', { emissive: '#ffae1a', emissiveIntensity: 0.9 })); s.scale.setScalar(0.09); g.add(s);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffd45a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
      sp.scale.set(0.4, 0.4, 1); g.add(sp);
      break;
    }
    case 'candy': {
      const m = lam('#f5f1ea', { emissive: '#331111' }); const r = lam('#d01f2f');
      const st = new THREE.Mesh(G.candyStick, m); st.position.y = -0.05; g.add(st);
      const hook = new THREE.Mesh(G.candyHook, r); hook.position.set(-0.04, 0.05, 0); g.add(hook);
      for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.006, 4, 8), r); b.rotation.x = Math.PI / 2; b.position.y = -0.12 + i * 0.06; g.add(b); }
      break;
    }
    case 'bell': {
      const b = new THREE.Mesh(G.bell, lam('#e0a92a', { emissive: '#4a3000', side: THREE.DoubleSide })); g.add(b);
      const t = new THREE.Mesh(G.bellTop, lam('#e0a92a')); t.position.y = 0.04; g.add(t);
      const bow = new THREE.Mesh(G.bow, lam('#c8202f')); bow.position.y = 0.09; g.add(bow);
      break;
    }
    case 'gift': {
      const [c1, c2] = GIFT[h % GIFT.length];
      g.add(new THREE.Mesh(G.gift, lam(c1)), new THREE.Mesh(G.ribbonA, lam(c2)), new THREE.Mesh(G.ribbonB, lam(c2)));
      const b1 = new THREE.Mesh(G.bow, lam(c2)); b1.position.set(-0.04, 0.16, 0); b1.rotation.y = Math.PI / 2; g.add(b1);
      const b2 = b1.clone(); b2.position.x = 0.04; g.add(b2);
      g.scale.setScalar(0.85 + (h % 4) * 0.1);
      break;
    }
    default: break;
  }
  return g;
}

export class DecorationManager {
  constructor(scene) {
    this.root = new THREE.Group(); this.root.position.copy(TREE_POS); scene.add(this.root);
    this.entries = new Map(); this.hits = [];
    this.highlightId = null; this.highlightT = 0; this.t = 0;
  }

  sync(items) {
    const visible = items.filter((it) => it.status === 'visible' && ITEM_TYPES[it.type]);
    const byZone = {};
    visible.slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
      .forEach((it) => { const z = ITEM_TYPES[it.type].zones.includes(it.zone) ? it.zone : ITEM_TYPES[it.type].zones[0]; (byZone[z] ||= []).push(it); });
    const keep = new Set();
    for (const [zone, list] of Object.entries(byZone)) list.forEach((it, idx) => {
      keep.add(it.id);
      const slotKey = `${zone}:${idx}`; const e = this.entries.get(it.id);
      if (e && e.slotKey === slotKey) { e.item = it; return; }
      if (e) this.remove(it.id);
      this.add(it, zone, idx, slotKey);
    });
    for (const id of [...this.entries.keys()]) if (!keep.has(id)) this.remove(id);
  }

  add(item, zone, idx, slotKey) {
    const slot = slotFor(zone, idx);
    const pivot = new THREE.Group();
    pivot.position.copy(slot.pos).add(new THREE.Vector3(0, slot.hang, 0)); pivot.rotation.y = slot.ry;
    const body = buildMesh(item); body.position.y = -slot.hang; pivot.add(body);
    const hit = new THREE.Mesh(G.hit, hitMat); hit.position.y = -slot.hang; hit.userData.itemId = item.id; pivot.add(hit);
    this.root.add(pivot); this.hits.push(hit);
    this.entries.set(item.id, { item, pivot, body, hit, slotKey, zone, phase: (hashStr(item.id) % 1000) / 159 });
  }

  remove(id) {
    const e = this.entries.get(id); if (!e) return;
    this.root.remove(e.pivot); this.hits = this.hits.filter((h) => h !== e.hit); this.entries.delete(id);
  }

  get(id) { return this.entries.get(id)?.item; }
  worldPos(id, out = new THREE.Vector3()) { const e = this.entries.get(id); return e ? e.hit.getWorldPosition(out) : null; }
  highlight(id) { this.highlightId = id; this.highlightT = 0; }

  update(dt) {
    this.t += dt;
    for (const e of this.entries.values()) if (e.zone === 'tree') e.pivot.rotation.z = Math.sin(this.t * 1.2 + e.phase) * 0.06;
    if (this.highlightId) {
      const e = this.entries.get(this.highlightId); this.highlightT += dt;
      if (!e || this.highlightT > 2.4) { if (e) e.body.scale.setScalar(1); this.highlightId = null; }
      else e.body.scale.setScalar(1 + Math.abs(Math.sin(this.highlightT * 6)) * 0.5 * (1 - this.highlightT / 2.4));
    }
  }
}

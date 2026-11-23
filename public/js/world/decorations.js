// 장식(연등/오너먼트/편지/팻말/선물) 3D 메시 생성 + 배치/동기화/선택/하이라이트
import * as THREE from 'three';
import { ITEM_TYPES } from '../data/catalog.js';
import { slotFor } from './slots.js';
import { STAR_GEO } from './tree.js';
import { hashStr, glowTexture } from '../util.js';

// ── 공유 지오메트리/재질 (아이템 100개 이상도 가볍게) ──
const G = {
  lantern: new THREE.SphereGeometry(0.26, 14, 10),
  lanternCap: new THREE.CylinderGeometry(0.1, 0.12, 0.07, 10),
  tassel: new THREE.CylinderGeometry(0.012, 0.035, 0.28, 5),
  band: new THREE.TorusGeometry(0.255, 0.035, 6, 18),
  pompom: new THREE.SphereGeometry(0.07, 8, 6),
  petal: new THREE.ConeGeometry(0.09, 0.22, 4),
  ball: new THREE.SphereGeometry(0.17, 14, 10),
  ballCap: new THREE.CylinderGeometry(0.045, 0.045, 0.06, 8),
  envelope: new THREE.BoxGeometry(0.42, 0.28, 0.03),
  seal: new THREE.CylinderGeometry(0.05, 0.05, 0.02, 12),
  gift: new THREE.BoxGeometry(0.5, 0.4, 0.5),
  ribbonA: new THREE.BoxGeometry(0.52, 0.41, 0.08),
  ribbonB: new THREE.BoxGeometry(0.08, 0.41, 0.52),
  bow: new THREE.TorusGeometry(0.07, 0.025, 6, 10),
  plate: new THREE.BoxGeometry(0.34, 0.5, 0.035),
  hit: new THREE.SphereGeometry(0.38, 8, 6),
};
const matCache = new Map();
function mat(key, make) { if (!matCache.has(key)) matCache.set(key, make()); return matCache.get(key); }
const std = (color, extra = {}) => mat(`s:${color}:${JSON.stringify(extra)}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra }));
const glow = (color) => mat(`g:${color}`, () => new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
const hitMat = new THREE.MeshBasicMaterial({ visible: false });
const ropeMat = new THREE.LineBasicMaterial({ color: '#4a3527' });

const ORN_COLORS = ['#c62d3a', '#d9a520', '#2d6bc6', '#c0c6d0', '#7a3fb0', '#1f8a5a'];
const GIFT_COLORS = [['#2f7d5b', '#e8c34a'], ['#b8323a', '#f4efe2'], ['#2d5aa8', '#f0c24b'], ['#7a3fb0', '#f4efe2']];

function plateTexture(text, wood) {
  return mat(`plate:${text}:${wood}`, () => {
    const c = document.createElement('canvas'); c.width = 96; c.height = 140; const ctx = c.getContext('2d');
    ctx.fillStyle = wood; ctx.fillRect(0, 0, 96, 140);
    ctx.strokeStyle = 'rgba(80,50,25,0.35)'; for (let y = 6; y < 140; y += 9) { ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(30, y + 3, 60, y - 3, 96, y); ctx.stroke(); }
    ctx.fillStyle = '#7b1f1f'; ctx.font = 'bold 40px "Noto Serif KR", serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [...text].forEach((ch, i, arr) => ctx.fillText(ch, 48, 70 + (i - (arr.length - 1) / 2) * 44));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
  });
}

function buildMesh(item) {
  const type = ITEM_TYPES[item.type];
  const g = new THREE.Group();
  const h = hashStr(item.id);
  switch (type.kind) {
    case 'lantern': {
      const color = type.color;
      const body = new THREE.Mesh(G.lantern, std(color, { emissive: color, emissiveIntensity: 0.75, roughness: 0.7 }));
      body.scale.set(1, 0.9, 1); g.add(body);
      const top = new THREE.Mesh(G.lanternCap, std('#3b2b22')); top.position.y = 0.24; g.add(top);
      const bot = top.clone(); bot.position.y = -0.24; g.add(bot);
      const tassel = new THREE.Mesh(G.tassel, std(item.type === 'gold_lantern' ? '#c0392b' : '#f2c14e')); tassel.position.y = -0.4; g.add(tassel);
      if (item.type === 'santa_lantern') {
        const band = new THREE.Mesh(G.band, std('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.3 })); band.rotation.x = Math.PI / 2; band.position.y = 0.14; band.scale.set(0.85, 0.85, 1); g.add(band);
        const pom = new THREE.Mesh(G.pompom, std('#ffffff')); pom.position.set(0.12, 0.3, 0); g.add(pom);
      } else if (item.type === 'lotus_lantern') {
        for (let i = 0; i < 8; i++) {
          const p = new THREE.Mesh(G.petal, std('#ffc1d6', { emissive: '#ff7aa8', emissiveIntensity: 0.4 }));
          const a = (i / 8) * Math.PI * 2; p.position.set(Math.cos(a) * 0.2, 0.12, Math.sin(a) * 0.2);
          p.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); g.add(p);
        }
      } else {
        const band = new THREE.Mesh(G.band, std('#c0392b')); band.rotation.x = Math.PI / 2; band.scale.set(0.95, 0.95, 1); g.add(band);
      }
      const sp = new THREE.Sprite(glow(color)); sp.scale.set(1.5, 1.5, 1); g.add(sp);
      break;
    }
    case 'ornament': {
      const color = ORN_COLORS[h % ORN_COLORS.length];
      const ball = new THREE.Mesh(G.ball, std(color, { metalness: 0.6, roughness: 0.22, emissive: color, emissiveIntensity: 0.15 })); g.add(ball);
      const cap = new THREE.Mesh(G.ballCap, std('#d8c27a', { metalness: 0.8, roughness: 0.3 })); cap.position.y = 0.17; g.add(cap);
      break;
    }
    case 'star': {
      const s = new THREE.Mesh(STAR_GEO, std('#ffd45a', { emissive: '#ffb21a', emissiveIntensity: 1.0, metalness: 0.5, roughness: 0.3 }));
      s.scale.setScalar(0.2); g.add(s);
      const sp = new THREE.Sprite(glow('#ffd45a')); sp.scale.set(0.9, 0.9, 1); g.add(sp);
      break;
    }
    case 'letter': {
      const env = new THREE.Mesh(G.envelope, std('#f6ead2', { roughness: 0.9 })); g.add(env);
      const seal = new THREE.Mesh(G.seal, std('#b3202a')); seal.rotation.x = Math.PI / 2; seal.position.z = 0.02; g.add(seal);
      g.rotation.z = ((h % 7) - 3) * 0.05;
      break;
    }
    case 'gift': {
      const [c1, c2] = GIFT_COLORS[h % GIFT_COLORS.length];
      g.add(new THREE.Mesh(G.gift, std(c1)));
      g.add(new THREE.Mesh(G.ribbonA, std(c2)), new THREE.Mesh(G.ribbonB, std(c2)));
      const b1 = new THREE.Mesh(G.bow, std(c2)); b1.position.set(-0.06, 0.24, 0); b1.rotation.y = Math.PI / 2; g.add(b1);
      const b2 = b1.clone(); b2.position.x = 0.06; g.add(b2);
      break;
    }
    case 'sign': {
      const plate = new THREE.Mesh(G.plate, [std(type.color), std(type.color), std(type.color), std(type.color), plateTexture(type.plate, type.color), std(type.color)]);
      g.add(plate);
      g.rotation.z = ((h % 5) - 2) * 0.04;
      break;
    }
    default: break;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}

export class DecorationManager {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group(); scene.add(this.root);
    this.entries = new Map(); // id -> { item, pivot, body, hit, slotKey, phase }
    this.hits = [];
    this.highlightId = null; this.highlightT = 0;
    this.t = 0;
  }

  // 표시할 아이템 목록 전체를 받아 메시를 생성/삭제/재배치
  sync(items) {
    const visible = items.filter((it) => it.status === 'visible' && ITEM_TYPES[it.type]);
    const byZone = {};
    visible.slice().sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1))
      .forEach((it) => (byZone[it.zone] ||= []).push(it));
    const keep = new Set();
    for (const [zone, list] of Object.entries(byZone)) {
      list.forEach((it, idx) => {
        keep.add(it.id);
        const slotKey = `${zone}:${idx}`;
        let e = this.entries.get(it.id);
        if (e && e.slotKey === slotKey) { e.item = it; return; }
        if (e) this.removeEntry(it.id);
        this.addEntry(it, zone, idx, slotKey);
      });
    }
    for (const id of [...this.entries.keys()]) if (!keep.has(id)) this.removeEntry(id);
  }

  addEntry(item, zone, idx, slotKey) {
    const slot = slotFor(zone, idx);
    const pivot = new THREE.Group();
    const body = buildMesh(item);
    const hang = slot.hang ?? 0;
    pivot.position.copy(slot.pos).add(new THREE.Vector3(0, hang, 0));
    pivot.rotation.y = slot.ry;
    body.position.y = -hang;
    pivot.add(body);
    if (hang > 0.05) {
      const rope = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -hang + 0.22, 0)]), ropeMat);
      pivot.add(rope);
    }
    const hit = new THREE.Mesh(G.hit, hitMat); hit.position.y = -hang; hit.userData.itemId = item.id; pivot.add(hit);
    this.root.add(pivot);
    this.hits.push(hit);
    this.entries.set(item.id, { item, pivot, body, hit, slotKey, phase: (hashStr(item.id) % 1000) / 159, swing: zone === 'string' || zone === 'eave' ? 1 : zone === 'tree' || zone === 'board' ? 0.4 : 0, zone });
  }

  removeEntry(id) {
    const e = this.entries.get(id); if (!e) return;
    this.root.remove(e.pivot);
    e.pivot.traverse((o) => { if (o.isLine) o.geometry.dispose(); });
    this.hits = this.hits.filter((h) => h !== e.hit);
    this.entries.delete(id);
  }

  get(id) { return this.entries.get(id)?.item; }

  worldPos(id, out = new THREE.Vector3()) {
    const e = this.entries.get(id); if (!e) return null;
    return e.hit.getWorldPosition(out);
  }

  highlight(id) { this.highlightId = id; this.highlightT = 0; }

  update(dt) {
    this.t += dt;
    for (const e of this.entries.values()) {
      if (e.swing) {
        e.pivot.rotation.z = Math.sin(this.t * 1.1 + e.phase) * 0.07 * e.swing;
        e.pivot.rotation.x = Math.cos(this.t * 0.9 + e.phase * 1.3) * 0.05 * e.swing;
      }
    }
    if (this.highlightId) {
      const e = this.entries.get(this.highlightId);
      this.highlightT += dt;
      if (!e || this.highlightT > 2.4) { if (e) e.body.scale.setScalar(1); this.highlightId = null; }
      else e.body.scale.setScalar(1 + Math.abs(Math.sin(this.highlightT * 6)) * 0.35 * (1 - this.highlightT / 2.4));
    }
  }
}

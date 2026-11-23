// 로우폴리 미니어처 캐릭터: 몸(동자승/눈사람/곰/토끼) × 색상 × 모자
import * as THREE from 'three';
import { makeLabelSprite, makeEmojiSprite } from '../util.js';

const S = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const SKIN = '#f6d7b8';

function eyes(g, y, z, spread = 0.11, size = 0.035) {
  const m = S('#1d1d24', { roughness: 0.3 });
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), m); e.position.set(s * spread, y, z); g.add(e); }
  const blush = S('#f49aa0');
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), blush); b.scale.set(1, 0.5, 0.3); b.position.set(s * (spread + 0.07), y - 0.07, z - 0.02); g.add(b); }
}

function buildHat(id, headTop, headR) {
  const g = new THREE.Group(); g.position.y = headTop - headR * 0.25;
  switch (id) {
    case 'santa': {
      const brim = new THREE.Mesh(new THREE.TorusGeometry(headR * 0.82, 0.06, 8, 18), S('#ffffff')); brim.rotation.x = Math.PI / 2; g.add(brim);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.8, 0.5, 14), S('#d32f2f')); cone.position.set(0, 0.25, -0.02); cone.rotation.x = -0.35; g.add(cone);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), S('#ffffff')); pom.position.set(0, 0.47, -0.17); g.add(pom);
      break;
    }
    case 'beanie': {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.9, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), S('#2e86de')); cap.position.y = 0.02; g.add(cap);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.92, headR * 0.92, 0.1, 16), S('#f5f0e6')); rim.position.y = 0.02; g.add(rim);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), S('#f5f0e6')); pom.position.y = headR * 0.9 + 0.04; g.add(pom);
      break;
    }
    case 'gat': { // 삿갓
      const c = new THREE.Mesh(new THREE.ConeGeometry(headR * 1.9, 0.32, 16), S('#c9a66b', { flatShading: true })); c.position.y = 0.16; g.add(c);
      break;
    }
    case 'antler': {
      const m = S('#8b5a2b');
      for (const s of [-1, 1]) {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.32, 5), m); a.position.set(s * 0.15, 0.12, 0); a.rotation.z = -s * 0.4; g.add(a);
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.16, 5), m); b.position.set(s * 0.25, 0.22, 0); b.rotation.z = -s * 1.1; g.add(b);
      }
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), S('#e53935', { emissive: '#e53935', emissiveIntensity: 0.6 }));
      nose.position.set(0, -headR * 0.75 + 0.25, headR - 0.02); nose.name = 'rudolph'; g.add(nose);
      break;
    }
    default: break;
  }
  return g;
}

export function buildAvatar({ body = 'monk', color = '#c0392b', hat = 'santa' } = {}) {
  const root = new THREE.Group();
  const model = new THREE.Group(); root.add(model);
  const parts = { legs: [], arms: [] };
  const main = S(color);
  let headY = 1.0, headR = 0.3;

  if (body === 'snowman') {
    const snow = S('#f7f9ff', { roughness: 0.9 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 12), snow); b1.position.y = 0.36; model.add(b1);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), snow); b2.position.y = 0.82; model.add(b2);
    headY = 1.18; headR = 0.24;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 16, 12), snow); head.position.y = headY; model.add(head);
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 16), main); scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.98; model.add(scarf);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.05), main); tail.position.set(0.14, 0.86, 0.2); tail.rotation.z = 0.2; model.add(tail);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 8), S('#f28c28')); nose.rotation.x = Math.PI / 2; nose.position.set(0, headY - 0.02, headR + 0.08); model.add(nose);
    for (const y of [0.5, 0.36, 0.84]) { const btn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), S('#222')); btn.position.set(0, y, y > 0.6 ? 0.27 : 0.37); model.add(btn); }
    for (const s of [-1, 1]) { const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.45, 5), S('#6b4a2b')); arm.position.set(s * 0.38, 0.88, 0); arm.rotation.z = s * 1.0; model.add(arm); parts.arms.push(arm); }
    eyes(model, headY + 0.05, headR - 0.03, 0.08, 0.03);
  } else {
    const isMonk = body === 'monk';
    const furColor = body === 'bear' ? '#8a5a3c' : body === 'rabbit' ? '#f4f1ec' : SKIN;
    const fur = S(furColor, { roughness: 0.85 });
    // 몸통(옷)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.32, 0.55, 14), isMonk ? S('#9aa0a8') : main);
    torso.position.y = 0.55; model.add(torso);
    if (isMonk) { // 동자승: 회색 승복 + 색 가사 띠
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.62, 0.62), main); sash.position.set(0, 0.56, 0); sash.rotation.z = 0.6; sash.scale.set(1, 1, 0.98); model.add(sash);
    } else {
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), S('#f5ead8')); belly.scale.set(1, 1.1, 0.5); belly.position.set(0, 0.55, 0.24); model.add(belly);
    }
    // 다리
    for (const s of [-1, 1]) {
      const leg = new THREE.Group(); leg.position.set(s * 0.12, 0.3, 0);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.26, 8), isMonk ? S('#7f858d') : fur); l.position.y = -0.13; leg.add(l);
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), isMonk ? S('#3b3b44') : fur); foot.scale.set(1, 0.6, 1.3); foot.position.set(0, -0.26, 0.03); leg.add(foot);
      model.add(leg); parts.legs.push(leg);
    }
    // 팔
    for (const s of [-1, 1]) {
      const arm = new THREE.Group(); arm.position.set(s * 0.3, 0.75, 0);
      const a = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 8), isMonk ? S('#9aa0a8') : main); a.position.y = -0.15; arm.add(a);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), fur); hand.position.y = -0.33; arm.add(hand);
      arm.rotation.z = s * 0.15; model.add(arm); parts.arms.push(arm);
    }
    // 머리
    headY = 1.08; headR = 0.32;
    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 18, 14), fur); head.position.y = headY; head.castShadow = true; model.add(head);
    if (body === 'bear') {
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), fur); ear.position.set(s * 0.22, headY + 0.24, -0.02); model.add(ear); }
      const snout = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), S('#d9b48f')); snout.scale.set(1.2, 0.85, 0.8); snout.position.set(0, headY - 0.08, headR - 0.04); model.add(snout);
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), S('#2b1d14')); nose.position.set(0, headY - 0.04, headR + 0.04); model.add(nose);
    } else if (body === 'rabbit') {
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), fur); ear.position.set(s * 0.12, headY + 0.42, -0.03); ear.rotation.z = -s * 0.15; model.add(ear);
        const inner = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.22, 4, 6), S('#f6b8c4')); inner.position.set(s * 0.12, headY + 0.42, 0.02); inner.rotation.z = -s * 0.15; model.add(inner); }
      const nose = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), S('#f28aa0')); nose.position.set(0, headY - 0.05, headR); model.add(nose);
    } else { // 동자승: 동그란 민머리 + 귀
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fur); ear.scale.set(0.5, 1, 1); ear.position.set(s * headR, headY - 0.02, 0); model.add(ear); }
      const smile = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), S('#a0453c')); smile.rotation.z = Math.PI; smile.position.set(0, headY - 0.1, headR - 0.02); model.add(smile);
    }
    eyes(model, headY + 0.02, headR - 0.04);
  }

  const hatG = buildHat(hat, headY + headR, headR);
  model.add(hatG);
  model.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  root.userData = { parts, model, headTop: headY + headR + (hat === 'santa' ? 0.5 : hat === 'gat' ? 0.3 : 0.15) };
  return root;
}

// 걷기/감정표현/이름표를 가진 캐릭터 래퍼
export class Character {
  constructor(scene, appearance, name) {
    this.scene = scene;
    this.group = new THREE.Group(); scene.add(this.group);
    this.walk = 0; this.speed = 0; this.emote = null; this.emoteT = 0; this.bowT = 99;
    this.setAppearance(appearance, name);
  }
  setAppearance(appearance, name) {
    if (this.avatar) this.group.remove(this.avatar);
    this.appearance = appearance;
    this.avatar = buildAvatar(appearance);
    this.group.add(this.avatar);
    this.setName(name);
  }
  setName(name) {
    if (this.label) { this.group.remove(this.label); this.label.material.map.dispose(); }
    this.name = name;
    if (!name) return;
    this.label = makeLabelSprite(name);
    this.label.position.y = this.avatar.userData.headTop + 0.35;
    this.group.add(this.label);
  }
  showEmote(emoji) {
    if (this.emote) { this.group.remove(this.emote); this.emote.material.map.dispose(); }
    this.emote = makeEmojiSprite(emoji, 0.7);
    this.emote.position.y = this.avatar.userData.headTop + 0.95;
    this.group.add(this.emote); this.emoteT = 0;
    if (emoji === '🙏' || emoji === '👋') this.bowT = 0;
  }
  update(dt, speed) {
    const { parts, model } = this.avatar.userData;
    this.speed = speed;
    this.walk += dt * (4 + speed * 2.2) * (speed > 0.05 ? 1 : 0);
    const k = Math.min(1, speed / 3);
    const sw = Math.sin(this.walk) * 0.7 * k;
    parts.legs.forEach((l, i) => { l.rotation.x = i ? sw : -sw; });
    parts.arms.forEach((a, i) => { a.rotation.x = i ? -sw * 0.8 : sw * 0.8; });
    model.position.y = Math.abs(Math.sin(this.walk)) * 0.06 * k;
    // 합장/인사: 몸을 살짝 숙임
    this.bowT += dt;
    model.rotation.x = this.bowT < 1.2 ? Math.sin((this.bowT / 1.2) * Math.PI) * 0.45 : 0;
    if (this.emote) {
      this.emoteT += dt;
      this.emote.position.y = this.avatar.userData.headTop + 0.95 + this.emoteT * 0.25;
      this.emote.material.opacity = Math.max(0, 1 - Math.max(0, this.emoteT - 1.6) / 0.6);
      if (this.emoteT > 2.2) { this.group.remove(this.emote); this.emote.material.map.dispose(); this.emote = null; }
    }
  }
  dispose() { this.scene.remove(this.group); }
}

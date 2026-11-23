// 다른 접속자(서버 presence) 아바타 + 공간을 살려 주는 NPC 주민
import * as THREE from 'three';
import { Character } from './avatar.js';
import { resolve } from './colliders.js';
import { dampAngle, rng } from '../util.js';

export class RemotePlayers {
  constructor(scene) { this.scene = scene; this.map = new Map(); }

  apply(players) {
    const seen = new Set();
    for (const p of players) {
      seen.add(p.id);
      let r = this.map.get(p.id);
      const key = `${p.avatar.body}|${p.avatar.color}|${p.avatar.hat}`;
      if (!r) {
        r = { ch: new Character(this.scene, p.avatar, p.name), key, pos: new THREE.Vector3(p.x, 0, p.z), target: new THREE.Vector3(p.x, 0, p.z), ry: p.ry, emoteAt: p.emoteAt };
        r.ch.group.position.copy(r.pos);
        this.map.set(p.id, r);
      } else {
        if (r.key !== key) { r.ch.setAppearance(p.avatar, p.name); r.key = key; }
        else if (r.ch.name !== p.name) r.ch.setName(p.name);
      }
      r.target.set(p.x, 0, p.z); r.ry = p.ry;
      if (p.emote && p.emoteAt && p.emoteAt !== r.emoteAt) { r.emoteAt = p.emoteAt; if (Date.now() - p.emoteAt < 5000) r.ch.showEmote(p.emote); }
    }
    for (const [id, r] of this.map) if (!seen.has(id)) { r.ch.dispose(); this.map.delete(id); }
  }

  update(dt) {
    for (const r of this.map.values()) {
      const before = r.pos.clone();
      r.pos.lerp(r.target, 1 - Math.exp(-dt * 5));
      const speed = before.distanceTo(r.pos) / Math.max(dt, 1e-3);
      r.ch.group.position.copy(r.pos);
      r.ch.group.rotation.y = dampAngle(r.ch.group.rotation.y, r.ry, 8, dt);
      r.ch.update(dt, speed);
    }
  }
  get count() { return this.map.size; }
}

// 혼자 접속해도 쓸쓸하지 않도록 마당을 거니는 주민들
const NPCS = [
  { name: '눈사람 도우미', avatar: { body: 'snowman', color: '#c0392b', hat: 'santa' }, lines: ['❄️', '⛄', '🎄'] },
  { name: '동자승 보리', avatar: { body: 'monk', color: '#e67e22', hat: 'gat' }, lines: ['🙏', '🪷', '🔔'] },
  { name: '반달곰 산타', avatar: { body: 'bear', color: '#c0392b', hat: 'santa' }, lines: ['🎁', '🎅', '👋'] },
  { name: '토끼 루돌프', avatar: { body: 'rabbit', color: '#27ae60', hat: 'antler' }, lines: ['🥕', '✨', '👋'] },
];

export class Villagers {
  constructor(scene) {
    const r = rng(77);
    this.list = NPCS.map((n, i) => {
      const ch = new Character(scene, n.avatar, n.name);
      const a = (i / NPCS.length) * Math.PI * 2;
      const pos = new THREE.Vector3(Math.cos(a) * 6.5, 0, Math.sin(a) * 6.5 + 2);
      ch.group.position.copy(pos);
      return { ch, pos, goal: pos.clone(), wait: r() * 3, lines: n.lines, r: rng(100 + i) };
    });
  }
  update(dt) {
    for (const v of this.list) {
      v.wait -= dt;
      const d = v.goal.clone().sub(v.pos); d.y = 0;
      let speed = 0;
      if (v.wait <= 0) v.walkT = (v.walkT || 0) + dt;
      if (v.walkT > 10) { v.goal.copy(v.pos); v.walkT = 0; } // 장애물에 막히면 포기하고 새 목적지
      if (v.wait <= 0 && d.length() > 0.2) {
        const step = Math.min(d.length(), 1.3 * dt);
        d.normalize();
        v.pos.addScaledVector(d, step); resolve(v.pos, 0.35);
        speed = 1.3;
        v.ch.group.rotation.y = dampAngle(v.ch.group.rotation.y, Math.atan2(d.x, d.z), 6, dt);
      } else if (v.wait <= 0) {
        // 새 목적지: 마당 안 임의 지점 (트리 주변 링)
        const a = v.r() * Math.PI * 2, rad = 4.5 + v.r() * 8;
        v.goal.set(Math.cos(a) * rad, 0, Math.sin(a) * rad + 1);
        v.wait = 2 + v.r() * 5; v.walkT = 0;
        if (v.r() < 0.45) v.ch.showEmote(v.lines[Math.floor(v.r() * v.lines.length)]);
      }
      v.ch.group.position.copy(v.pos);
      v.ch.update(dt, speed);
    }
  }
}

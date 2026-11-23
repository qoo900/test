// 1인칭 걷기: PC는 WASD/방향키 + 마우스 드래그, 폰은 왼쪽 아래 조이스틱 + 화면 드래그
// 가구 충돌은 미리 측정한 바닥 격자(0.2m)로 처리 → 레이캐스트 없이 가볍게
import * as THREE from 'three';

// 모델에서 측정한 막힌 칸 지도: 행=z(-2.7→+2.7), 열=x(-2.7→+2.7), '#'=가구/트리/벽난로
const GRID = [
  '...#####.##########.........',
  '.######.###########.........',
  '.########...................',
  '.##########.................',
  '##########.............###..',
  '##########......####..####..',
  '.#########.....############.',
  '########.......############.',
  '###.###........######.#####.',
  '.#####.........######..#####',
  '###............######...#.##',
  '.#.............######..#####',
  '...............######..###..',
  '................####....####',
  '.........................###',
  '.........................##.',
  '#####...................####',
  '#####...................####',
  '#####....................###',
  '#####...................####',
  '#####.....................##',
  '#####.....................##',
  '#####.......................',
  '#####.......................',
  '#####.......................',
  '#####.......................',
  '#####.......................',
  '#####.......................',
];
const C = 0.2, O = -2.7, LIM = 2.5;
function blocked(x, z) {
  if (Math.abs(x) > LIM || z < -2.55 || z > 2.55) return true;
  const i = Math.round((z - O) / C), j = Math.round((x - O) / C);
  return GRID[i]?.[j] === '#';
}
const free = (x, z, r = 0.18) => !blocked(x, z) && !blocked(x + r, z) && !blocked(x - r, z) && !blocked(x, z + r) && !blocked(x, z - r);

export class Walker {
  constructor(camera, dom, { joystick, onTap }) {
    this.camera = camera; this.dom = dom; this.onTap = onTap;
    this.pos = new THREE.Vector3(1.6, 1.5, 2.1); this.yaw = 0.55; this.pitch = -0.06;
    this.enabled = true; this.keys = new Set(); this.joy = { id: null, x: 0, y: 0, cx: 0, cy: 0, el: joystick, knob: joystick?.querySelector('.knob') };
    this.look = null; this.focus = null; this.bob = 0;
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.closest?.('input,textarea')) return;
      const k = e.key.toLowerCase(); if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(k)) { this.keys.add(k); if (k.startsWith('arrow')) e.preventDefault(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.5 && this.joy.id === null) {
        Object.assign(this.joy, { id: e.pointerId, cx: e.clientX, cy: e.clientY, x: 0, y: 0 });
        if (this.joy.el) { this.joy.el.style.left = `${e.clientX - 55}px`; this.joy.el.style.top = `${e.clientY - 55}px`; this.joy.el.classList.add('active'); }
        return;
      }
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    });
    addEventListener('pointermove', (e) => {
      if (e.pointerId === this.joy.id) {
        let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy; const l = Math.hypot(dx, dy); if (l > 45) { dx *= 45 / l; dy *= 45 / l; }
        this.joy.x = dx / 45; this.joy.y = dy / 45; if (this.joy.knob) this.joy.knob.style.transform = `translate(${dx}px,${dy}px)`; return;
      }
      if (!this.look || e.pointerId !== this.look.id) return;
      const dx = e.clientX - this.look.x, dy = e.clientY - this.look.y; this.look.x = e.clientX; this.look.y = e.clientY;
      if (Math.hypot(e.clientX - this.look.sx, e.clientY - this.look.sy) > 6) this.look.moved = true;
      if (!this.look.moved || this.focus) return;
      const s = e.pointerType === 'touch' ? 0.006 : 0.0042;
      this.yaw += dx * s; this.pitch = Math.max(-0.75, Math.min(0.6, this.pitch - dy * s * 0.8));
    });
    const up = (e) => {
      if (e.pointerId === this.joy.id) { Object.assign(this.joy, { id: null, x: 0, y: 0 }); if (this.joy.knob) this.joy.knob.style.transform = ''; this.joy.el?.classList.remove('active'); return; }
      if (this.look && e.pointerId === this.look.id) { const l = this.look; this.look = null; if (!l.moved && performance.now() - l.t < 450 && this.enabled) this.onTap?.(e.clientX, e.clientY); }
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }

  // 장식 앞으로 다가가 바라보기 (끝나면 원래 자리로)
  focusOn(target, outward) {
    const stand = target.clone().addScaledVector(outward.setY(0).normalize(), 1.05);
    stand.y = THREE.MathUtils.clamp(target.y + 0.08, 1.0, 1.7);
    const d = target.clone().sub(stand);
    this.focus = { from: { pos: this.pos.clone(), yaw: this.yaw, pitch: this.pitch }, to: { pos: stand, yaw: Math.atan2(-d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)) }, t: 0, back: false };
  }
  unfocus() { if (this.focus && !this.focus.back) { const f = this.focus; this.focus = { from: { pos: this.pos.clone(), yaw: this.yaw, pitch: this.pitch }, to: f.from, t: 0, back: true }; } }

  update(dt) {
    if (this.focus) {
      const f = this.focus; f.t = Math.min(1, f.t + dt / 0.9); const k = f.t * f.t * (3 - 2 * f.t);
      this.pos.lerpVectors(f.from.pos, f.to.pos, k);
      let dy = f.to.yaw - f.from.yaw; dy = ((dy + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      this.yaw = f.from.yaw + dy * k; this.pitch = f.from.pitch + (f.to.pitch - f.from.pitch) * k;
      if (f.back && f.t >= 1) this.focus = null;
    } else if (this.enabled) {
      let f = 0, r = 0; const K = this.keys;
      if (K.has('w') || K.has('arrowup')) f += 1; if (K.has('s') || K.has('arrowdown')) f -= 1;
      if (K.has('d') || K.has('arrowright')) r += 1; if (K.has('a') || K.has('arrowleft')) r -= 1;
      if (this.joy.id !== null) { f -= this.joy.y; r += this.joy.x; }
      const len = Math.hypot(f, r);
      if (len > 0.05) {
        if (len > 1) { f /= len; r /= len; }
        const sp = (K.has('shift') ? 2.4 : 1.5) * dt; const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
        const mx = (-sy * f + cy * r) * sp, mz = (-cy * f - sy * r) * sp;
        if (free(this.pos.x + mx, this.pos.z)) this.pos.x += mx; // 축별로 따로 → 벽을 따라 미끄러지듯
        if (free(this.pos.x, this.pos.z + mz)) this.pos.z += mz;
        this.bob += dt * 7 * Math.min(1, len);
      }
      this.pos.y = 1.5 + Math.sin(this.bob) * 0.012;
    }
    this.camera.position.copy(this.pos);
    const dir = new THREE.Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    this.camera.lookAt(this.pos.clone().add(dir));
  }
}

// 입력 처리 + 3인칭 카메라 리그
//  데스크톱: WASD/방향키 이동, Shift 달리기, 마우스 드래그 시점 회전, 휠 줌, 클릭 선택
//  모바일:   왼쪽 하단 가상 조이스틱 이동, 화면 드래그 시점 회전, 두 손가락 핀치 줌, 탭 선택
import * as THREE from 'three';
import { clamp, damp } from '../util.js';

export class Controls {
  constructor(camera, dom, { joystick, onTap }) {
    this.camera = camera; this.dom = dom; this.onTap = onTap;
    this.enabled = true;
    this.keys = new Set();
    this.yaw = 0; this.pitch = 0.42; this.dist = 9;
    this.cur = { yaw: 0, pitch: 0.42, dist: 9 };
    this.target = new THREE.Vector3(0, 1.3, 10);
    this.curTarget = this.target.clone();
    this.focus = null; // {pos, dist} 장식 보기 모드
    this.joy = { active: false, id: null, x: 0, y: 0, cx: 0, cy: 0, el: joystick, knob: joystick?.querySelector('.knob') };
    this.pointers = new Map();
    this.pinch = null;
    this.bind();
  }

  bind() {
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.closest?.('input,textarea,select')) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', 'q', 'e'].includes(k)) {
        this.keys.add(k); if (k.startsWith('arrow')) e.preventDefault();
      }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    addEventListener('blur', () => this.keys.clear());

    const d = this.dom;
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    d.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY * 0.012); }, { passive: false });
    d.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointermove', (e) => this.move(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
  }

  zoom(delta) {
    if (this.focus) { this.focus.dist = clamp(this.focus.dist + delta * 0.5, 1.6, 10); return; }
    this.dist = clamp(this.dist + delta * (this.dist * 0.15 + 0.5), 3, 26);
  }

  inJoystickZone(e) {
    return e.pointerType === 'touch' && e.clientX < innerWidth * 0.45 && e.clientY > innerHeight * 0.45;
  }

  down(e) {
    if (!this.enabled) return;
    this.dom.setPointerCapture?.(e.pointerId);
    if (this.joy.el && this.inJoystickZone(e) && !this.joy.active) {
      Object.assign(this.joy, { active: true, id: e.pointerId, cx: e.clientX, cy: e.clientY, x: 0, y: 0 });
      this.joy.el.style.left = `${e.clientX - 60}px`; this.joy.el.style.top = `${e.clientY - 60}px`;
      this.joy.el.classList.add('active');
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  move(e) {
    if (this.joy.active && e.pointerId === this.joy.id) {
      let dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
      const len = Math.hypot(dx, dy); const max = 50;
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      this.joy.x = dx / max; this.joy.y = dy / max;
      if (this.joy.knob) this.joy.knob.style.transform = `translate(${dx}px, ${dy}px)`;
      return;
    }
    const p = this.pointers.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size === 2 && this.pinch) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoom((this.pinch - dist) * 0.05); this.pinch = dist;
      return;
    }
    if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 4) p.dragged = true;
    const s = e.pointerType === 'touch' ? 0.006 : 0.005;
    this.yaw -= dx * s;
    this.pitch = clamp(this.pitch + dy * s, 0.05, 1.35);
  }

  up(e) {
    if (this.joy.active && e.pointerId === this.joy.id) {
      Object.assign(this.joy, { active: false, id: null, x: 0, y: 0 });
      if (this.joy.knob) this.joy.knob.style.transform = '';
      this.joy.el.classList.remove('active');
      return;
    }
    const p = this.pointers.get(e.pointerId); if (!p) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!p.dragged && performance.now() - p.t < 500 && e.target === this.dom) this.onTap?.(e.clientX, e.clientY);
  }

  // 카메라 기준 이동 벡터 (x,z), 길이 0~1
  moveInput() {
    if (!this.enabled) return { x: 0, z: 0, run: false };
    let f = 0, r = 0;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) f += 1;
    if (k.has('s') || k.has('arrowdown')) f -= 1;
    if (k.has('d') || k.has('arrowright')) r += 1;
    if (k.has('a') || k.has('arrowleft')) r -= 1;
    if (this.joy.active) { f -= this.joy.y; r += this.joy.x; }
    // Q/E 키로도 시점 회전
    if (k.has('q')) this.yaw += 0.03;
    if (k.has('e')) this.yaw -= 0.03;
    const len = Math.hypot(f, r); if (len > 1) { f /= len; r /= len; }
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
    return { x: -sy * f + cy * r, z: -cy * f - sy * r, run: k.has('shift') || (this.joy.active && Math.hypot(this.joy.x, this.joy.y) > 0.95) };
  }

  // yaw를 주지 않으면 트리 중심→장식 방향(바깥쪽)에서 바라봄
  setFocus(pos, dist = 3.2, yaw = null) {
    this.focus = { pos: pos.clone(), dist };
    if (yaw !== null) this.yaw = this.nearestYaw(yaw);
    else if (Math.hypot(pos.x, pos.z) > 0.5) this.yaw = this.nearestYaw(Math.atan2(pos.x, pos.z));
    this.pitch = 0.25;
  }
  // 현재 yaw에서 가장 가까운 등가 각도로 (빙글 도는 것 방지)
  nearestYaw(a) { const TAU = Math.PI * 2; return a + Math.round((this.yaw - a) / TAU) * TAU; }
  clearFocus() { this.focus = null; }

  update(dt, playerPos) {
    // 장식 보기: 장식이 화면 위쪽(카드 위)에 오도록 시선을 살짝 아래로
    if (this.focus) this.target.copy(this.focus.pos).add(new THREE.Vector3(0, -this.focus.dist * 0.28, 0));
    else this.target.set(playerPos.x, playerPos.y + 1.3, playerPos.z);
    const dist = this.focus ? this.focus.dist : this.dist;
    this.cur.yaw = damp(this.cur.yaw, this.yaw, 10, dt);
    this.cur.pitch = damp(this.cur.pitch, this.pitch, 10, dt);
    this.cur.dist = damp(this.cur.dist, dist, 6, dt);
    this.curTarget.x = damp(this.curTarget.x, this.target.x, this.focus ? 4 : 12, dt);
    this.curTarget.y = damp(this.curTarget.y, this.target.y, this.focus ? 4 : 12, dt);
    this.curTarget.z = damp(this.curTarget.z, this.target.z, this.focus ? 4 : 12, dt);
    const { yaw, pitch, dist: dd } = this.cur;
    this.camera.position.set(
      this.curTarget.x + Math.sin(yaw) * Math.cos(pitch) * dd,
      Math.max(0.4, this.curTarget.y + Math.sin(pitch) * dd),
      this.curTarget.z + Math.cos(yaw) * Math.cos(pitch) * dd,
    );
    this.camera.lookAt(this.curTarget);
  }

  snap() { this.cur = { yaw: this.yaw, pitch: this.pitch, dist: this.focus ? this.focus.dist : this.dist }; this.curTarget.copy(this.target); }
}

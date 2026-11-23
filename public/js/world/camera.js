// 실내 고정형 카메라: 거실 앞에서 바라보며 드래그로 좌우/위아래 살짝 둘러보기, 휠·핀치 줌, 탭으로 선택
import * as THREE from 'three';
import { clamp, damp } from '../util.js';

export class RoomCamera {
  constructor(camera, dom, { onTap }) {
    this.camera = camera; this.dom = dom; this.onTap = onTap;
    this.home = { target: new THREE.Vector3(0.0, 1.6, -2.2), yaw: 0, pitch: 0.05, dist: 6.3 };
    this.target = this.home.target.clone(); this.yaw = 0; this.pitch = 0.12; this.dist = 6.2;
    this.cur = { target: this.target.clone(), yaw: 0, pitch: 0.12, dist: 6.2 };
    this.focus = null; this.enabled = true;
    this.pointers = new Map(); this.pinch = null;
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    dom.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom(e.deltaY * 0.004); }, { passive: false });
    dom.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      dom.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    dom.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (this.pointers.size === 2 && this.pinch) { const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); this.zoom((this.pinch - d) * 0.012); this.pinch = d; return; }
      if (Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > 5) p.dragged = true;
      if (!p.dragged) return;
      this.focus = null;
      this.yaw = clamp(this.yaw - dx * 0.004, -0.75, 0.75);
      this.pitch = clamp(this.pitch + dy * 0.003, -0.05, 0.55);
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      this.pointers.delete(e.pointerId); if (this.pointers.size < 2) this.pinch = null;
      if (!p.dragged && performance.now() - p.t < 500) this.onTap?.(e.clientX, e.clientY);
    };
    dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
  }

  zoom(d) { if (this.focus) { this.focus.dist = clamp(this.focus.dist + d, 0.8, 3); return; } this.dist = clamp(this.dist + d, 2.6, 7.2); }

  // 세로 화면에서는 트리를 중심으로
  setHome(portrait) {
    this.home = portrait
      ? { target: new THREE.Vector3(1.1, 1.55, -2.0), yaw: 0.05, pitch: 0.06, dist: 6.2 }
      : { target: new THREE.Vector3(0.0, 1.6, -2.2), yaw: 0, pitch: 0.05, dist: 6.3 };
    this.reset();
  }
  reset() { this.focus = null; this.target.copy(this.home.target); this.yaw = this.home.yaw; this.pitch = this.home.pitch; this.dist = this.home.dist; }
  snap() { this.cur = { target: this.target.clone(), yaw: this.yaw, pitch: this.pitch, dist: this.dist }; }

  // 장식 보기: 장식이 화면 위쪽(카드 위)에 오도록
  setFocus(pos, yaw) { this.focus = { pos: pos.clone(), dist: 2.4 }; this.yaw = clamp(yaw, -0.9, 0.9); this.pitch = 0.08; }
  clearFocus() { if (this.focus) { this.focus = null; } }

  update(dt) {
    const tgt = this.focus ? this.focus.pos.clone().add(new THREE.Vector3(0, -this.focus.dist * 0.3, 0)) : this.target;
    const dist = this.focus ? this.focus.dist : this.dist;
    const c = this.cur;
    c.target.x = damp(c.target.x, tgt.x, 5, dt); c.target.y = damp(c.target.y, tgt.y, 5, dt); c.target.z = damp(c.target.z, tgt.z, 5, dt);
    c.yaw = damp(c.yaw, this.yaw, 6, dt); c.pitch = damp(c.pitch, this.pitch, 6, dt); c.dist = damp(c.dist, dist, 5, dt);
    this.camera.position.set(
      c.target.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist,
      c.target.y + Math.sin(c.pitch) * c.dist,
      c.target.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist,
    );
    this.camera.lookAt(c.target);
  }
}

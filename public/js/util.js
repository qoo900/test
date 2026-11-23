import * as THREE from 'three';

export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// 결정적 의사난수 (같은 시드 → 같은 배치)
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDateTimeLocal(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const authorName = (it) => (it.anonymous || !it.author ? '익명의 동료' : it.author);

// 캔버스로 텍스트 라벨 스프라이트 생성 (이름표)
// sizeAttenuation=false: 거리와 무관하게 화면상 일정한 크기의 이름표
export function makeLabelSprite(text, { color = '#fff', bg = 'rgba(20,24,40,0.72)', fontSize = 40, scale = 0.00032 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `600 ${fontSize}px "Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  const h = fontSize + 26;
  c.width = w; c.height = h;
  ctx.font = font;
  ctx.fillStyle = bg;
  roundRect(ctx, 0, 0, w, h, h / 2); ctx.fill();
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true, sizeAttenuation: false });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(w * scale, h * scale, 1);
  sp.renderOrder = 10;
  return sp;
}

export function makeEmojiSprite(emoji, size = 0.8) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.font = '96px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 64, 72);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(size, size, 1);
  sp.renderOrder = 11;
  return sp;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// 부드러운 원형 글로우 텍스처 (연등/별빛/눈송이 공용)
let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * (1 - Math.exp(-lambda * dt));
}

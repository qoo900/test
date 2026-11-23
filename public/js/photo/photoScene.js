// 사진 배경 모드: 배경 사진 위에 누를 수 있는 장식(DOM)을 올리고, 촛불·벽난로 깜빡임과 반짝임만 가볍게 얹습니다.
// 3D 계산이 없어 저사양 폰에서도 가볍습니다.
import { PHOTO } from './layout.js';
import { ITEM_TYPES } from '../data/catalog.js';
import { hashStr, authorName } from '../util.js';

// 장식 아이콘(SVG). 팔레트: 와인 레드 / 크림 / 앤틱 골드
const SVG = {
  red_ball: `<svg viewBox="0 0 40 46"><rect x="16" y="1" width="8" height="6" rx="1.5" fill="#c9a45c"/><circle cx="20" cy="26" r="18" fill="url(#gr)"/><ellipse cx="13" cy="19" rx="5" ry="3.4" fill="#fff" opacity=".45" transform="rotate(-30 13 19)"/><defs><radialGradient id="gr" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e2565a"/><stop offset=".55" stop-color="#9b1c28"/><stop offset="1" stop-color="#4f0c14"/></radialGradient></defs></svg>`,
  gold_ball: `<svg viewBox="0 0 40 46"><rect x="16" y="1" width="8" height="6" rx="1.5" fill="#a8843f"/><circle cx="20" cy="26" r="18" fill="url(#gg)"/><ellipse cx="13" cy="19" rx="5" ry="3.4" fill="#fff" opacity=".5" transform="rotate(-30 13 19)"/><defs><radialGradient id="gg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fbe6b0"/><stop offset=".55" stop-color="#cfa253"/><stop offset="1" stop-color="#7a5421"/></radialGradient></defs></svg>`,
  letter: `<svg viewBox="0 0 48 36"><rect x="2" y="3" width="44" height="30" rx="3" fill="#f6eedf" stroke="#d8c7a8"/><path d="M3 5 L24 21 L45 5" fill="none" stroke="#cdb894" stroke-width="2"/><circle cx="24" cy="21" r="5.5" fill="#9b1c28"/><path d="M21.5 20.5 l2 2 l3-3.5" stroke="#f6d7a0" stroke-width="1.4" fill="none"/></svg>`,
  star: `<svg viewBox="0 0 44 44"><path d="M22 2 L27.6 15.6 L42 16.4 L30.8 25.6 L34.6 40 L22 32 L9.4 40 L13.2 25.6 L2 16.4 L16.4 15.6 Z" fill="url(#gs)" stroke="#fff3d0" stroke-width="1.2"/><defs><linearGradient id="gs" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2c8"/><stop offset="1" stop-color="#d4a54d"/></linearGradient></defs></svg>`,
  candy: `<svg viewBox="0 0 30 48"><path d="M10 46 V16 a8 8 0 0 1 16 0" fill="none" stroke="#f6eedf" stroke-width="6" stroke-linecap="round"/><path d="M10 46 V16 a8 8 0 0 1 16 0" fill="none" stroke="#a31d2a" stroke-width="6" stroke-linecap="round" stroke-dasharray="4 5"/></svg>`,
  bell: `<svg viewBox="0 0 40 44"><path d="M8 32 Q8 10 20 9 Q32 10 32 32 L35 36 H5 Z" fill="url(#gb)"/><circle cx="20" cy="39" r="3.6" fill="#a8843f"/><path d="M14 6 q6 -6 12 0" stroke="#9b1c28" stroke-width="3.5" fill="none"/><defs><linearGradient id="gb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f8e2a6"/><stop offset="1" stop-color="#b98a3a"/></linearGradient></defs></svg>`,
  gift: `<svg viewBox="0 0 48 44"><rect x="4" y="16" width="40" height="26" rx="2" fill="#8e1b24"/><rect x="2" y="10" width="44" height="9" rx="2" fill="#a52430"/><rect x="21" y="10" width="6" height="32" fill="#d9b56a"/><path d="M24 10 C14 0 8 8 24 10 C40 8 34 0 24 10" fill="#d9b56a"/></svg>`,
};

function vdc(n, b = 2) { let v = 0, d = 1; while (n) { d *= b; v += (n % b) / d; n = Math.floor(n / b); } return v; }
function halfWidthAt(y) {
  const p = PHOTO.tree.profile;
  if (y <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) if (y <= p[i][0]) { const [y0, w0] = p[i - 1], [y1, w1] = p[i]; return w0 + ((w1 - w0) * (y - y0)) / (y1 - y0); }
  return p[p.length - 1][1];
}
const inAvoid = (x, y, pad) => PHOTO.avoid.some(([x0, y0, x1, y1]) => x > x0 - pad && x < x1 + pad && y > y0 - pad && y < y1 + pad);

export function buildPhotoScene(container, { onPick }) {
  const root = document.createElement('div'); root.className = 'photo-root';
  root.innerHTML = `
    <div class="photo-bg" style="background-image:url('${PHOTO.src}')"></div>
    <div class="photo-stage">
      <img class="photo-img" src="${PHOTO.src}" alt="" draggable="false" />
      <div class="photo-glows"></div>
      <canvas class="photo-fx"></canvas>
      <div class="photo-orns"></div>
    </div>`;
  container.append(root);
  const stage = root.querySelector('.photo-stage');
  const orns = root.querySelector('.photo-orns');
  const fx = root.querySelector('.photo-fx'); const ctx = fx.getContext('2d');
  const glows = root.querySelector('.photo-glows');
  const pct = (x, y) => `left:${(x / PHOTO.w) * 100}%;top:${(y / PHOTO.h) * 100}%`;

  PHOTO.glows.forEach((g, i) => {
    const d = document.createElement('div'); d.className = `glow glow-${g.kind}`;
    d.style.cssText = `${pct(g.x, g.y)};width:${(g.r * 2 / PHOTO.w) * 100}%;aspect-ratio:1;--c:${g.color};animation-delay:${-i * 0.37}s`;
    glows.append(d);
  });

  // 트리 전체가 보이도록 배치 (가로·세로 어느 화면이든), 남는 곳은 흐린 배경
  let scale = 1;
  function layout() {
    const W = innerWidth, H = innerHeight;
    const U = PHOTO.w / 1206;
    const treeW = (PHOTO.tree.profile.at(-1)[1] + 30 * U) * 2;
    const v0 = 30 * U, v1 = PHOTO.base.cy + PHOTO.base.ry + 30 * U;     // 별 꼭대기 ~ 트리 스커트 아래
    const topRes = 64, botRes = 104;                           // HUD가 차지하는 위/아래 여백
    const availH = Math.max(200, H - topRes - botRes);
    scale = Math.min(Math.max(W / PHOTO.w, H / PHOTO.h), (W * 0.98) / treeW, availH / (v1 - v0));
    const sw = PHOTO.w * scale, sh = PHOTO.h * scale;
    const left = W / 2 - PHOTO.tree.cx * scale;
    const top = topRes + (availH - (v1 - v0) * scale) / 2 - v0 * scale;
    Object.assign(stage.style, { width: `${sw}px`, height: `${sh}px`, left: `${left}px`, top: `${top}px` });
    stage.style.setProperty('--orn', `${Math.max(30, 50 * scale * (PHOTO.w / 1206))}px`);
    fx.width = Math.round(sw * Math.min(devicePixelRatio, 1.5)); fx.height = Math.round(sh * Math.min(devicePixelRatio, 1.5));
  }
  addEventListener('resize', layout); layout();

  // ── 장식 배치 ──
  const entries = new Map();
  function slots(items) {
    const placed = []; const out = new Map();
    const tree = items.filter((it) => it.zone !== 'base'); const base = items.filter((it) => it.zone === 'base');
    const U = PHOTO.w / 1206; // 이미지 크기에 따른 단위 보정
    const minD = 62 * U;
    tree.forEach((it, k) => {
      let best = null;
      for (let j = 0; j < 24; j++) {
        const n = k * 3 + j * 131 + 1;
        const y = PHOTO.tree.yTop + vdc(n) * (PHOTO.tree.yBottom - PHOTO.tree.yTop);
        const hw = halfWidthAt(y) * 0.86;
        const x = PHOTO.tree.cx + (((n * 0.618034) % 1) * 2 - 1) * hw;
        if (inAvoid(x, y, 20 * U)) continue;
        const d = placed.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - x, py - y)), Infinity);
        if (!best || d > best.d) best = { x, y, d };
        if (d > minD) break;
      }
      placed.push([best.x, best.y]); out.set(it.id, best);
    });
    base.forEach((it, k) => {
      const col = k % 7, row = Math.floor(k / 7);
      const x = PHOTO.base.cx + ((col - 3) / 3.3) * PHOTO.base.rx + (row % 2) * 30 * U;
      const y = PHOTO.base.cy + (col % 2 ? 14 : -10) * U - row * 34 * U;
      out.set(it.id, { x, y });
    });
    return out;
  }

  function sync(items) {
    const visible = items.filter((it) => it.status === 'visible' && ITEM_TYPES[it.type])
      .map((it) => ({ ...it, zone: ITEM_TYPES[it.type].zones.includes(it.zone) ? it.zone : ITEM_TYPES[it.type].zones[0] }))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1));
    const pos = slots(visible);
    const keep = new Set();
    visible.forEach((it) => {
      keep.add(it.id);
      const p = pos.get(it.id);
      let e = entries.get(it.id);
      if (!e) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = `orn orn-${it.type} ${it.zone === 'base' ? 'on-floor' : ''}`;
        b.innerHTML = SVG[it.type] || SVG.red_ball;
        b.style.setProperty('--tilt', `${(hashStr(it.id) % 15) - 7}deg`);
        b.style.setProperty('--sway', `${2.6 + (hashStr(it.id) % 10) / 5}s`);
        b.addEventListener('click', (ev) => { ev.stopPropagation(); onPick(it.id); });
        orns.append(b); e = { el: b }; entries.set(it.id, e);
      }
      e.item = it;
      e.el.setAttribute('aria-label', `${authorName(it)}의 ${ITEM_TYPES[it.type].label}`);
      e.el.title = `${ITEM_TYPES[it.type].icon} ${authorName(it)}`;
      e.el.style.left = `${(p.x / PHOTO.w) * 100}%`; e.el.style.top = `${(p.y / PHOTO.h) * 100}%`;
      e.el.style.zIndex = String(Math.round(p.y));
    });
    for (const [id, e] of entries) if (!keep.has(id)) { e.el.remove(); entries.delete(id); }
  }

  function highlight(id) {
    const e = entries.get(id); if (!e) return;
    e.el.classList.remove('pulse'); void e.el.offsetWidth; e.el.classList.add('pulse');
    orns.querySelectorAll('.orn.selected').forEach((x) => x.classList.remove('selected'));
    e.el.classList.add('selected');
  }
  function unfocus() { orns.querySelectorAll('.orn.selected').forEach((x) => x.classList.remove('selected')); }

  // ── 반짝임(트리 위) + 떠오르는 빛 입자 : 2D 캔버스, 수십 개만 ──
  const sparks = Array.from({ length: 34 }, () => newSpark());
  function newSpark() {
    const y = PHOTO.tree.yTop + Math.random() * (PHOTO.tree.yBottom - PHOTO.tree.yTop);
    const x = PHOTO.tree.cx + (Math.random() * 2 - 1) * halfWidthAt(y) * 0.9;
    return { x, y, t: Math.random() * 3, life: 1.4 + Math.random() * 1.8, s: (0.6 + Math.random()) * (PHOTO.w / 1206) };
  }
  const MU = PHOTO.w / 1206;
  const motes = Array.from({ length: 18 }, () => ({ x: Math.random() * PHOTO.w, y: Math.random() * PHOTO.h, v: (6 + Math.random() * 10) * MU, r: (3 + Math.random() * 6) * MU, ph: Math.random() * 6 }));
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const k = fx.width / PHOTO.w;
    ctx.clearRect(0, 0, fx.width, fx.height);
    ctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.y -= m.v * dt; m.x += Math.sin(now / 1500 + m.ph) * 4 * MU * dt; if (m.y < -20) { m.y = PHOTO.h + 20; m.x = Math.random() * PHOTO.w; }
      const g = ctx.createRadialGradient(m.x * k, m.y * k, 0, m.x * k, m.y * k, m.r * k * 2.2);
      g.addColorStop(0, 'rgba(255,214,150,0.22)'); g.addColorStop(1, 'rgba(255,214,150,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(m.x * k, m.y * k, m.r * k * 2.2, 0, 7); ctx.fill();
    }
    sparks.forEach((s, i) => {
      s.t += dt; if (s.t > s.life) sparks[i] = s = newSpark();
      const a = Math.sin((s.t / s.life) * Math.PI); const r = 7 * s.s * k;
      ctx.strokeStyle = `rgba(255,240,205,${a * 0.9})`; ctx.lineWidth = Math.max(1, 1.2 * k);
      ctx.beginPath(); ctx.moveTo(s.x * k - r, s.y * k); ctx.lineTo(s.x * k + r, s.y * k); ctx.moveTo(s.x * k, s.y * k - r); ctx.lineTo(s.x * k, s.y * k + r); ctx.stroke();
      ctx.fillStyle = `rgba(255,236,190,${a * 0.5})`; ctx.beginPath(); ctx.arc(s.x * k, s.y * k, r * 0.45, 0, 7); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return { mode: 'photo', sync, highlight, unfocus };
}

// 배경 이미지가 실제로 있는지 확인 (없으면 3D 모드로)
export function photoAvailable() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true); img.onerror = () => resolve(false);
    img.src = PHOTO.src;
  });
}

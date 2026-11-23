// 데이터 계층: 서버 API 모드와 로컬(localStorage) 모드를 같은 인터페이스로 제공합니다.
// UI/3D 코드는 이 모듈만 사용하므로, 백엔드를 Firebase/Supabase 등으로 바꿀 때도 여기만 교체하면 됩니다.
import { CONFIG } from '../config.js';
import { SAMPLE_ITEMS } from '../data/sample-data.js';
import { DEFAULT_SETTINGS, validateNewItem, isSealed } from '../data/catalog.js';

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

// ── 서버 모드 ───────────────────────────────────────────
class ServerApi {
  constructor(base, room) {
    this.mode = 'server';
    this.base = base;
    this.room = room;
    this.adminPassword = null;
  }
  url(p) { return `${this.base}/api/rooms/${encodeURIComponent(this.room)}${p}`; }
  async req(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.adminPassword) headers['X-Admin-Password'] = this.adminPassword;
    const res = await fetch(this.url(path), { ...opts, headers: { ...headers, ...opts.headers } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || `요청 실패 (${res.status})`);
    return body;
  }
  getState({ admin = false } = {}) { return this.req(`/state${admin ? '?admin=1' : ''}`); }
  addItem(input) { return this.req('/items', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.item); }
  async adminLogin(password) {
    this.adminPassword = password;
    try { await this.req('/admin/login', { method: 'POST' }); return true; }
    catch (e) { this.adminPassword = null; throw e; }
  }
  adminLogout() { this.adminPassword = null; }
  setItemStatus(id, status) { return this.req(`/admin/items/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
  deleteItem(id) { return this.req(`/admin/items/${id}`, { method: 'DELETE' }); }
  updateSettings(patch) { return this.req('/admin/settings', { method: 'PATCH', body: JSON.stringify(patch) }); }
}

// ── 로컬 모드 (서버 없이 정적 호스팅/데모용, 이 브라우저에만 저장) ──
const LOCAL_ADMIN_PASSWORD = 'tree2026'; // 로컬 데모 전용. 실제 운영은 서버 모드를 사용하세요.

class LocalApi {
  constructor(room) {
    this.mode = 'local';
    this.room = room;
    this.key = `wishtree:v2:${room}`;
    this.isAdmin = false;
    this.data = this.load();
  }
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.key));
      if (d?.items) return { ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings } };
    } catch { /* 저장소 사용 불가 시 메모리로 동작 */ }
    return {
      room: this.room,
      settings: { ...DEFAULT_SETTINGS },
      items: SAMPLE_ITEMS.map((s) => ({ id: uid(), room: this.room, status: 'visible', anonymous: false, ...s })),
    };
  }
  save() { try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch { /* ignore */ } }
  state(admin) {
    const sealed = isSealed(this.data.settings);
    const items = this.data.items
      .filter((it) => admin || it.status === 'visible')
      .map((it) => (sealed && !admin ? { ...it, message: null, sealed: true } : { ...it }));
    return { room: this.room, settings: { ...this.data.settings }, sealed, items, serverTime: new Date().toISOString() };
  }
  async getState({ admin = false } = {}) { return this.state(admin && this.isAdmin); }
  async addItem(input) {
    const { value, error } = validateNewItem(input);
    if (error) throw new Error(error);
    const item = { id: uid(), room: this.room, status: 'visible', ...value, createdAt: new Date().toISOString() };
    this.data.items.push(item);
    this.save();
    return isSealed(this.data.settings) ? { ...item, message: null, sealed: true } : item;
  }
  async adminLogin(pw) {
    if (pw !== LOCAL_ADMIN_PASSWORD) throw new Error('비밀번호가 올바르지 않습니다.');
    this.isAdmin = true; return true;
  }
  adminLogout() { this.isAdmin = false; }
  guard() { if (!this.isAdmin) throw new Error('unauthorized'); }
  async setItemStatus(id, status) { this.guard(); const it = this.data.items.find((i) => i.id === id); if (it) it.status = status; this.save(); return this.state(true); }
  async deleteItem(id) { this.guard(); this.data.items = this.data.items.filter((i) => i.id !== id); this.save(); return this.state(true); }
  async updateSettings(patch) {
    this.guard();
    if ('sealEnabled' in patch) this.data.settings.sealEnabled = !!patch.sealEnabled;
    if ('sealUntil' in patch && Number.isFinite(Date.parse(patch.sealUntil))) this.data.settings.sealUntil = new Date(patch.sealUntil).toISOString();
    this.save(); return this.state(true);
  }
}

// 서버가 응답하면 서버 모드, 아니면 로컬 모드
export async function createApi() {
  if (!CONFIG.forceLocal && location.protocol.startsWith('http')) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2500);
      const res = await fetch(`${CONFIG.apiBase}/api/health`, { signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok && (await res.json()).ok) return new ServerApi(CONFIG.apiBase, CONFIG.room);
    } catch { /* fall through */ }
  }
  console.info('[api] 서버를 찾지 못해 로컬 모드(localStorage)로 실행합니다.');
  return new LocalApi(CONFIG.room);
}

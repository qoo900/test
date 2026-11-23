// 우리의 소원트리 - 의존성 없는 Node.js 서버 (Node 18+)
//   실행: node server.js   →  http://localhost:8080
//
// 환경 변수
//   PORT                  (기본 8080)
//   ADMIN_PASSWORD        운영진 비밀번호 (기본 'tree2026' — 운영 시 반드시 변경)
//   PUBLIC_URL            슬랙 메시지에 넣을 외부 접속 주소 (기본 http://localhost:PORT)
//   SLACK_SIGNING_SECRET  슬래시 커맨드 서명 검증용
//   SLACK_WEBHOOK_URL     새 장식 알림을 보낼 슬랙 Incoming Webhook
//   WEBHOOK_URL           (선택) 범용 JSON 웹훅 { event, room, item }
//   DATA_DIR              데이터 저장 폴더 (기본 ./data)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store, newId } from './server/store.js';
import { verifySlackSignature, buildCommandResponse, buildNewItemMessage, postWebhook } from './server/slack.js';
import { validateNewItem, isSealed, sanitizeRoom, sanitizeText, ITEM_STATUS } from './public/js/data/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8080);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'tree2026';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const PUBLIC_DIR = path.join(__dirname, 'public');
const store = new Store(process.env.DATA_DIR || path.join(__dirname, 'data'));

if (!process.env.ADMIN_PASSWORD) console.warn('⚠️  ADMIN_PASSWORD 미설정 — 기본 비밀번호(tree2026)를 사용 중입니다.');

// ── 유틸 ────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
};

function send(res, status, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

function readBody(req, limit = 32 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const raw = await readBody(req);
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function isAdmin(req) {
  const given = Buffer.from(String(req.headers['x-admin-password'] || ''));
  const real = Buffer.from(ADMIN_PASSWORD);
  return given.length === real.length && crypto.timingSafeEqual(given, real);
}

// 간단한 IP별 고정 윈도우 레이트리밋
const buckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { n: 1, reset: now + windowMs }); return true; }
  b.n += 1;
  return b.n <= max;
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k); }, 60_000).unref();

const clientIp = (req) => (req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || '').trim();

// 응답용 아이템 직렬화: 일반 사용자에게는 숨김 아이템 제외 + 봉인 중이면 본문 제거
function publicState(data, admin) {
  const sealed = isSealed(data.settings);
  const items = data.items
    .filter((it) => admin || it.status === 'visible')
    .map((it) => (sealed && !admin ? { ...it, message: null, sealed: true } : it));
  return { room: data.room, settings: data.settings, sealed, items, serverTime: new Date().toISOString() };
}

// ── API 라우팅 ──────────────────────────────────────────
async function handleApi(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); // ['api', ...]

  if (parts[1] === 'health') return send(res, 200, { ok: true, mode: 'server' });

  // 슬랙 슬래시 커맨드 (application/x-www-form-urlencoded)
  if (parts[1] === 'slack' && parts[2] === 'command' && req.method === 'POST') {
    const raw = await readBody(req);
    if (!verifySlackSignature(raw, req.headers, process.env.SLACK_SIGNING_SECRET)) return send(res, 401, { error: 'invalid signature' });
    const form = Object.fromEntries(new URLSearchParams(raw));
    return send(res, 200, buildCommandResponse(form, PUBLIC_URL));
  }

  if (parts[1] !== 'rooms' || !parts[2]) return send(res, 404, { error: 'not found' });
  const room = sanitizeRoom(parts[2]);
  const data = store.get(room);
  const action = parts[3];
  const admin = isAdmin(req);

  // GET /api/rooms/:room/state
  if (action === 'state' && req.method === 'GET') return send(res, 200, publicState(data, admin && url.searchParams.has('admin')));

  // POST /api/rooms/:room/items  (새 장식/편지)
  if (action === 'items' && req.method === 'POST') {
    if (!rateLimit(`item:${clientIp(req)}`, 10, 60_000)) return send(res, 429, { error: '잠시 후 다시 시도해 주세요. (1분에 10개까지)' });
    const body = await readJson(req);
    const { value, error } = validateNewItem(body);
    if (error) return send(res, 400, { error });
    const item = { id: newId(), room, status: 'visible', ...value, createdAt: new Date().toISOString() };
    data.items.push(item);
    store.save(room);
    const sealed = isSealed(data.settings);
    // 알림(비동기, 실패해도 응답에는 영향 없음)
    postWebhook(process.env.SLACK_WEBHOOK_URL, buildNewItemMessage(item, { sealed, publicUrl: PUBLIC_URL, room }));
    postWebhook(process.env.WEBHOOK_URL, { event: 'item.created', room, item: sealed ? { ...item, message: null, sealed } : item });
    return send(res, 201, { item: sealed ? { ...item, message: null, sealed: true } : item });
  }

  // ── 운영진 전용 ──
  if (action === 'admin') {
    if (parts[4] === 'login' && req.method === 'POST') {
      if (!rateLimit(`login:${clientIp(req)}`, 10, 60_000)) return send(res, 429, { error: '시도 횟수 초과' });
      return admin ? send(res, 200, { ok: true }) : send(res, 401, { error: '비밀번호가 올바르지 않습니다.' });
    }
    if (!admin) return send(res, 401, { error: 'unauthorized' });

    if (parts[4] === 'settings' && req.method === 'PATCH') {
      const b = await readJson(req);
      if ('sealEnabled' in b) data.settings.sealEnabled = !!b.sealEnabled;
      if ('sealUntil' in b && Number.isFinite(Date.parse(b.sealUntil))) data.settings.sealUntil = new Date(b.sealUntil).toISOString();
      if ('title' in b) data.settings.title = sanitizeText(b.title, 30) || data.settings.title;
      if ('owner' in b) data.settings.owner = sanitizeText(b.owner, 20) || data.settings.owner;
      store.save(room);
      return send(res, 200, publicState(data, true));
    }
    if (parts[4] === 'items' && parts[5]) {
      const idx = data.items.findIndex((it) => it.id === parts[5]);
      if (idx < 0) return send(res, 404, { error: 'not found' });
      if (req.method === 'PATCH') {
        const { status } = await readJson(req);
        if (!ITEM_STATUS.includes(status)) return send(res, 400, { error: 'bad status' });
        data.items[idx].status = status;
      } else if (req.method === 'DELETE') {
        data.items.splice(idx, 1);
      } else return send(res, 405, { error: 'method' });
      store.save(room);
      return send(res, 200, publicState(data, true));
    }
  }
  return send(res, 404, { error: 'not found' });
}

// ── 정적 파일 ───────────────────────────────────────────
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/' || p === '') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    const ext = path.extname(file);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': p.startsWith('/vendor/') ? 'public, max-age=86400' : 'no-cache',
    });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
    else serveStatic(req, res, url);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, () => console.log(`🎄 우리의 소원트리: http://localhost:${PORT}`));

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { store.flushAll(); process.exit(0); });

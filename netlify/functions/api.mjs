// 우리의 소원트리 - Netlify Functions API (모든 /api/* 요청을 처리)
// 저장소: Netlify Blobs (store "wishtree")
//   rooms/<room>                     방 정보 { id, name, createdAt }
//   items/<room>/<시각>_<id>         메시지 하나 (메시지별로 따로 저장해서 동시에 써도 덮어쓰지 않음)
//   index                            마을 목록 { rooms: { [id]: { name, count, updatedAt } } }
//   rl/<uid>                         작성 속도 제한 기록
//
// 환경 변수 (Netlify > Project configuration > Environment variables)
//   TOKEN_SECRET          입장 링크 서명용 비밀값 (필수, 아무 긴 문자열)
//   ADMIN_PASSWORD        운영진 비밀번호 (필수)
//   SLACK_SIGNING_SECRET  슬랙 앱 Signing Secret (/산타 커맨드 검증)
//   SLACK_BOT_TOKEN       슬랙 봇 토큰 xoxb-… (선택: 이름 조회, 선물 도착 DM 알림)
//   PUBLIC_URL            사이트 주소 (예: https://sweet-kitten-6eef5d.netlify.app)
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { validateNewItem, sanitizeRoom, sanitizeText, ITEM_STATUS, ITEM_TYPES, DEFAULT_SETTINGS } from '../../public/js/data/catalog.js';

export const config = { path: '/api/*' };

const store = () => globalThis.__WISHTREE_STORE || getStore({ name: 'wishtree', consistency: 'strong' }); // 로컬 테스트에서는 메모리 저장소 주입
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });
const env = (k) => (typeof Netlify !== 'undefined' ? Netlify.env.get(k) : process.env[k]) || '';
const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');

// ── 입장 토큰: { uid, name, exp } + HMAC 서명 ──
const b64u = (buf) => Buffer.from(buf).toString('base64url');
function signToken(payload) {
  const body = b64u(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', env('TOKEN_SECRET')).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function readToken(req) {
  const h = req.headers.get('authorization') || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t || !env('TOKEN_SECRET')) return null;
  const [body, sig] = t.split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', env('TOKEN_SECRET')).update(body).digest('base64url');
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
const roomIdOf = (uid) => sanitizeRoom(String(uid).toLowerCase());
function isAdmin(req) {
  const a = Buffer.from(req.headers.get('x-admin-password') || ''), b = Buffer.from(env('ADMIN_PASSWORD'));
  return b.length > 0 && a.length === b.length && crypto.timingSafeEqual(a, b);
}
function personalLink(uid, name) {
  const token = signToken({ uid, name, exp: Date.now() + 1000 * 60 * 60 * 24 * 60 });
  return `${(env('PUBLIC_URL') || '').replace(/\/$/, '')}/?t=${token}`;
}

// ── 방 / 목록 ──
async function ensureRoom(s, uid, name) {
  const id = roomIdOf(uid); const key = `rooms/${id}`;
  let room = await s.get(key, { type: 'json' });
  if (!room) { room = { id, name, createdAt: new Date().toISOString() }; await s.setJSON(key, room); }
  else if (name && room.name !== name) { room.name = name; await s.setJSON(key, room); }
  await touchIndex(s, id, { name: room.name });
  return room;
}
async function touchIndex(s, id, patch) {
  const idx = (await s.get('index', { type: 'json' })) || { rooms: {} };
  const cur = idx.rooms[id] || { name: '', count: 0 };
  idx.rooms[id] = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  await s.setJSON('index', idx);
}
async function listItems(s, room) {
  const { blobs } = await s.list({ prefix: `items/${room}/` });
  const items = await Promise.all(blobs.map((b) => s.get(b.key, { type: 'json' })));
  return items.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}
const publicItem = ({ authorId, ...it }) => it; // 작성자 슬랙 ID는 운영진만

// ── 슬랙 ──
function verifySlack(raw, req) {
  const secret = env('SLACK_SIGNING_SECRET'); if (!secret) return false;
  const ts = req.headers.get('x-slack-request-timestamp'), sig = req.headers.get('x-slack-signature') || '';
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const mac = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${ts}:${raw}`).digest('hex');
  return mac.length === sig.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(sig));
}
async function slackApi(method, body) {
  const tok = env('SLACK_BOT_TOKEN'); if (!tok) return null;
  try {
    const r = await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return null; }
}
async function slackName(uid, fallback) {
  const r = await slackApi('users.info', { user: uid });
  const p = r?.user?.profile; return sanitizeText(p?.display_name || p?.real_name || fallback, 20) || fallback;
}

export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const s = store();
  try {
    if (parts[0] === 'health') return json(200, { ok: true, mode: 'server', auth: 'token' });

    // 슬랙 /산타 → 개인 입장 링크 (본인에게만 보이는 메시지)
    if (parts[0] === 'slack' && parts[1] === 'command' && req.method === 'POST') {
      const raw = await req.text();
      if (!verifySlack(raw, req)) return json(401, { error: 'invalid signature' });
      const f = Object.fromEntries(new URLSearchParams(raw));
      const name = await slackName(f.user_id, f.user_name || '동료');
      await ensureRoom(s, f.user_id, name);
      const link = personalLink(f.user_id, name);
      return json(200, {
        response_type: 'ephemeral',
        text: `🎄 ${name}님의 오두막 입장 링크예요: ${link}`,
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `*${name}님의 오두막이 준비됐어요 🎄*\n벽난로 옆 트리 아래에 동료들의 선물이 쌓여요. 마을에서 동료의 방을 찾아가 선물을 놓아 주세요.\n_이 링크는 본인 전용이에요. 다른 사람에게 공유하지 마세요._` } },
          { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '🏠 내 오두막 들어가기' }, url: link, style: 'primary' }] },
        ],
      });
    }

    const me = readToken(req);

    // 내 정보 + 내 방 준비
    if (parts[0] === 'me') {
      if (!me) return json(401, { error: '입장 링크가 필요해요. 슬랙에서 /산타 를 입력해 주세요.' });
      const room = await ensureRoom(s, me.uid, me.name);
      return json(200, { user: { id: me.uid, name: me.name }, room: room.id });
    }

    // 마을 목록
    if (parts[0] === 'village') {
      if (!me && !isAdmin(req)) return json(401, { error: 'login required' });
      const idx = (await s.get('index', { type: 'json' })) || { rooms: {} };
      const rooms = Object.entries(idx.rooms).map(([id, r]) => ({ id, name: r.name, count: r.count || 0 })).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
      return json(200, { rooms });
    }

    // 운영진: 슬랙 없이 테스트용 입장 링크 만들기
    if (parts[0] === 'admin' && parts[1] === 'invite' && req.method === 'POST') {
      if (!isAdmin(req)) return json(401, { error: 'unauthorized' });
      const { name } = await req.json().catch(() => ({}));
      const n = sanitizeText(name, 20); if (!n) return json(400, { error: '이름을 입력해 주세요.' });
      const uid = 'guest-' + crypto.createHash('sha256').update(n).digest('hex').slice(0, 10);
      await ensureRoom(s, uid, n);
      return json(200, { link: personalLink(uid, n), room: roomIdOf(uid) });
    }

    if (parts[0] !== 'rooms' || !parts[1]) return json(404, { error: 'not found' });
    const roomId = sanitizeRoom(parts[1]); const action = parts[2]; const admin = isAdmin(req);
    if (!me && !admin) return json(401, { error: '입장 링크가 필요해요. 슬랙에서 /산타 를 입력해 주세요.' });
    const room = await s.get(`rooms/${roomId}`, { type: 'json' });
    if (!room) return json(404, { error: '아직 만들어지지 않은 방이에요.' });

    if (action === 'state' && req.method === 'GET') {
      const all = await listItems(s, roomId);
      const items = all.filter((it) => (admin && url.searchParams.has('admin')) || it.status === 'visible').map((it) => (admin ? it : publicItem(it)));
      return json(200, { room: roomId, settings: { ...DEFAULT_SETTINGS, owner: room.name, ownerId: roomId }, sealed: false, items, serverTime: new Date().toISOString() });
    }

    if (action === 'items' && req.method === 'POST') {
      if (!me) return json(401, { error: 'login required' });
      // 1분에 6개까지
      const rl = (await s.get(`rl/${me.uid}`, { type: 'json' })) || []; const now = Date.now();
      const recent = rl.filter((t) => now - t < 60_000);
      if (recent.length >= 6) return json(429, { error: '잠시 후 다시 시도해 주세요. (1분에 6개까지)' });
      await s.setJSON(`rl/${me.uid}`, [...recent, now]);
      const body = await req.json().catch(() => ({}));
      const { value, error } = validateNewItem({ ...body, author: me.name });
      if (error) return json(400, { error });
      const item = { id: newId(), room: roomId, status: 'visible', ...value, author: value.anonymous ? '' : me.name, authorId: me.uid, createdAt: new Date().toISOString() };
      await s.setJSON(`items/${roomId}/${item.createdAt}_${item.id}`, item);
      const idx = (await s.get('index', { type: 'json' })) || { rooms: {} };
      await touchIndex(s, roomId, { name: room.name, count: (idx.rooms[roomId]?.count || 0) + 1 });
      // 방 주인에게 슬랙 DM (자기 방에 쓴 건 제외, 내용은 비밀로)
      if (roomIdOf(me.uid) !== roomId && !roomId.startsWith('guest-')) {
        const who = item.anonymous ? '익명의 동료' : me.name;
        await slackApi('chat.postMessage', { channel: room.id.toUpperCase(), text: `🎁 ${who}님이 트리 아래에 ${ITEM_TYPES[item.type].label}을(를) 놓고 갔어요! 내 오두막에서 확인해 보세요. /산타` });
      }
      return json(201, { item: publicItem(item) });
    }

    // 운영진
    if (action === 'admin') {
      if (parts[3] === 'login' && req.method === 'POST') return admin ? json(200, { ok: true }) : json(401, { error: '비밀번호가 올바르지 않습니다.' });
      if (!admin) return json(401, { error: 'unauthorized' });
      if (parts[3] === 'items' && parts[4]) {
        const all = await listItems(s, roomId); const it = all.find((x) => x.id === parts[4]);
        if (!it) return json(404, { error: 'not found' });
        const key = `items/${roomId}/${it.createdAt}_${it.id}`;
        if (req.method === 'PATCH') {
          const { status } = await req.json().catch(() => ({}));
          if (!ITEM_STATUS.includes(status)) return json(400, { error: 'bad status' });
          await s.setJSON(key, { ...it, status });
        } else if (req.method === 'DELETE') await s.delete(key);
        const items = await listItems(s, roomId);
        await touchIndex(s, roomId, { name: room.name, count: items.filter((x) => x.status === 'visible').length });
        return json(200, { room: roomId, settings: { ...DEFAULT_SETTINGS, owner: room.name }, sealed: false, items });
      }
      if (parts[3] === 'settings') return json(200, { room: roomId, settings: { ...DEFAULT_SETTINGS, owner: room.name }, sealed: false, items: await listItems(s, roomId) });
    }
    return json(404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return json(500, { error: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' });
  }
};

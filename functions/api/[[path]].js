// 우리의 소원트리 - Cloudflare Pages Functions API (모든 /api/* 요청)
// 저장소: Cloudflare D1 (SQLite). 바인딩 이름: DB  — 표는 첫 요청 때 자동으로 만들어져요.
//
// 환경 변수 (Pages 프로젝트 > Settings > Variables and Secrets)
//   TOKEN_SECRET          입장 링크 서명용 비밀값 (필수, 아무 긴 문자열)
//   ADMIN_PASSWORD        운영진 비밀번호 (필수)
//   PUBLIC_URL            사이트 주소 (예: https://wishtree.pages.dev)
//   SLACK_SIGNING_SECRET  슬랙 앱 Signing Secret (/santa 커맨드 검증)
//   SLACK_BOT_TOKEN       슬랙 봇 토큰 xoxb-… (멤버 목록으로 방 만들기, 이름 조회, 선물 도착 DM)
import { validateNewItem, sanitizeRoom, sanitizeText, ITEM_STATUS, ITEM_TYPES, DEFAULT_SETTINGS, isClosed } from '../../public/js/data/catalog.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const enc = new TextEncoder();
const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
const newId = () => Date.now().toString(36) + b64u(crypto.getRandomValues(new Uint8Array(6))).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
const roomIdOf = (uid) => sanitizeRoom(String(uid).toLowerCase());

async function hmac(secret, data, hex = false) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return hex ? [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('') : b64u(sig);
}
function safeEqual(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

// ── 입장 토큰 { uid, name, exp } ──
async function signToken(env, payload) { const body = b64u(enc.encode(JSON.stringify(payload))); return `${body}.${await hmac(env.TOKEN_SECRET, body)}`; }
async function readToken(env, req) {
  const h = req.headers.get('authorization') || ''; const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t || !env.TOKEN_SECRET) return null;
  const [body, sig] = t.split('.'); if (!body || !sig) return null;
  if (!safeEqual(await hmac(env.TOKEN_SECRET, body), sig)) return null;
  try { const p = JSON.parse(fromB64u(body)); return p.exp > Date.now() ? p : null; } catch { return null; }
}
async function personalLink(env, uid, name, room) {
  const token = await signToken(env, { uid, name, exp: Date.now() + 1000 * 60 * 60 * 24 * 60 });
  const base = (env.PUBLIC_URL || '').replace(/\/$/, '');
  return `${base}/?t=${token}${room ? `&room=${encodeURIComponent(room)}` : ''}`;
}
const isAdmin = (env, req) => !!env.ADMIN_PASSWORD && safeEqual(req.headers.get('x-admin-password') || '', env.ADMIN_PASSWORD);

// ── D1 ──
let ready = false;
async function migrate(db) {
  if (ready) return;
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, slack_id TEXT, created_at TEXT NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, room TEXT NOT NULL, type TEXT NOT NULL, zone TEXT, message TEXT NOT NULL, author TEXT, anonymous INTEGER DEFAULT 0, author_id TEXT, status TEXT DEFAULT \'visible\', created_at TEXT NOT NULL)'),
    db.prepare('CREATE INDEX IF NOT EXISTS items_room ON items(room, created_at)'),
    db.prepare('CREATE INDEX IF NOT EXISTS items_author ON items(author_id, created_at)'),
  ]);
  ready = true;
}
async function upsertRoom(db, slackId, name) {
  const id = roomIdOf(slackId); const n = sanitizeText(name, 20) || '동료';
  await db.prepare('INSERT INTO rooms (id, name, slack_id, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET name = excluded.name')
    .bind(id, n, slackId, new Date().toISOString()).run();
  return { id, name: n };
}
const rowToItem = (r, admin) => {
  const it = { id: r.id, room: r.room, type: r.type, zone: r.zone, message: r.message, author: r.anonymous ? '' : r.author, anonymous: !!r.anonymous, status: r.status, createdAt: r.created_at };
  if (!r.anonymous && r.author_id) it.authorRoom = roomIdOf(r.author_id); // 답례하러 가기 버튼용
  if (admin) { it.authorId = r.author_id; it.realAuthor = r.author; }
  return it;
};

// ── 슬랙 ──
async function verifySlack(env, raw, req) {
  if (!env.SLACK_SIGNING_SECRET) return false;
  const ts = req.headers.get('x-slack-request-timestamp'), sig = req.headers.get('x-slack-signature') || '';
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  return safeEqual('v0=' + (await hmac(env.SLACK_SIGNING_SECRET, `v0:${ts}:${raw}`, true)), sig);
}
async function slack(env, method, body, get = false) {
  if (!env.SLACK_BOT_TOKEN) return null;
  try {
    const r = get
      ? await fetch(`https://slack.com/api/${method}?${new URLSearchParams(body)}`, { headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}` } })
      : await fetch(`https://slack.com/api/${method}`, { method: 'POST', headers: { Authorization: `Bearer ${env.SLACK_BOT_TOKEN}`, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(body) });
    return await r.json();
  } catch { return null; }
}
const displayName = (u, fb) => sanitizeText(u?.profile?.display_name || u?.profile?.real_name || u?.real_name || u?.name || fb, 20) || fb;
async function slackName(env, uid, fb) { const r = await slack(env, 'users.info', { user: uid }, true); return displayName(r?.user, fb); }

export async function onRequest({ request: req, env }) {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  if (!env.DB) return json(500, { error: '데이터베이스(D1)가 연결되지 않았어요. 설정 가이드 3단계를 확인해 주세요.' });
  const db = env.DB;
  try {
    await migrate(db);
    if (parts[0] === 'health') return json(200, { ok: true, mode: 'server', auth: 'token' });

    // 슬랙 /santa  → 내 오두막 링크,  /santa @동료 → 동료 오두막으로 가는 링크 (본인에게만 보임)
    if (parts[0] === 'slack' && parts[1] === 'command' && req.method === 'POST') {
      const raw = await req.text();
      if (!(await verifySlack(env, raw, req))) return json(401, { error: 'invalid signature' });
      const f = Object.fromEntries(new URLSearchParams(raw));
      const myName = await slackName(env, f.user_id, f.user_name || '동료');
      await upsertRoom(db, f.user_id, myName);
      const m = (f.text || '').match(/<@([A-Z0-9]+)(?:\|([^>]+))?>/);
      if (m) {
        const target = await db.prepare('SELECT id, name FROM rooms WHERE id = ?1').bind(roomIdOf(m[1])).first()
          || await upsertRoom(db, m[1], await slackName(env, m[1], m[2] || '동료'));
        const link = await personalLink(env, f.user_id, myName, target.id);
        return json(200, { response_type: 'ephemeral', text: `🎄 ${target.name}님의 오두막으로 가는 링크예요: ${link}`,
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `*${target.name}님의 오두막*으로 가는 문이에요 🚪\n트리 아래에 마음을 담은 선물을 놓고 와 주세요.` } },
            { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: `🎁 ${target.name}님 오두막 놀러 가기` }, url: link, style: 'primary' }] }] });
      }
      const link = await personalLink(env, f.user_id, myName);
      return json(200, { response_type: 'ephemeral', text: `🎄 ${myName}님의 오두막 입장 링크예요: ${link}`,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `*${myName}님의 오두막이 준비됐어요 🎄*\n벽난로 옆 트리 아래에 동료들의 선물이 쌓여요. 🏘️ 마을에서 동료의 오두막도 찾아가 보세요.\n_이 링크는 본인 전용이에요. 다른 사람에게 공유하지 마세요._\n동료 방으로 바로 가려면 \`/santa @동료이름\`\n🎁 선물 놓기는 *12월 24일 23:59*까지예요.` } },
          { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '🏠 내 오두막 들어가기' }, url: link, style: 'primary' }] }] });
    }

    const me = await readToken(env, req); const admin = isAdmin(env, req);

    if (parts[0] === 'me') {
      if (!me) return json(401, { error: '입장 링크가 필요해요. 슬랙에서 /santa 를 입력해 주세요.' });
      const exists = await db.prepare('SELECT id, name FROM rooms WHERE id = ?1').bind(roomIdOf(me.uid)).first();
      const room = exists || await upsertRoom(db, me.uid, me.name);
      return json(200, { user: { id: me.uid, name: me.name }, room: room.id });
    }

    if (parts[0] === 'village') {
      if (!me && !admin) return json(401, { error: 'login required' });
      const { results } = await db.prepare("SELECT r.id, r.name, (SELECT COUNT(*) FROM items i WHERE i.room = r.id AND i.status = 'visible') AS count FROM rooms r").all();
      const total = results.reduce((a, r) => a + r.count, 0);
      return json(200, { rooms: results.sort((a, b) => a.name.localeCompare(b.name, 'ko')), total });
    }

    // ── 운영진 전역 기능 ──
    if (parts[0] === 'admin') {
      if (!admin) return json(401, { error: '비밀번호가 올바르지 않습니다.' });
      // 슬랙 멤버 전원의 오두막 만들기 (봇·게스트·탈퇴자 제외)
      if (parts[1] === 'sync-slack' && req.method === 'POST') {
        if (!env.SLACK_BOT_TOKEN) return json(400, { error: 'SLACK_BOT_TOKEN 환경 변수가 필요해요.' });
        let cursor = ''; let made = 0; const stmts = [];
        do {
          const r = await slack(env, 'users.list', { limit: '200', ...(cursor ? { cursor } : {}) }, true);
          if (!r?.ok) return json(502, { error: `슬랙 멤버 목록을 가져오지 못했어요 (${r?.error || '연결 실패'}). 봇에 users:read 권한이 있는지 확인해 주세요.` });
          for (const u of r.members) {
            if (u.deleted || u.is_bot || u.id === 'USLACKBOT' || u.is_restricted || u.is_ultra_restricted) continue;
            stmts.push(db.prepare('INSERT INTO rooms (id, name, slack_id, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET name = excluded.name')
              .bind(roomIdOf(u.id), displayName(u, '동료'), u.id, new Date().toISOString()));
            made++;
          }
          cursor = r.response_metadata?.next_cursor || '';
        } while (cursor);
        for (let i = 0; i < stmts.length; i += 50) await db.batch(stmts.slice(i, i + 50));
        return json(200, { ok: true, rooms: made });
      }
      // 슬랙 없이 테스트용 입장 링크
      if (parts[1] === 'invite' && req.method === 'POST') {
        const { name } = await req.json().catch(() => ({}));
        const n = sanitizeText(name, 20); if (!n) return json(400, { error: '이름을 입력해 주세요.' });
        const uid = 'guest-' + (await hmac('guest', n, true)).slice(0, 10);
        const room = await upsertRoom(db, uid, n);
        return json(200, { link: await personalLink(env, uid, n), room: room.id });
      }
      if (parts[1] === 'login') return json(200, { ok: true });
    }

    if (parts[0] !== 'rooms' || !parts[1]) return json(404, { error: 'not found' });
    const roomId = sanitizeRoom(parts[1]); const action = parts[2];
    if (!me && !admin) return json(401, { error: '입장 링크가 필요해요. 슬랙에서 /santa 를 입력해 주세요.' });
    const room = await db.prepare('SELECT id, name, slack_id FROM rooms WHERE id = ?1').bind(roomId).first();
    if (!room) return json(404, { error: '아직 만들어지지 않은 오두막이에요.' });
    const stateOf = async (withHidden) => {
      const q = withHidden ? 'SELECT * FROM items WHERE room = ?1 ORDER BY created_at' : "SELECT * FROM items WHERE room = ?1 AND status = 'visible' ORDER BY created_at";
      const { results } = await db.prepare(q).bind(roomId).all();
      return { room: roomId, settings: { ...DEFAULT_SETTINGS, owner: room.name, ownerId: roomId }, sealed: false, items: results.map((r) => rowToItem(r, admin)), serverTime: new Date().toISOString() };
    };

    if (action === 'state' && req.method === 'GET') return json(200, await stateOf(admin && url.searchParams.has('admin')));

    if (action === 'items' && req.method === 'POST') {
      if (!me) return json(401, { error: 'login required' });
      if (isClosed()) return json(403, { error: '선물 놓기는 12월 24일 23:59에 마감됐어요. 받은 메시지는 계속 읽을 수 있어요 🎄' });
      const since = new Date(Date.now() - 60_000).toISOString();
      const { n } = await db.prepare('SELECT COUNT(*) AS n FROM items WHERE author_id = ?1 AND created_at > ?2').bind(me.uid, since).first();
      if (n >= 6) return json(429, { error: '잠시 후 다시 시도해 주세요. (1분에 6개까지)' });
      const body = await req.json().catch(() => ({}));
      const { value, error } = validateNewItem({ ...body, author: me.name });
      if (error) return json(400, { error });
      const row = { id: newId(), room: roomId, type: value.type, zone: value.zone, message: value.message, author: me.name, anonymous: value.anonymous ? 1 : 0, author_id: me.uid, status: 'visible', created_at: new Date().toISOString() };
      await db.prepare('INSERT INTO items (id, room, type, zone, message, author, anonymous, author_id, status, created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)')
        .bind(row.id, row.room, row.type, row.zone, row.message, row.author, row.anonymous, row.author_id, row.status, row.created_at).run();
      // 방 주인에게 슬랙 DM (자기 방 제외, 내용은 비밀) + 본인 전용 입장 버튼
      if (room.slack_id && !room.slack_id.startsWith('guest-') && roomIdOf(me.uid) !== roomId) {
        const who = row.anonymous ? '익명의 동료가' : `${me.name}님이`;
        const link = await personalLink(env, room.slack_id, room.name);
        await slack(env, 'chat.postMessage', { channel: room.slack_id, text: `🎁 ${who} 트리 아래에 선물을 놓고 갔어요!`,
          blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `🎁 *${who}* 내 오두막 트리 아래에 *${ITEM_TYPES[row.type].label}*을(를) 놓고 갔어요!` } },
            { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: '🏠 내 오두막에서 열어 보기' }, url: link }] }] });
      }
      return json(201, { item: rowToItem(row, false) });
    }

    if (action === 'admin') {
      if (parts[3] === 'login' && req.method === 'POST') return admin ? json(200, { ok: true }) : json(401, { error: '비밀번호가 올바르지 않습니다.' });
      if (!admin) return json(401, { error: 'unauthorized' });
      if (parts[3] === 'items' && parts[4]) {
        if (req.method === 'PATCH') {
          const { status } = await req.json().catch(() => ({}));
          if (!ITEM_STATUS.includes(status)) return json(400, { error: 'bad status' });
          await db.prepare('UPDATE items SET status = ?1 WHERE id = ?2 AND room = ?3').bind(status, parts[4], roomId).run();
        } else if (req.method === 'DELETE') await db.prepare('DELETE FROM items WHERE id = ?1 AND room = ?2').bind(parts[4], roomId).run();
        return json(200, await stateOf(true));
      }
      if (parts[3] === 'settings') return json(200, await stateOf(true));
    }
    return json(404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    return json(500, { error: '서버 오류가 났어요. 잠시 후 다시 시도해 주세요.' });
  }
}

// 슬랙 연동 모듈
// 1) 슬래시 커맨드 수신: POST /api/slack/command  → 공간 링크를 응답
// 2) 새 장식 알림 발신: SLACK_WEBHOOK_URL(Incoming Webhook)로 POST
import crypto from 'node:crypto';
import { ITEM_TYPES, ZONES } from '../public/js/data/catalog.js';

// Slack 요청 서명 검증 (https://api.slack.com/authentication/verifying-requests-from-slack)
export function verifySlackSignature(rawBody, headers, signingSecret) {
  if (!signingSecret) return true; // 미설정 시 검증 생략(개발용)
  const ts = headers['x-slack-request-timestamp'];
  const sig = headers['x-slack-signature'];
  if (!ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 60 * 5) return false; // 재전송 공격 방지
  const mac = 'v0=' + crypto.createHmac('sha256', signingSecret).update(`v0:${ts}:${rawBody}`).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// 커맨드 이름/인자로 이동할 위치를 결정합니다.
//   /_산사            → 산사 전경
//   /_트리            → 트리 앞
//   /_산사 design팀   → room=design팀
export function buildCommandResponse({ command = '', text = '', user_name = '' }, publicUrl) {
  const args = String(text).trim().split(/\s+/).filter(Boolean);
  const focus = /트리|tree/i.test(command) || args.includes('트리') ? 'tree' : 'temple';
  const roomArg = args.find((a) => a !== '트리' && a !== '산사');
  const params = new URLSearchParams();
  if (roomArg) params.set('room', roomArg);
  if (user_name) params.set('user', user_name);
  params.set('focus', focus);
  params.set('from', 'slack');
  const url = `${publicUrl.replace(/\/$/, '')}/?${params}`;
  const title = focus === 'tree' ? '🎄 트리 앞으로 바로 가기' : '🏯 연말 산사 빌리지 입장하기';
  return {
    response_type: 'in_channel',
    text: `${title}: ${url}`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*연말 산사 빌리지*\n눈 내리는 산사 마당에 소원 편지와 연등을 달아 주세요.` } },
      { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: title }, url, style: 'primary' }] },
    ],
  };
}

// 새 장식이 달렸을 때 보낼 메시지. 봉인 중이면 내용은 감춥니다.
export function buildNewItemMessage(item, { sealed, publicUrl, room }) {
  const type = ITEM_TYPES[item.type];
  const zone = ZONES[item.zone];
  const who = item.anonymous || !item.author ? '익명의 동료' : item.author;
  const body = sealed ? '🔒 (봉인 중인 메시지입니다)' : `> ${item.message.replace(/\n/g, '\n> ')}`;
  const url = `${publicUrl.replace(/\/$/, '')}/?room=${encodeURIComponent(room)}&item=${item.id}`;
  return {
    text: `${type.icon} ${who}님이 ${zone.label}에 ${type.label}을(를) 달았어요`,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `${type.icon} *${who}*님이 *${zone.label}*에 *${type.label}*을(를) 달았어요\n${body}` } },
      { type: 'context', elements: [{ type: 'mrkdwn', text: `<${url}|산사 빌리지에서 보기>` }] },
    ],
  };
}

export async function postWebhook(url, payload) {
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.warn('[webhook] 응답 오류', res.status);
  } catch (e) {
    console.warn('[webhook] 전송 실패', e.message);
  }
}

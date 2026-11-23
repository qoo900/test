// 공용 카탈로그: 브라우저와 서버(server.js)가 같이 import 합니다.

export const LIMITS = { authorMax: 20, messageMax: 140, roomMax: 32 };

// 걸 곳
export const ZONES = {
  tree: { id: 'tree', label: '트리', icon: '🎄' },
  base: { id: 'base', label: '트리 아래', icon: '🎁' },
};

// 장식 종류 (zones[0]이 기본 위치)
export const ITEM_TYPES = {
  letter:   { id: 'letter',   label: '편지',         icon: '💌', kind: 'letter',   zones: ['tree'] },
  red_ball: { id: 'red_ball', label: '빨간 오너먼트', icon: '🔴', kind: 'ball', color: '#c8202f', zones: ['tree'] },
  gold_ball:{ id: 'gold_ball',label: '금빛 오너먼트', icon: '🟡', kind: 'ball', color: '#e0a92a', zones: ['tree'] },
  star:     { id: 'star',     label: '별',           icon: '⭐', kind: 'star',     zones: ['tree'] },
  candy:    { id: 'candy',    label: '지팡이 사탕',   icon: '🍬', kind: 'candy',    zones: ['tree'] },
  bell:     { id: 'bell',     label: '징글벨',        icon: '🔔', kind: 'bell',     zones: ['tree'] },
  gift:     { id: 'gift',     label: '선물 상자',     icon: '🎁', kind: 'gift',     zones: ['base'] },
};

export const ITEM_STATUS = ['visible', 'hidden', 'archived'];

export const DEFAULT_SETTINGS = {
  title: '우리의 소원트리',
  owner: '하늘',                 // 이 집(트리)의 주인
  sealEnabled: false,
  sealUntil: '2026-12-25T00:00:00+09:00', // 봉인 해제: 크리스마스
};

export function sanitizeText(s, max) {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, max);
}

export function sanitizeRoom(s) {
  const r = String(s ?? '').toLowerCase().replace(/[^a-z0-9가-힣_-]/g, '').slice(0, LIMITS.roomMax);
  return r || 'main';
}

export function validateNewItem(input) {
  const type = ITEM_TYPES[input?.type];
  if (!type) return { error: '알 수 없는 장식 종류입니다.' };
  const zone = type.zones.includes(input.zone) ? input.zone : type.zones[0];
  const message = sanitizeText(input.message, LIMITS.messageMax);
  if (!message) return { error: '메시지를 입력해 주세요.' };
  const anonymous = !!input.anonymous;
  const author = anonymous ? '' : sanitizeText(input.author, LIMITS.authorMax);
  return { value: { type: type.id, zone, message, author, anonymous } };
}

export function isSealed(settings, now = Date.now()) {
  if (!settings?.sealEnabled) return false;
  const t = Date.parse(settings.sealUntil);
  return Number.isFinite(t) ? now < t : false;
}

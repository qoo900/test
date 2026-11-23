// 공용 카탈로그: 브라우저와 서버(server.js)가 같이 import 합니다.
// 아이템 종류 / 배치 구역 / 캐릭터 옵션 / 입력 제한을 한 곳에서 관리합니다.

export const LIMITS = {
  authorMax: 20,
  messageMax: 120,
  roomMax: 32,
};

// 배치 구역(zone)
export const ZONES = {
  tree:   { id: 'tree',   label: '크리스마스 트리', icon: '🎄', desc: '마당 한가운데 트리에 걸어요' },
  base:   { id: 'base',   label: '트리 아래',       icon: '🎁', desc: '트리 밑동에 놓아요' },
  eave:   { id: 'eave',   label: '대웅전 처마',     icon: '🏯', desc: '전각 처마 끝에 매달아요' },
  string: { id: 'string', label: '마당 연등줄',     icon: '🏮', desc: '트리에서 뻗은 연등줄에 달아요' },
  board:  { id: 'board',  label: '소원 팻말 걸이대', icon: '🪧', desc: '마당 서쪽 걸이대에 걸어요' },
};

// 아이템 종류(type). zones[0]이 기본 구역입니다.
export const ITEM_TYPES = {
  santa_lantern: { id: 'santa_lantern', label: '산타 연등',     icon: '🎅', kind: 'lantern', color: '#d8312f', zones: ['string', 'eave'] },
  gold_lantern:  { id: 'gold_lantern',  label: '황금 연등',     icon: '🏮', kind: 'lantern', color: '#f2b233', zones: ['eave', 'string'] },
  lotus_lantern: { id: 'lotus_lantern', label: '연꽃 연등',     icon: '🪷', kind: 'lantern', color: '#f08bb0', zones: ['string', 'eave'] },
  ornament:      { id: 'ornament',      label: '트리 오너먼트', icon: '🔴', kind: 'ornament', color: '#c62d3a', zones: ['tree'] },
  star:          { id: 'star',          label: '별 장식',       icon: '⭐', kind: 'star', color: '#ffd45a', zones: ['tree'] },
  letter:        { id: 'letter',        label: '소원 편지',     icon: '💌', kind: 'letter', color: '#f6ead2', zones: ['tree', 'board'] },
  gift:          { id: 'gift',          label: '선물 상자',     icon: '🎁', kind: 'gift', color: '#2f7d5b', zones: ['base'] },
  sign_off:      { id: 'sign_off',      label: '칼퇴 팻말',     icon: '🏃', kind: 'sign', color: '#b98552', zones: ['board'], plate: '칼퇴' },
  sign_wish:     { id: 'sign_wish',     label: '소원 팻말',     icon: '🙏', kind: 'sign', color: '#c99a62', zones: ['board'], plate: '소원' },
};

export const ITEM_STATUS = ['visible', 'hidden', 'archived'];

// 캐릭터 커스터마이징 옵션
export const AVATAR_OPTIONS = {
  body: [
    { id: 'monk',    label: '동자승' },
    { id: 'snowman', label: '눈사람' },
    { id: 'bear',    label: '곰' },
    { id: 'rabbit',  label: '토끼' },
  ],
  color: ['#c0392b', '#e67e22', '#f1c40f', '#27ae60', '#16a085', '#2e86de', '#8e44ad', '#7f8c8d', '#f5f0e6', '#4a3b32'],
  hat: [
    { id: 'santa',  label: '산타 모자' },
    { id: 'beanie', label: '털모자' },
    { id: 'gat',    label: '삿갓' },
    { id: 'antler', label: '사슴뿔' },
    { id: 'none',   label: '없음' },
  ],
};

export const DEFAULT_SETTINGS = {
  title: '연말 산사 빌리지',
  sealEnabled: false,
  // 봉인 해제 시각(ISO). 기본: 올해 12월 31일 18:00 KST
  sealUntil: '2026-12-31T18:00:00+09:00',
};

// 입력값 정규화/검증 (서버·로컬 공용)
export function sanitizeText(s, max) {
  return String(s ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+\n/g, '\n')
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

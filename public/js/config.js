// URL 쿼리 파라미터 & 런타임 설정
//   ?room=design      방(데이터 공간) 분리. 슬랙 채널/팀별로 다른 마을을 만들 때 사용
//   ?user=홍길동      입장 화면 이름 자동 입력 (슬랙 커맨드가 채워 줌)
//   ?focus=tree       입장 직후 카메라 위치: tree | temple
//   ?item=<id>        입장 직후 해당 장식으로 이동해 카드 열기 (슬랙 알림 링크)
//   ?api=https://...  API 서버 주소를 별도로 지정할 때 (기본: 같은 출처)
//   ?local=1          서버 없이 브라우저 localStorage 모드로 강제 실행
import { sanitizeRoom, sanitizeText, LIMITS } from './data/catalog.js';

const q = new URLSearchParams(location.search);

export const CONFIG = {
  room: sanitizeRoom(q.get('room') || 'main'),
  user: sanitizeText(q.get('user') || '', LIMITS.authorMax),
  focus: q.get('focus') === 'tree' ? 'tree' : q.get('focus') === 'temple' ? 'temple' : null,
  itemId: q.get('item') || null,
  from: q.get('from') || null,
  apiBase: (q.get('api') || '').replace(/\/$/, ''),
  forceLocal: q.get('local') === '1',
  isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  pollItemsMs: 8000,
  presenceMs: 1500,
};

// 공간 레이아웃 상수 (단위: m)
export const WORLD = {
  yardHalf: 16,          // 마당 반경(정사각형 반 변)
  hallZ: -19,            // 대웅전 중심 z
  hallW: 15, hallD: 8,   // 대웅전 몸체 폭/깊이
  platformH: 1.2,        // 기단 높이
  spawn: { x: 0, z: 11 },
};

// URL 쿼리 파라미터
//   ?room=haneul     집(트리) 구분. 사람마다 자기 집 링크를 가짐
//   ?user=홍길동     작성자 이름 자동 입력 (슬랙 커맨드가 채워 줌)
//   ?item=<id>       열자마자 해당 메시지 카드 열기 (알림 링크)
//   ?api=https://... API 서버를 별도로 둘 때
//   ?local=1         서버 없이 localStorage 모드
import { sanitizeRoom, sanitizeText, LIMITS } from './data/catalog.js';

const q = new URLSearchParams(location.search);

export const CONFIG = {
  room: sanitizeRoom(q.get('room') || 'main'),
  user: sanitizeText(q.get('user') || '', LIMITS.authorMax),
  itemId: q.get('item') || null,
  apiBase: (q.get('api') || '').replace(/\/$/, ''),
  forceLocal: q.get('local') === '1',
  isTouch: matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window,
  pollItemsMs: 10000,
};

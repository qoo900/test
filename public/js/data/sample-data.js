// 첫 화면부터 공간이 살아 있도록 넣어 두는 샘플 소원/연등 데이터입니다.
// 서버는 방(room)이 처음 만들어질 때, 로컬 모드는 localStorage가 비어 있을 때 이 데이터를 씁니다.
// 이름은 모두 가상의 예시입니다.

const base = Date.parse('2026-11-20T09:00:00+09:00');
const t = (h) => new Date(base + h * 3600_000).toISOString();

export const SAMPLE_ITEMS = [
  { type: 'santa_lantern', zone: 'string', author: '김하늘', message: '올 한 해 다들 정말 고생 많으셨어요. 내년엔 야근 없는 팀이 되길! 🎅', createdAt: t(1) },
  { type: 'gold_lantern',  zone: 'eave',   author: '박서준', message: '우리 팀 프로젝트 무사히 오픈! 내년에도 건강하게 같이 가요.', createdAt: t(2) },
  { type: 'ornament',      zone: 'tree',   author: '이도윤', message: '옆자리 동료분께: 매일 커피 챙겨줘서 고마워요 ☕', createdAt: t(3) },
  { type: 'letter',        zone: 'tree',   author: '',       anonymous: true, message: '말은 못 했지만, 힘들 때 먼저 말 걸어준 분 덕분에 버텼어요. 고맙습니다.', createdAt: t(4) },
  { type: 'sign_off',      zone: 'board',  author: '정민지', message: '내년 목표: 주 3회 칼퇴. 할 수 있다!', createdAt: t(5) },
  { type: 'lotus_lantern', zone: 'string', author: '최우진', message: '가족 모두 건강하고, 마음 편한 한 해 되기를 🙏', createdAt: t(6) },
  { type: 'star',          zone: 'tree',   author: '한지우', message: '신입으로 들어와서 많이 배운 한 해였습니다. 내년엔 더 반짝일게요 ⭐', createdAt: t(7) },
  { type: 'gift',          zone: 'base',   author: '오세훈', message: '송년회 경품은 제가 꼭 받겠습니다 🎁', createdAt: t(8) },
  { type: 'sign_wish',     zone: 'board',  author: '윤아름', message: '회의는 짧게, 점심은 길게! 모두의 소원을 담아 🙏', createdAt: t(9) },
  { type: 'gold_lantern',  zone: 'string', author: '강태오', message: '디자인팀 덕분에 결과물이 훨씬 빛났어요. 늘 감사합니다!', createdAt: t(10) },
  { type: 'ornament',      zone: 'tree',   author: '',       anonymous: true, message: '내년엔 운동 꾸준히 하기… 진짜로요.', createdAt: t(11) },
  { type: 'santa_lantern', zone: 'eave',   author: '서지안', message: '산사에서 맞는 연말이라니 마음이 차분해지네요. 메리 크리스마스!', createdAt: t(12) },
  { type: 'letter',        zone: 'board',  author: '임채원', message: '팀장님, 올해 저희 많이 믿어주셔서 감사했습니다 💌', createdAt: t(13) },
  { type: 'lotus_lantern', zone: 'eave',   author: '배준호', message: '새해에는 모두 하는 일마다 연꽃처럼 활짝 피어나길.', createdAt: t(14) },
  { type: 'sign_off',      zone: 'board',  author: '',       anonymous: true, message: '금요일만큼은 6시 정각에 노트북 덮겠습니다.', createdAt: t(15) },
  { type: 'ornament',      zone: 'tree',   author: '조은비', message: '사내 동호회 덕분에 회사 오는 게 즐거웠어요. 내년에도 함께해요!', createdAt: t(16) },
  { type: 'gift',          zone: 'base',   author: '신동현', message: '모두에게 따뜻한 연말 선물이 도착하길 바라며.', createdAt: t(17) },
  { type: 'star',          zone: 'tree',   author: '문가영', message: '고객 만족도 1등 팀! 우리 모두 스타입니다 ✨', createdAt: t(18) },
  { type: 'santa_lantern', zone: 'string', author: '류시우', message: '내년엔 연봉도, 웃음도 두 배로! 🎄', createdAt: t(19) },
  { type: 'letter',        zone: 'tree',   author: '홍예린', message: '육아휴직 끝나고 복귀했을 때 따뜻하게 맞아줘서 고마웠어요.', createdAt: t(20) },
];

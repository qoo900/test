// 샘플 집(주인: 하늘)의 트리에 동료들이 남긴 롤링페이퍼. 이름은 모두 가상의 예시입니다.
const base = Date.parse('2026-11-20T09:00:00+09:00');
const t = (h) => new Date(base + h * 3600_000).toISOString();

// 처음에는 빈 트리로 시작합니다. 데모가 필요하면 SAMPLE_ITEMS = DEMO_ITEMS 로 바꾸세요.
export const DEMO_ITEMS = [
  { type: 'letter',    author: '박서준', message: '하늘님, 올 한 해 옆자리에서 든든했어요. 내년에도 잘 부탁해요! 🎄', createdAt: t(1) },
  { type: 'red_ball',  author: '이도윤', message: '매일 아침 커피 챙겨줘서 고마워요 ☕', createdAt: t(2) },
  { type: 'star',      author: '한지우', message: '신입 때 하나하나 알려주신 거 잊지 않을게요. 당신은 우리 팀의 별 ⭐', createdAt: t(3) },
  { type: 'letter',    author: '', anonymous: true, message: '힘들 때 먼저 말 걸어줘서 정말 고마웠어요. Merry Christmas!', createdAt: t(4) },
  { type: 'gold_ball', author: '정민지', message: '프로젝트 오픈 고생 많았어요! 따뜻한 연말 보내세요 ✨', createdAt: t(5) },
  { type: 'candy',     author: '최우진', message: '간식 서랍 공유해줘서 감사합니다 🍬 내년에도 달달하게!', createdAt: t(6) },
  { type: 'gift',      author: '오세훈', message: '선물은 송년회 때 직접 드릴게요 🎁', createdAt: t(7) },
  { type: 'bell',      author: '윤아름', message: '회의 때마다 분위기 띄워줘서 고마워요. 징글벨~ 🔔', createdAt: t(8) },
  { type: 'letter',    author: '강태오', message: '같이 야근하던 밤들도 이제 추억이네요. 새해 복 많이 받아요!', createdAt: t(9) },
  { type: 'red_ball',  author: '서지안', message: 'Happy Holidays! 내년엔 같이 여행 가요 ✈️', createdAt: t(10) },
  { type: 'gold_ball', author: '', anonymous: true, message: '늘 웃는 얼굴 보기 좋아요. 건강하세요!', createdAt: t(11) },
  { type: 'letter',    author: '임채원', message: '하늘님 덕분에 회사 오는 게 즐거웠어요 💌', createdAt: t(12) },
  { type: 'red_ball',  author: '배준호', message: '하늘님 추천 맛집 덕분에 점심이 행복했어요 🍜', createdAt: t(13) },
  { type: 'red_ball',  author: '조은비', message: '동호회에서 같이 뛰어줘서 고마워요. 내년엔 하프 마라톤!', createdAt: t(14) },
  { type: 'gold_ball', author: '신동현', message: '언제나 침착하게 정리해 주는 모습 존경합니다.', createdAt: t(15) },
  { type: 'red_ball',  author: '문가영', message: 'Merry Christmas & Happy New Year! 🎅', createdAt: t(16) },
  { type: 'letter',    author: '류시우', message: '처음 입사했을 때 점심 같이 먹자고 해준 거 아직 기억해요. 고마워요!', createdAt: t(17) },
  { type: 'red_ball',  author: '', anonymous: true, message: '올해 제일 많이 웃게 해준 사람 🥰', createdAt: t(18) },
  { type: 'star',      author: '홍예린', message: '하늘님은 우리 팀의 북극성 ⭐', createdAt: t(19) },
  { type: 'red_ball',  author: '김도아', message: '내년에도 같은 팀이었으면 좋겠어요!', createdAt: t(20) },
  { type: 'gold_ball', author: '장하준', message: '따뜻한 코코아 같은 동료, 고마워요 ☕', createdAt: t(21) },
  { type: 'red_ball',  author: '송유나', message: '새해엔 하고 싶은 일 다 이루길 바라요 ✨', createdAt: t(22) },
  { type: 'gift',      author: '노태민', message: '마니또 선물은 비밀이에요 🤫🎁', createdAt: t(23) },
];

// 미리보기용 샘플 롤링페이퍼 8개 (이름은 모두 가상의 예시)
export const SAMPLE_ITEMS = [
  { type: 'letter',    author: '박서준', message: '하늘님, 올 한 해 옆자리에서 든든했어요. 내년에도 잘 부탁해요! 🎄', createdAt: t(1) },
  { type: 'red_ball',  author: '이도윤', message: '매일 아침 커피 챙겨줘서 고마워요 ☕', createdAt: t(2) },
  { type: 'star',      author: '한지우', message: '신입 때 하나하나 알려주신 거 잊지 않을게요. 당신은 우리 팀의 별 ⭐', createdAt: t(3) },
  { type: 'letter',    author: '', anonymous: true, message: '힘들 때 먼저 말 걸어줘서 정말 고마웠어요. Merry Christmas!', createdAt: t(4) },
  { type: 'gold_ball', author: '정민지', message: '프로젝트 오픈 고생 많았어요! 따뜻한 연말 보내세요 ✨', createdAt: t(5) },
  { type: 'candy',     author: '최우진', message: '간식 서랍 공유해줘서 감사합니다 🍬 내년에도 달달하게!', createdAt: t(6) },
  { type: 'bell',      author: '윤아름', message: '회의 때마다 분위기 띄워줘서 고마워요. 징글벨~ 🔔', createdAt: t(7) },
  { type: 'gift',      author: '오세훈', message: '송년회 때 직접 선물 드릴게요. 올해도 수고 많으셨어요 🎁', createdAt: t(8) },
];

// 사진 배경 모드 레이아웃 (각 배경 이미지의 원본 픽셀 좌표 기준)
// 배경을 바꾸면 해당 항목의 좌표만 새 이미지에 맞게 고치면 됩니다.
//  - tree.profile: [y, 반폭] 점들. 그 사이는 직선 보간 → 트리 실루엣
//  - avoid: 장식을 올리지 않을 영역 (예: 트리 가운데 "Merry Christmas" 장식, 꼭대기 별)
//  - base: 트리 아래 선물(메시지)을 놓을 타원 영역
//  - glows: 촛불/벽난로/별/조명 위치에 얹는 은은한 깜빡임
// 주소에 ?bg=2 처럼 붙여 배경을 고를 수 있습니다. (기본: 1)
// ⚠️ 현재 이미지들은 모두 임시 레퍼런스(저작권 미확인). 라이선스 이미지로 교체 후 좌표 조정 필요
const PHOTOS = {
  1: {
    src: './assets/tree.jpg',
    w: 1206, h: 1201,
    tree: { cx: 614, yTop: 190, yBottom: 870, profile: [[150, 45], [300, 150], [600, 235], [890, 316]] },
    avoid: [[495, 500, 765, 605], [560, 30, 665, 150]],
    base: { cx: 612, cy: 1112, rx: 300, ry: 40 },
    glows: [
      { x: 610, y: 88, r: 120, color: '255,236,190', kind: 'star' },
      { x: 1090, y: 560, r: 230, color: '255,130,40', kind: 'fire' },
      { x: 980, y: 1022, r: 60, color: '255,190,90', kind: 'candle' },
      { x: 1122, y: 1072, r: 55, color: '255,190,90', kind: 'candle' },
      { x: 1036, y: 1125, r: 45, color: '255,190,90', kind: 'candle' },
      { x: 22, y: 930, r: 50, color: '255,190,90', kind: 'candle' },
    ],
  },
  2: {
    src: './assets/tree2.jpg', // 원본 456px을 2배 확대한 파일. 좌표는 원본(456) 기준
    w: 456, h: 456,
    tree: { cx: 228, yTop: 88, yBottom: 335, profile: [[60, 22], [150, 68], [250, 100], [345, 128]] },
    avoid: [[158, 172, 272, 218], [205, 10, 252, 70]],
    base: { cx: 228, cy: 424, rx: 105, ry: 16 },
    glows: [
      { x: 228, y: 36, r: 48, color: '255,236,190', kind: 'star' },
      { x: 76, y: 78, r: 45, color: '255,200,120', kind: 'candle' },
      { x: 418, y: 265, r: 80, color: '255,130,40', kind: 'fire' },
      { x: 356, y: 400, r: 22, color: '255,190,90', kind: 'candle' },
      { x: 384, y: 418, r: 20, color: '255,190,90', kind: 'candle' },
      { x: 404, y: 436, r: 16, color: '255,190,90', kind: 'candle' },
      { x: 352, y: 22, r: 18, color: '255,170,90', kind: 'candle' },
      { x: 381, y: 22, r: 18, color: '255,170,90', kind: 'candle' },
    ],
  },
};

const bg = new URLSearchParams(location.search).get('bg');
export const PHOTO = { snow: null, ...(PHOTOS[bg] || PHOTOS[1]) };

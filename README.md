# 🎄 우리의 소원트리 (프로토타입)

벽난로가 타오르는 통나무 오두막 거실, 창밖에는 눈이 내리고 거실의 크리스마스 트리에 동료들이 롤링페이퍼(편지·오너먼트)를 걸어 주는 연말 3D 웹입니다.
회원가입 없이 바로 들어가며, `?room=` 값으로 사람마다 자기 집(트리)을 가질 수 있는 구조입니다. 현재는 샘플 집 1채(주인: 하늘)만 있습니다.

## 실행

```bash
node server.js          # Node 18 이상, npm install 불필요
# → http://localhost:8080
```

- 외부 패키지가 없습니다. Three.js(r169)는 `public/vendor/`에 포함되어 CDN이 막힌 사내망에서도 동작합니다.
- 서버 없이 `public/` 폴더만 정적 호스팅(GitHub Pages 등)해도 실행되며, 이때는 **로컬 모드**(브라우저 localStorage, 다른 사람과 공유 안 됨)로 동작합니다.
- `file://`로 직접 열면 브라우저의 ES 모듈 보안 정책 때문에 실행되지 않습니다. 반드시 HTTP로 열어 주세요.

## 환경 변수

| 이름 | 설명 | 기본값 |
|---|---|---|
| `PORT` | 서버 포트 | `8080` |
| `ADMIN_PASSWORD` | 운영진 비밀번호 | `tree2026` (운영 시 반드시 변경) |
| `PUBLIC_URL` | 슬랙 메시지에 넣을 외부 접속 주소 | `http://localhost:PORT` |
| `SLACK_SIGNING_SECRET` | 슬래시 커맨드 요청 서명 검증 | 미설정 시 검증 생략 |
| `SLACK_WEBHOOK_URL` | 새 장식 알림을 보낼 Incoming Webhook | 미설정 시 전송 안 함 |
| `WEBHOOK_URL` | (선택) 범용 JSON 웹훅 `{ event, room, item }` | - |
| `DATA_DIR` | 데이터 저장 폴더 | `./data` |

## 파일 구성

```
server.js / server/store.js / server/slack.js   의존성 없는 Node 서버, JSON 저장소, 슬랙 연동
public/index.html, public/css/style.css
public/js/main.js            진입점
public/js/world/cabin.js     오두막 거실: 통나무 벽, 벽난로·불꽃, 양말, 화환, 창밖 눈, 안락의자, 전구 줄
public/js/world/tree.js      크리스마스 트리
public/js/world/slots.js     트리 위 장식 배치 좌표
public/js/world/decorations.js  장식 메시(편지/오너먼트/별/사탕/벨/선물) 생성·선택
public/js/world/camera.js    실내 고정 카메라(드래그로 살짝 둘러보기, 줌, 탭 선택)
public/js/audio/sound.js     Web Audio 합성: 벽난로 타닥 소리, 효과음
public/js/data/catalog.js    장식 종류·검증 (서버 공유) / sample-data.js 샘플 롤링페이퍼
public/js/net/api.js         서버 모드 / 로컬 모드 데이터 계층
public/js/ui/ui.js, admin.js 입장·작성·카드·모아보기 / 관리 패널
```

## 저사양 기기 대응

그림자 없음, Lambert 재질, 캔버스 텍스처(이미지 파일 없음), 모바일 픽셀 비율 1.25 제한, 눈 파티클은 창밖 좁은 영역에만 90~180개.

## URL 쿼리 파라미터

| 파라미터 | 예시 | 설명 |
|---|---|---|
| `room` | `?room=haneul` | 집(트리) 구분 — 사람마다 자기 집 링크 |
| `user` | `?user=홍길동` | 입장 화면 이름 자동 입력 |
| `item` | `?item=<id>` | 입장 직후 해당 장식으로 이동해 카드 열기 (알림 링크용) |
| `api` | `?api=https://api.example.com` | API 서버를 별도 도메인으로 둘 때 |
| `local` | `?local=1` | 강제로 로컬 모드 실행 |

## REST API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 서버 모드 확인 |
| GET | `/api/rooms/:room/state` | 설정·통계·공개 아이템 (봉인 중이면 본문 제거) |
| POST | `/api/rooms/:room/items` | 장식 추가 `{type, zone, author, anonymous, message}` (IP당 분당 10개) |
| POST | `/api/rooms/:room/admin/login` | 헤더 `X-Admin-Password` |
| PATCH | `/api/rooms/:room/admin/items/:id` | `{status: visible \| hidden \| archived}` |
| DELETE | `/api/rooms/:room/admin/items/:id` | 완전 삭제 |
| PATCH | `/api/rooms/:room/admin/settings` | `{sealEnabled, sealUntil, title, owner}` |
| POST | `/api/slack/command` | 슬랙 슬래시 커맨드 수신 |

아이템 데이터 구조:

```json
{ "id": "...", "room": "main", "type": "letter", "zone": "tree",
  "author": "김하늘", "anonymous": false, "message": "...",
  "status": "visible", "createdAt": "2026-11-20T01:00:00.000Z" }
```

장식 위치는 저장하지 않고, 구역별 작성 순서로 `world/slots.js`가 계산합니다. 모든 사람에게 같은 자리로 보입니다.

## 슬랙 연동

1. Slack 앱의 Slash Command(예: `/tree`) Request URL을 `https://<서버주소>/api/slack/command`로 지정합니다.
2. Signing Secret은 `SLACK_SIGNING_SECRET`, Incoming Webhook URL은 `SLACK_WEBHOOK_URL`에 넣습니다.
3. `/tree haneul`처럼 인자를 주면 해당 사람의 집 링크를 돌려줍니다. 새 메시지가 걸리면 채널로 알림이 갑니다(봉인 중이면 본문 제외).

## 운영 참고

- 데이터는 `data/<room>.json`에 저장됩니다 (300ms 디바운스 후 원자적 저장). 80~100명 규모를 상정했으며, 여러 서버 인스턴스로 확장하려면 `server/store.js`를 DB로 바꾸면 됩니다.
- 운영진 비밀번호는 헤더로 전송되므로 실제 운영은 HTTPS 뒤에서 하세요.
- 로컬 모드의 관리자 비밀번호는 클라이언트 코드에 들어 있어 보안 기능이 아닙니다 (데모용).
- 메시지는 항상 `textContent`로 렌더링되어 HTML이 실행되지 않습니다.

## 사진 배경 모드

`public/assets/tree.jpg`가 있으면 3D 대신 **사진 배경 모드**로 열립니다. 사진 위에 누를 수 있는 장식(SVG)을 올리고, 촛불·벽난로 깜빡임과 트리 반짝임만 가볍게 얹습니다. 저사양 폰에서도 가볍습니다.

- 장식 위치, 트리 실루엣, 깜빡임 위치는 `public/js/photo/layout.js`의 픽셀 좌표로 맞춥니다. 배경을 바꾸면 이 좌표도 함께 고칩니다.
- `public/assets/*.jpg`는 `.gitignore`에 들어 있습니다. 현재 테스트용 사진은 저작권이 확인되지 않아 커밋하지 않았습니다. 라이선스가 있는 이미지로 바꾼 뒤 커밋하세요.
- 이미지가 없으면 코드로 그린 3D 거실 화면으로 자동 전환됩니다.

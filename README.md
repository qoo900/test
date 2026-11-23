# 🏮 연말 산사 빌리지

눈 내리는 산사 마당과 크리스마스 트리가 어우러진 사내 연말 이벤트용 3D 웹 공간입니다.
회원가입 없이 캐릭터를 고르고 입장해 트리·처마·연등줄·소원 팻말 걸이대에 소원 편지와 연등을 걸 수 있습니다.

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
| `ADMIN_PASSWORD` | 운영진 비밀번호 | `sansa2026` (운영 시 반드시 변경) |
| `PUBLIC_URL` | 슬랙 메시지에 넣을 외부 접속 주소 | `http://localhost:PORT` |
| `SLACK_SIGNING_SECRET` | 슬래시 커맨드 요청 서명 검증 | 미설정 시 검증 생략 |
| `SLACK_WEBHOOK_URL` | 새 장식 알림을 보낼 Incoming Webhook | 미설정 시 전송 안 함 |
| `WEBHOOK_URL` | (선택) 범용 JSON 웹훅 `{ event, room, item }` | - |
| `DATA_DIR` | 데이터 저장 폴더 | `./data` |

## 파일 구성

```
server.js                 정적 파일 + REST API (의존성 없음)
server/store.js           방(room)별 JSON 파일 저장소 (DB로 교체 시 이 파일만 수정)
server/slack.js           슬랙 커맨드 응답 / 서명 검증 / 알림 메시지 포맷
public/index.html         화면 골격 (입장, HUD, 모달, 관리자 패널)
public/css/style.css
public/vendor/            three.module.min.js (+ 라이선스)
public/js/
  main.js                 진입점: 씬 구성, 루프, 인터랙션, UI 연결
  config.js               URL 쿼리 파라미터, 공간 레이아웃 상수
  util.js
  data/catalog.js         장식 종류·배치 구역·캐릭터 옵션·검증 (서버와 공유)
  data/sample-data.js     첫 화면용 샘플 소원 20개 (가상의 이름)
  net/api.js              데이터 계층: 서버 모드 / 로컬 모드 동일 인터페이스
  audio/sound.js          Web Audio 합성음: 목탁, 범종(맥놀이), 풍경, 효과음, 바람
  world/environment.js    하늘, 달, 별, 산, 소나무, 눈 파티클, 조명
  world/temple.js         대웅전(처마·단청·창호), 범종각, 석탑, 석등, 담장, 일주문, 목탁, 풍경, 연등줄, 걸이대
  world/tree.js           크리스마스 트리 + 반짝이는 전구
  world/slots.js          구역별 장식 배치 좌표 계산
  world/decorations.js    장식 메시 생성/동기화/선택/하이라이트
  world/avatar.js         캐릭터(동자승/눈사람/곰/토끼 × 색상 × 모자)
  world/controls.js       키보드/마우스/터치 조이스틱 + 3인칭 카메라
  world/npc.js            다른 접속자 표시 + 마당을 거니는 NPC 주민
  world/colliders.js      간단한 충돌 처리
  ui/ui.js                입장 프리뷰, 작성/읽기 카드, 모아보기, 토스트
  ui/admin.js             운영진 패널
```

## URL 쿼리 파라미터

| 파라미터 | 예시 | 설명 |
|---|---|---|
| `room` | `?room=design` | 팀/채널별로 별도의 마을(데이터) 사용 |
| `user` | `?user=홍길동` | 입장 화면 이름 자동 입력 |
| `focus` | `?focus=tree` | 입장 직후 트리 앞에서 시작 (`tree` / `temple`) |
| `item` | `?item=<id>` | 입장 직후 해당 장식으로 이동해 카드 열기 (알림 링크용) |
| `api` | `?api=https://api.example.com` | API 서버를 별도 도메인으로 둘 때 |
| `local` | `?local=1` | 강제로 로컬 모드 실행 |

## REST API

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 서버 모드 확인 |
| GET | `/api/rooms/:room/state` | 설정·통계·공개 아이템 (봉인 중이면 본문 제거) |
| POST | `/api/rooms/:room/items` | 장식 추가 `{type, zone, author, anonymous, message}` (IP당 분당 10개) |
| POST | `/api/rooms/:room/react` | `{type: moktak \| bell \| bow}` 공용 카운터 |
| POST | `/api/rooms/:room/presence` | 내 위치 보고 + 다른 접속자 목록 (메모리, 10초 만료) |
| POST | `/api/rooms/:room/admin/login` | 헤더 `X-Admin-Password` |
| PATCH | `/api/rooms/:room/admin/items/:id` | `{status: visible \| hidden \| archived}` |
| DELETE | `/api/rooms/:room/admin/items/:id` | 완전 삭제 |
| PATCH | `/api/rooms/:room/admin/settings` | `{sealEnabled, sealUntil, title}` |
| POST | `/api/slack/command` | 슬랙 슬래시 커맨드 수신 |

아이템 데이터 구조:

```json
{ "id": "...", "room": "main", "type": "santa_lantern", "zone": "string",
  "author": "김하늘", "anonymous": false, "message": "...",
  "status": "visible", "createdAt": "2026-11-20T01:00:00.000Z" }
```

장식 위치는 저장하지 않고, 구역별 작성 순서로 `world/slots.js`가 계산합니다. 모든 사람에게 같은 자리로 보입니다.

## 슬랙 연동

1. Slack 앱을 만들고 Slash Command의 Request URL을 `https://<서버주소>/api/slack/command`로 지정합니다.
2. 앱의 Signing Secret을 `SLACK_SIGNING_SECRET`에, Incoming Webhook URL을 `SLACK_WEBHOOK_URL`에 넣습니다.
3. 커맨드 이름에 `트리` 또는 `tree`가 포함되면 트리 앞으로, 아니면 산사 전경으로 안내합니다. 인자로 방 이름을 줄 수 있습니다. 예) `/_산사 design`
4. 새 장식이 걸리면 채널로 알림이 갑니다. 봉인 모드 중에는 본문 없이 "봉인 중인 메시지"로 표시됩니다.

> ⚠️ 슬랙 커맨드 이름에 한글을 쓸 수 있는지는 확인하지 못했습니다. 등록이 안 되면 `/sansa`, `/sansa-tree`처럼 영문으로 등록하세요. 서버는 커맨드 이름이 무엇이든 처리합니다.

## 운영 참고

- 데이터는 `data/<room>.json`에 저장됩니다 (300ms 디바운스 후 원자적 저장). 80~100명 규모를 상정한 구조이며, 여러 서버 인스턴스로 확장하려면 `server/store.js`를 DB로 바꾸고 presence를 Redis 등으로 옮겨야 합니다.
- 운영진 비밀번호는 헤더로 전송되므로 실제 운영은 HTTPS 뒤에서 하세요.
- 로컬 모드의 관리자 비밀번호는 클라이언트 코드에 들어 있어 보안 기능이 아닙니다 (데모용).
- 메시지는 항상 `textContent`로 렌더링되어 HTML이 실행되지 않습니다.

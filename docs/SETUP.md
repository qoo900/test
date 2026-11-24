# 오픈 준비 가이드 (Cloudflare Pages + 슬랙)

순서대로 한 번만 하면 됩니다. 그다음부터는 코드를 올릴 때마다 사이트가 자동으로 바뀌어요.
비용: 100명 규모는 Cloudflare 무료 플랜 안에서 운영할 수 있어요 (아래 "무료 한도" 참고).

## 1. GitHub 저장소를 비공개로

구매한 3D 모델(`public/models/room.glb`)을 저장소에 올려야 사이트가 배포돼요. 공개 저장소에 올리면 모델이 누구에게나 공개되므로 먼저 비공개로 바꿉니다.

GitHub 저장소 → Settings → General → 맨 아래 Danger Zone → Change visibility → Make private

## 2. Cloudflare Pages 프로젝트 만들기

1. dash.cloudflare.com 무료 가입
2. Workers & Pages → Create → Pages → Connect to Git → GitHub 연결 → 저장소 선택
3. 빌드 설정
   - Production branch: 배포할 브랜치
   - Framework preset: None
   - Build command: 비워 두기
   - Build output directory: `public`
4. Save and Deploy → 주소가 `https://○○○.pages.dev` 로 생겨요 (화면에 워터마크 없음)

`functions/` 폴더(서버 코드)는 Cloudflare가 자동으로 찾아서 `/api/*` 로 연결해요.

## 3. 메시지 저장소(D1) 연결

1. Storage & Databases → D1 → Create → 이름 `wishtree`
2. Pages 프로젝트 → Settings → Bindings → Add → D1 database
   - Variable name: `DB`
   - D1 database: `wishtree`

표(테이블)는 첫 접속 때 자동으로 만들어져요. 따로 SQL을 실행할 필요 없어요.

## 4. 환경 변수

Pages 프로젝트 → Settings → Variables and Secrets 에 추가 (비밀값은 Type을 Secret으로).

| 이름 | 값 |
|---|---|
| `TOKEN_SECRET` (Secret) | 길고 아무도 모르는 문자열 (비밀번호 생성기로 40자 정도) |
| `ADMIN_PASSWORD` (Secret) | 운영진 비밀번호 |
| `PUBLIC_URL` | 2단계에서 생긴 주소 (예: `https://wishtree.pages.dev`) |
| `SLACK_SIGNING_SECRET` (Secret) | 5단계에서 받는 값 |
| `SLACK_BOT_TOKEN` (Secret) | 5단계에서 받는 `xoxb-…` 값 |

바꾼 뒤에는 Deployments → 최신 배포 → Retry deployment 로 한 번 다시 배포합니다.

## 5. 슬랙: 기존 TM봇에 /santa 추가

회사 서버에서 이미 돌아가는 TM봇을 그대로 씁니다 (이름 변경 없음). 선물 알림 DM도 TM봇 이름으로 가요.

1. api.slack.com/apps → TM봇 → **Socket Mode가 꺼져 있는지 확인**
   - 켜져 있으면 모든 커맨드가 회사 서버로만 가서 `/santa` 를 Cloudflare로 보낼 수 없어요. 이 경우 별도 앱이 필요해요.
2. Slash Commands → Create New Command
   - Command: `/santa`
   - Request URL: `https://○○○.pages.dev/api/slack/command`
   - Short Description: `내 오두막 입장 링크 받기`
   - Usage Hint: `[@동료]`
   - "Escape channels, users, and links sent to your app" 체크
3. 권한(`commands`, `chat:write`, `users:read`)은 TM봇에 이미 있어서 추가·재설치가 필요 없어요.
4. Cloudflare 환경 변수
   - Basic Information → Signing Secret → `SLACK_SIGNING_SECRET`
   - OAuth & Permissions → Bot User OAuth Token(`xoxb-…`) → `SLACK_BOT_TOKEN`
   - User OAuth Token(`xoxp-…`)은 쓰지 않아요.

주의: TM봇 토큰을 재발급(취소·재설치)하면 회사 서버의 TM봇 설정도 같이 바꿔야 해요. TM봇 서버 담당자와 일정을 맞춰서 하세요.

## 6. 100명 오두막 만들기

1. 사이트에 운영진 입장 링크로 들어가기 (처음엔 슬랙에서 `/santa`)
2. ⚙️ 관리 → 운영진 비밀번호 로그인 → "🏘️ 슬랙 멤버로 오두막 만들기"
3. 회사 슬랙 멤버 전원(봇·게스트·퇴사자 제외)의 오두막이 생겨요. 새 입사자가 생기면 다시 누르면 됩니다.

## 사용 방법 (참여자)

| 슬랙에서 | 결과 |
|---|---|
| `/santa` | 내 오두막 입장 링크 (나에게만 보임) |
| `/santa @홍길동` | 홍길동님 오두막으로 가는 링크 (내 이름으로 입장) |

- 사이트 안에서는 🏘️ 마을 버튼이나 현관문으로 동료 오두막을 찾아갈 수 있어요.
- 내 트리에 선물이 놓이면 슬랙 DM이 와요. 받은 카드의 "답례하러 가기" 버튼으로 보낸 사람 오두막에 바로 갈 수 있어요.
- 작성자 이름은 슬랙 이름으로 고정, 익명도 가능 (운영진은 실제 작성자 확인 가능). 1인당 1분에 6개까지.

## 무료 한도 (100명 기준 예상)

아래는 제가 알고 있는 Cloudflare 무료 플랜 기준이에요. 가입할 때 최신 한도를 한 번 확인해 주세요.

| 항목 | 무료 한도 | 100명 예상 사용량 |
|---|---|---|
| 사이트 트래픽 | 무제한 | 3D 모델 약 6MB × 접속 수 |
| 서버 요청 (Functions) | 하루 10만 번 | 접속 중 10초마다 새로고침 → 하루 수천~수만 번 |
| D1 읽기 | 하루 500만 행 | 충분 |
| D1 쓰기 | 하루 10만 행 | 메시지 수천 건 이내 |

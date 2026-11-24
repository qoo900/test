# 오픈 준비 가이드 (Cloudflare Pages + 슬랙 TM봇)

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

## 5. 슬랙: 기존 TM봇 사용 (Socket Mode라서 슬래시 커맨드 없이)

TM봇은 회사 서버에서 Socket Mode로 돌아가고 있어서, 슬래시 커맨드를 추가하면 회사 서버로만 가요.
그래서 `/santa` 대신 **TM봇이 각자에게 입장 링크를 DM으로 보내는 방식**을 써요. 회사 서버 코드는 건드리지 않아요.

필요한 것: TM봇의 Bot User OAuth Token(`xoxb-…`) → Cloudflare 환경 변수 `SLACK_BOT_TOKEN`
- 권한(`chat:write`, `users:read`)은 TM봇에 이미 있어요. 앱 설정 변경·재설치 없음.
- `SLACK_SIGNING_SECRET` 는 이 방식에서는 필요 없어요.
- 토큰을 재발급하면 회사 서버의 TM봇 설정도 같이 바꿔야 해요. 서버 담당자와 일정을 맞추세요.
- DM의 버튼을 누를 때 슬랙이 회사 서버(TM봇)에도 "버튼이 눌렸다"는 신호를 보내요. 대부분 무시되지만, 서버 로그에 낯선 신호가 찍힐 수 있으니 담당자에게 미리 알려 두세요.

## 6. 오두막 만들기 + 입장 링크 보내기

1. 운영진 입장: 처음 한 번은 ⚙️ 관리 → 운영진 비밀번호 → "테스트 입장 링크"로 내 이름 링크를 만들어 들어가요.
2. "🏘️ 슬랙 멤버로 오두막 만들기" → 회사 슬랙 멤버 전원(봇·게스트·퇴사자 제외) 오두막 생성. 표시되는 숫자가 회사 인원과 맞는지 확인하세요.
3. "입장 링크 DM 보내기" → 먼저 내 슬랙 표시 이름으로 **테스트 발송**해서 DM과 버튼을 확인
4. 오픈 날(12/1) "📨 아직 못 받은 모두에게 보내기" → 25명씩 나눠 자동으로 끝까지 보내요. 이미 받은 사람에게는 다시 보내지 않아요.
5. 새 입사자: 2번 → 4번을 다시 누르면 그 사람에게만 가요.

입장 링크는 60일 동안 유효해요. 링크를 잃어버려도 TM봇 DM에서 언제든 다시 누르면 돼요.

## 사용 방법 (참여자)

- 슬랙 TM봇 DM의 "🏠 내 오두막 들어가기" 버튼으로 입장 (본인 전용)
- 🏘️ 마을 버튼이나 현관문으로 동료 오두막을 이름으로 찾아가요.
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

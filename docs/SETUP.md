# 오픈 준비 가이드 (Netlify + 슬랙)

순서대로 한 번만 하면 됩니다. 이후에는 코드를 올릴 때마다 사이트가 자동으로 바뀌어요.

## 1. GitHub 저장소를 비공개로

구매한 3D 모델(`public/models/room.glb`)을 저장소에 올려야 Netlify가 배포할 수 있어요.
저장소가 공개 상태면 모델이 누구에게나 공개되므로 먼저 비공개로 바꿉니다.

GitHub 저장소 → Settings → General → 맨 아래 Danger Zone → Change visibility → Make private

## 2. Netlify 프로젝트에 저장소 연결

1. app.netlify.com → 프로젝트(sweet-kitten-6eef5d) → Project configuration → Build & deploy
2. Link repository → GitHub → 저장소 선택 → 배포할 브랜치 선택
3. 빌드 설정은 `netlify.toml`에 있으니 그대로 둡니다 (publish: `public`, functions: `netlify/functions`)

## 3. 환경 변수

Project configuration → Environment variables 에 추가합니다.

| 이름 | 값 |
|---|---|
| `TOKEN_SECRET` | 길고 아무도 모르는 문자열 (예: 비밀번호 생성기로 40자) |
| `ADMIN_PASSWORD` | 운영진 비밀번호 |
| `PUBLIC_URL` | `https://sweet-kitten-6eef5d.netlify.app` |
| `SLACK_SIGNING_SECRET` | 4단계에서 받는 값 |
| `SLACK_BOT_TOKEN` | 4단계에서 받는 `xoxb-…` 값 (선택: 이름 조회, 선물 도착 DM) |

환경 변수를 바꾼 뒤에는 Deploys → Trigger deploy 로 한 번 다시 배포합니다.

## 4. 슬랙 앱 만들기

1. api.slack.com/apps → Create New App → From an app manifest → 회사 워크스페이스 선택
2. 아래 내용을 붙여 넣고 만들기
3. Basic Information → Signing Secret 값을 `SLACK_SIGNING_SECRET` 에
4. Install App → 워크스페이스에 설치 (관리자 승인이 필요할 수 있음) → Bot User OAuth Token(`xoxb-…`)을 `SLACK_BOT_TOKEN` 에

```yaml
display_information:
  name: 소원트리 산타
  description: 동료의 오두막 트리 아래에 연말 롤링페이퍼 선물을 놓아요
features:
  bot_user:
    display_name: 소원트리 산타
  slash_commands:
    - command: /santa
      url: https://sweet-kitten-6eef5d.netlify.app/api/slack/command
      description: 내 오두막 입장 링크 받기
      should_escape: false
oauth_config:
  scopes:
    bot:
      - commands
      - chat:write
      - users:read
```

커맨드 이름은 `/santa` 로 적어 두었어요. 한글 `/산타` 가 등록되는지는 확인하지 못했으니, 원하시면 manifest에서 바꿔 보고 오류가 나면 `/santa` 를 쓰세요.

## 5. 확인

1. 슬랙에서 `/santa` 입력 → 본인에게만 보이는 입장 링크가 옵니다.
2. 링크를 열면 내 오두막. 🏘️ 버튼으로 마을 목록을 열어 동료 방에 놀러 갈 수 있어요.
3. 슬랙 없이 테스트하려면: ⚙️ 관리 → 운영진 비밀번호로 로그인 → "테스트 입장 링크"에서 이름으로 링크를 만들 수 있어요.

## 동작 방식 요약

- 입장: 슬랙 `/santa` 가 서명된 개인 링크를 줍니다. 링크가 없으면 들어올 수 없어요.
- 방: 슬랙 사용자마다 오두막 하나. 마을 목록에서 모두의 방을 볼 수 있어요.
- 메시지: 방에 들어온 누구나 트리 앞에서 바로 읽을 수 있어요. 작성자 이름은 슬랙 이름으로 고정되고, 익명도 가능해요 (운영진은 실제 작성자를 볼 수 있음).
- 알림: 내 방에 선물이 놓이면 슬랙 DM이 옵니다 (`SLACK_BOT_TOKEN` 이 있을 때).
- 저장: Netlify Blobs (메시지마다 따로 저장해 동시에 써도 덮어쓰지 않음). 1인당 1분에 6개까지.

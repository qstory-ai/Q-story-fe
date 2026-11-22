# develop 중심 개발과 main 체리픽

## 상태

채택

## 맥락

- 지금까지는 작업 브랜치를 main에 바로 머지했다. main은 Vercel Production(demo.qstory.ai.kr)에 자동 배포된다.
- 그래서 확인하지 않은 변경이 바로 운영 웹에 나갔다.
- 2026-11-22에 develop 배포 경로를 만들었다. develop은 Vercel Preview로 빌드되고 dev.qstory.ai.kr에 붙는다. 이 빌드는 개발 서버(dev.api.qstory.ai.kr)를 부른다.

## 결정

- 작업 브랜치는 develop에서 따고 develop으로 PR을 연다.
- develop에 머지하면 dev.qstory.ai.kr에 배포된다. 여기서 확인한다.
- 확인이 끝난 커밋만 main에 체리픽한다. develop을 main에 통째로 머지하지 않는다.
  1. `git switch -c release/<제목> origin/main`
  2. `git cherry-pick -x <develop 커밋>`. `-x`를 붙이면 원래 커밋이 메시지에 남는다.
  3. main으로 PR을 열고 CI를 통과하면 머지한다. demo.qstory.ai.kr에 배포된다.
- 운영 긴급 수정은 main에서 따서 고치고 main에 머지한다. 그다음 같은 커밋을 develop에도 체리픽한다.
- 모든 PR에 docs/adr 기록을 남긴다. 규칙은 docs/adr/README.md.

## 작업 내용

- `docs/adr/README.md`: 기록 규칙. 파일 이름은 날짜로 하고 번호는 쓰지 않는다.
- `docs/adr/_template.md`: 기록 양식. 상태, 맥락, 결정, 작업 내용, 확인 방법, 영향.
- `.github/workflows/adr-check.yml`: PR에 docs/adr 기록이 없거나 필수 항목이 빠지면 실패한다.
- `.github/pull_request_template.md`: PR 본문에 ADR 파일과 확인 내용을 적는 칸.
- `.gitignore`: `*.md` 규칙은 그대로 두고 `docs/` 아래 md와 PR 템플릿만 예외로 올린다.
- Vercel(팀 qstoryai-3733, 프로젝트 q-story-fe)에서 2026-11-22에 한 일
  - Domains: dev.qstory.ai.kr을 develop 브랜치에 연결했다. DNS는 hosting.kr에 CNAME `dev`를 넣었다.
  - Environment Variables: Preview 중 develop 브랜치 전용으로 `QSTORY_API_UPSTREAM_URL`(dev.api), `VITE_QSTORY_STT_STREAM_URL`(wss://dev.api…)을 넣었다.
  - Deployment Protection: Vercel Authentication을 껐다. 팀원이 로그인 없이 dev.qstory.ai.kr을 보게 하려고.

- GitHub 저장소 기본 브랜치를 main에서 develop으로 바꿨다(`gh repo edit --default-branch develop`). 서버는 `.env`의 `GIT_REF`로, Vercel은 프로젝트의 Production Branch(main)로 배포 브랜치를 정한다. 그래서 배포 대상은 바뀌지 않는다.

## 확인 방법

- `git check-ignore`로 docs/adr 파일과 PR 템플릿이 더 이상 무시되지 않는 것을 확인했다. 루트 README.md는 계속 무시된다.
- dev.qstory.ai.kr의 `/api/qstory/v1/stories`가 개발 서버와 같은 `[]`를 돌려줬다. 운영은 HG가 나온다. develop 빌드가 개발 서버를 부르는 것을 이걸로 확인했다.
- 이 PR에서 adr 검사가 이 파일을 찾아 통과하는지 본다.

## 영향

- 이제 develop을 main에 맞춰 되돌리지 않는다. 체리픽하면 main과 develop의 커밋 해시가 달라진다. 내용은 같다.
- 아직 main에 안 간 커밋은 `git cherry -v origin/main origin/develop`으로 본다. `+`는 main에 없는 커밋이고, `-`는 같은 변경이 이미 main에 있는 커밋이다.
- 백엔드 API가 바뀌는 기능은 백엔드 커밋이 main에 먼저 가거나 같이 가야 한다. 웹만 먼저 가면 운영 웹이 없는 API를 부른다.
- Deployment Protection을 끄면서 PR마다 생기는 Preview 주소도 로그인 없이 열린다.
- 태블릿 앱은 `.env.native`로 demo.api를 직접 부른다. develop 확인은 웹(dev.qstory.ai.kr)으로 한다.
- GitHub 기본 브랜치가 develop이라서 새 PR의 base는 develop으로 잡힌다. main으로 가는 체리픽 PR만 base를 main으로 바꾼다.

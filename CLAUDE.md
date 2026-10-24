# Q-story-fe — 에이전트 작업 안내

React 19 + react-native-web(화면은 React Native 컴포넌트, Vite로 웹 빌드) · react-router-dom 6 · TypeScript · Capacitor(iOS·Android).
공개 저장소다: 커밋·PR·주석에 호스팅·지역·환경 변수 값·운영 절차를 쓰지 않는다.

## 확인 명령
- 테스트: `npm test` (node:test + tsx, `*.test.ts`만). 파일 하나: `npx tsx --test <경로>`
- 타입: `npx tsc --noEmit -p .` · 린트: `npx eslint <바꾼 경로>`
- prettier는 쓰지 않는다(설정 없음 - 돌리면 파일 전체가 바뀐다).
- 빌드에 `content:check`가 들어 있다: 이야기 콘텐츠를 바꿨으면 `npm run content:generate` 뒤 커밋.

## 구조 (Feature-Sliced)
`src/app` → `pages` → `widgets` → `features` → `entities` → `shared` 순으로만 import한다.
- 라우트 표: `src/app/App.tsx` (`/demo` = 비로그인 무료 체험, `/stories/:storyId/play` = 로그인 플레이)
- 슬라이스 안: `ui/`(화면), `model/`(훅·상태), `lib/`(순수 함수 + 같은 이름 `.test.ts`), `api/`(서버 호출)

## 어디에 무엇이
| 하는 일 | 위치 |
| --- | --- |
| 이야기 플레이어 | `pages/one-story` - 흐름 `model/use-one-story-runtime.ts`, 그레텔 대화 `model/use-dialogue.ts`, 순수 규칙 `lib/*`(삽화 자르기 `illustration-frame`, 나가기 `exit-destination`, 질문 건너뛰기 `question-skip` 등) |
| 이야기 직후·기록 리포트 | `widgets/session-report`, `pages/report-history` |
| 데모 시작 전 출시 알림 창 | `features/launch-notification-gate` (`/demo`에만, 한 브라우저에서 한 번 - localStorage) |
| 1분 체험 후기 | `features/completion-survey-modal` (선택지 문구는 백엔드 허용 목록과 같아야 함) |
| 로그인·가입·온보딩 | `pages/login`, `pages/signup`, `features/onboarding`, `features/oauth-login`, 공용 화면 `shared/ui/auth-screen.tsx` |
| 서버 호출 | `shared/api/http-request.ts`, 서버리스 프록시 `api/qstory-proxy.mjs`(+`_qstory-proxy-core.mjs`, 허용 경로·CORS는 `shared/api/proxy-*.test.ts`) |
| 통계 | `entities/analytics/model` - 자체 통계 `beta-events.ts`(백엔드로), GA4 `google-analytics.ts`(이벤트별 허용 키 `GA_EVENT_KEYS`) |
| 환경 값 | `shared/config/env.ts` (`VITE_QSTORY_API_URL` 등, 이름은 `env.d.ts`) |
| 디자인 토큰·공용 UI | `shared/ui` - 토큰 `design-tokens.ts`(생성물, `npm run tokens:generate`), `Modal`·`ActionButton`·`TextField` 등. 원칙은 `DESIGN.md`, 제품 설명은 `PRODUCT.md` |
| 이야기 콘텐츠 | `content/stories/<slug>/` + `content/registry.yaml`, 패키지 생성 `scripts/generate-story-package.mjs` |
| 삽화 파이프라인 | `scripts/illustrations/` (`build-jobs` → `generate-higgsfield` → `review-sheet` → `promote`), 기기별 미리보기 `npm run art:devices` |

## 함정
- GA4는 이벤트 값 `source`·`medium`·`campaign`을 유입 경로로 읽는다. 그런 이름은 `google-analytics.ts`의 `GA_PARAM_RENAMES`로 바꿔 보낸다.
- 배포 뒤 예전 화면 조각을 못 받으면 `src/app/stale-chunk-reload.ts`가 한 번 새로 고친다.
- 화면 높이가 낮으면(480 미만) 플레이어가 compact 배치로 바뀐다(`isCompact`) - 카드 배치를 바꿀 때 두 경우 다 본다.
- 화면을 바꾸면 휴대폰(390px)·데스크톱 폭에서 직접 확인한다.

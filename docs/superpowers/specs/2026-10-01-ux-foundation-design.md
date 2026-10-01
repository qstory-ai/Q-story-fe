# UX 정리 0번 — 공통 기반 + 막다른 길 정리

- 날짜: 2026-10-01
- 상위 목표: 베타 전 화면/단계 축소. 기능은 유지하고 화면 병합·단계 축소·메뉴 재배치만 한다. 필요하면 BE도 수정한다.
- 하위 프로젝트 순서: **0 공통 기반(이 문서)** → 1 스토리 플레이어(아이/보호자 화면 분리 제외) → 2 튜터/기관 → 3 보호자 핵심 → 4 마이페이지/결제
- 이 문서의 범위: 1~4가 공유할 용어·내비게이션 규칙을 먼저 고정하고, 사용자가 막히거나 잘못 안내받는 지점만 고친다. 화면 병합·탭 재편·플로우 단축은 1~4에서 한다.

## 성공 기준

1. 메뉴/버튼을 눌렀을 때 아무 안내 없이 다른 곳으로 튕기는 경로가 0개.
2. 금지어 목록(학부모, 부모 리포트, 구독, 원장, 기관 관리자, 라이선스, 비즈니스 이용권, 완주 기록, 부모 확인 대기, 부모 연결 대기, 연결 안 됨, 기관 및 단체)이 UI 문구에 남아 있지 않음 — 주석 제외, 테스트로 강제. "부모" 단독 표기는 1~4에서 화면을 다룰 때 교체.
3. 구독 상태 라벨 맵·탭 강조 판단·홈 경로가 각각 한 곳에서만 정의됨.
4. 기존 테스트(`npm test`, `npm run typecheck`, `npm run lint`) 통과.

## 1. 용어 사전

`src/shared/config/glossary.ts`에 문구 상수로 둔다. 금지어는 이번에 전부 교체하고 `glossary.test.ts`가 재발을 막는다. `roleLabel`도 PARENT 보호자 / DIRECTOR 관리자로 바꾼다.

| 개념 | 표기 | 없앨 표기 |
|---|---|---|
| ClassGroup | 반 | 클래스 |
| Lesson | 수업 | 레슨, 개인 레슨 |
| 보호자(PARENT) | 보호자 | 부모, 학부모 (UI 문구) — "부모 리포트" → "보호자 리포트" |
| PENDING_PARENT | 보호자 연결 대기 | 부모 확인 대기, 연결 대기, 연결 안 됨, 학부모 연결 대기 중, 보호자 연결 대기 중 |
| 결제 상품 | 이용권 | 구독, 라이선스, 비즈니스 이용권 |
| SubscriptionStatus | NONE 이용권 없음 / TRIALING 체험 중 / ACTIVE 이용 중 / EXPIRED 만료됨 | 구독 없음, 구독 전, 체험 이용 중, 체험판 이용 중, 구독 중, 구독 만료, 구독이 만료됐어요 |
| 완주 기록(목록·상세) | 리포트 (예: 작품별 리포트) | 완주 기록, 세션, 기록, 완료한 이야기 — "완주"는 아이 축하 화면에만 |
| 학원·유치원 등 | 기관 | 기관 및 단체, 단체 |
| DIRECTOR | 관리자 | 기관 관리자, 원장 |

- 상태 라벨 맵 3벌(`MyPageSubscriptionPage.tsx:8-13`, `OrganizationSubscriptionPage.tsx:15-17`, `OrganizationSignupPage.tsx:17-22`)을 `entities/subscription`(또는 glossary)의 `subscriptionStatusLabel` 하나로 합친다.
- URL 경로 이름 변경(`/tutor/classes` 등)은 2번에서 한다.

## 2. 공통 내비게이션 규칙

### 2-1. 탭 강조는 경로로 결정
- `dashboardNavItems(user, navigate, active)`의 `active` 인자를 `pathname`으로 바꾸고, 같은 파일에 역할별 "경로 prefix → 탭 key" 매핑을 둔다. 가장 긴 prefix가 이긴다.
- DIRECTOR: `/organization/classes*`→classes, `/organization/tutors*`→tutors, `/organization/usage`→usage, `/organization/reports`→reports, `/organization/subscription`→mypage, `/organization`→home.
- TUTOR: 현재 동작 유지(`/tutor/students*`, `/tutor/class-groups*`, `/tutor/lessons*`→classes). 재편은 2번.
- PARENT: `/parent`→home, `/library`→library, `/reports*`→reports, `/stories/*`→library.
- 공통: `/mypage*`, `/payment/*`→mypage.
- 각 페이지의 하드코딩된 active 값은 제거한다.

### 2-2. 뒤로가기 `useBackOr(fallback)`
- `src/shared/lib/use-back-or.ts`. 앱 안에서 이동해 들어온 경우(`location.key !== 'default'`) `navigate(-1)`, 아니면 `navigate(fallback, { replace: true })`.
- 적용: 리포트 상세(fallback: 역할별 리포트 목록), 반 만들기·반 상세(fallback `/tutor/students`), 회원 탈퇴(fallback `/mypage`), 이야기 상세(fallback 역할별 서재), 결제 성공·실패(새로 onBack 추가, fallback 역할별 이용권 페이지).
- `/reports` 목록의 onBack: `/mypage` → 역할 홈.

### 2-3. 홈 이동
- "홈으로"류 이동은 로그인 상태면 `homePathFor(user)`, 비로그인이면 `/`로 직접 간다. 대상: `StoryDetailPage`, `StoryPlayerRoute`, 플레이어 완주/리포트의 홈 버튼, 결제 결과. (플레이어 top-bar 로고·홈 메뉴 정리는 1번)

### 2-4. 이야기 열기 `openStory`
- `src/features/story-library/lib/open-story.ts`에 단일 함수로 둔다. `/`, `/parent`, `/library`, `/tutor/library`, 공용 그리드가 모두 이 함수를 쓴다.

| 상황 | 이동 |
|---|---|
| 로그인 + 열린 이야기(HG 포함) | `/stories/:id` |
| 비로그인 + 체험 이야기 | `/demo` |
| 비로그인 + 그 외 | `/login?next=/stories/:id` |
| 잠김 + PARENT | `/mypage/subscription` |
| 잠김 + TUTOR / DIRECTOR | `/mypage/subscription` (아래 0-3 #3 안내) |

- 로그인 상태의 `/stories/:id`는 `AppNavShell` 안에 렌더한다.

## 3. 막다른 길·버그 정리

### 마이페이지/결제
1. `MyPageNotificationsPage`, `MyPagePrivacyPage`, `MyPageSupportPage`의 역할 가드: 개인정보·고객지원은 모든 로그인 역할 허용(VoiceResearchConsentSection은 PARENT만). 알림 설정은 API가 지원하는 역할에만 메뉴 노출 — 구현 시 BE 지원 범위 확인 후 결정, 미지원 역할은 메뉴에서 숨김.
2. DIRECTOR의 마이페이지 "이용권" → `/organization/subscription`.
3. 베타 개방: BE `EntitlementService`가 설정 `qstory.beta.open-access-tutor-org`(기본 true, env `BETA_OPEN_ACCESS_TUTOR_ORG`)가 켜져 있으면 TUTOR·DIRECTOR에게 모든 이야기를 연다(`assertAccessible`, `hasAccess` 모두). PARENT는 그대로 이용권 필요. FE `/mypage/subscription`에서 PARENT가 아닌 역할은 "베타 기간에는 모든 이야기가 열려 있어요" 안내(DIRECTOR에겐 기관 이용권 페이지 버튼 추가).
4. 회원 탈퇴: 진입점은 마이페이지 하단과 개인정보 "데이터 삭제" 2곳(`MyPageAccountPage.tsx:112-119` 링크 제거). `MyPageDeleteAccountPage`의 추가 확인 모달 제거 — 페이지가 확인 단계.
5. 마이페이지의 "개선사항 요청" 메뉴 제거, 고객지원의 기능제안·오류제보로 일원화.
6. 결제
   - Checkout: 역할 불일치 시 `/` replace 대신 안내 + 역할 홈 버튼.
   - Fail: "다시 결제하기"(같은 target으로 `/payment/checkout`) 추가.
   - Success: 비로그인 시 `/login?next=<현재 URL 전체>`로 쿼리 보존.

### 튜터/기관
7. `OrgInviteAcceptPage` 비로그인 수락: `/signup?role=tutor&next=<초대 경로>`. 현재 sign-in에만 있는 `next`를 sign-up 진입에도 전달하고(`readOnboardingParams`, 검증은 기존 `safeNextPath` 재사용), 가입 후 `/onboarding/tutor`로 넘길 때 `next`를 유지해 온보딩 완료(또는 "나중에") 시 그리로 이동한다. 초대로 들어온 경우 온보딩의 소속 선택 단계는 건너뛴다(초대 수락 화면이 그 역할).
8. `OrganizationClassDetailPage`
   - ~~담임 변경~~ → 2번으로 이동(BE가 수업·기록 귀속 문제로 의도적으로 막아 둠, `ClassService.assignHomeroom`).
   - 반 코드 영역을 `InviteCodeCard`로 교체(공유·복사).
9. 소속 해제 안내 문구(`OrgInviteAcceptPage.tsx:124-125`, `OnboardingTutorPage.tsx:84`): "해제는 관리자에게 요청해 주세요."로 수정. 해제 기능은 2번에서 판단.
10. `JoinClassPage` 비보호자 계정: "반 초대 링크는 보호자 계정에서 열 수 있어요" 안내 + "내 홈으로" + 로그아웃.
11. `TutorLibraryPage.tsx:129` 부제목에서 "학생별로 담아 두세요" 제거(계정 단위 저장임을 반영).

### 보호자
12. ~~가입 폼 반 코드 체크박스 기본값~~ — 이번 범위에서 제외(유지).
13. 튜토리얼 "회원가입하기" → 역할 선택 단계로 바로. `HomePage.readOnboardingParams`에서 `flow=sign-up`인데 role이 없으면 `welcome`이 아니라 `role` 단계를 반환한다(`OnboardingEntry`에 `role` step 진입 추가). 역할 카드 라벨 "학부모님" → "보호자"(HomePage `ROLE_OPTIONS`, OnboardingFlow `ROLE_CARDS`).
14. `OnboardingParentPage` "나중에": 아이 등록 단계에서 누르면 동의 단계로 이동(완료 처리 안 함), 동의 단계에서는 숨김. 동의는 서버에 저장되지 않는 화면 확인이므로 FE만 수정.
15. `ParentHomePage` "어제 읽던 이야기예요" → 저장 시각 기준 상대 날짜(오늘/어제/N일 전).
16. 이어듣기 후보가 storyId로 걸러지지 않는 의심(`use-one-story-runtime.ts:223-224`): 테스트로 재현 후 맞으면 storyId 일치 시에만 ResumeModal.

### 공통 문구
17. 로딩 문구의 "헨젤과 그레텔" 하드코딩(`processing-panel.tsx:31-37`, `generating-branch-panel.tsx:22`, `awaiting-choice-panel.tsx:33`) → 현재 이야기 제목/주인공 이름.
18. `shared/lib`에 받침 판별 조사 헬퍼(`withJosa(name, '이/가')` 등) 추가, `reader-card.tsx:51` 등 이름+조사 문구에 적용.

### 1번으로 넘김
플레이어 나가기 경로 통일("잠시 나가기" 외부 이동, 넓은 화면 로고 즉시 이동), ParentMessageBanner의 확인 없는 재시작, `rejoining` 죽은 상태 제거.

## 범위 밖
- 약관·개인정보처리방침 URL(현재 "곧 공개" 유지).
- 반 코드 체크박스 기본값.
- 탭 구조 재편, 화면 병합, URL 경로 변경(2~4번).

## 테스트
- 순수 함수 단위 테스트(`tsx --test`): 탭 매핑(역할×경로), `openStory` 결정표, `useBackOr`의 분기 함수, `withJosa`, `next` 경로 검증, 상태 라벨 맵.
- #16은 재현 테스트 먼저.
- 수동 확인: Playwright로 역할별(PARENT/TUTOR/DIRECTOR) 마이페이지 메뉴 전부 클릭해 튕김 없는지, 초대 수락 비로그인 흐름, 결제 실패→다시 결제.

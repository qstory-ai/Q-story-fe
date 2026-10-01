# UX 정리 0번(공통 기반 + 막다른 길) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 용어·탭 강조·뒤로가기·홈 이동·이야기 열기 규칙을 한 곳으로 모으고, 사용자가 튕기거나 잘못 안내받는 지점 17곳을 고친다. BE는 베타 기간 선생님·기관 전체 개방 설정을 추가한다.

**Architecture:** 판단 로직은 전부 순수 함수(`navKeyForPath`, `backTarget`, `storyDestination`, `readOnboardingParams`, `relativeDayLabel`, `resumableProgressFor`, `subscriptionStatusLabel`)로 빼서 `node:test`로 검증하고, 화면은 그 함수를 호출만 한다. 문구 금지어는 소스 스캔 테스트로 재발을 막는다. BE는 `qstory.beta.open-access-tutor-org` 설정 하나로 `EntitlementService`를 분기한다.

**Tech Stack:** FE — React 19 + react-native-web + react-router-dom 6, Vite, `tsx --test`(node:test). BE — Spring Boot(Java), JUnit5 + Mockito, Gradle.

**Spec:** `fe/docs/superpowers/specs/2026-10-01-ux-foundation-design.md`

## Global Constraints

- 기능은 삭제하지 않는다. 화면 병합·탭 재편·URL 경로 변경은 이 계획에 넣지 않는다(2~4번).
- 용어: 반 / 수업 / 보호자 / 보호자 연결 대기 / 이용권 / 이용권 없음·체험 중·이용 중·만료됨 / 리포트 / 기관 / 관리자.
- 금지어(UI 문구, 주석 제외): 학부모, 부모 리포트, 구독, 원장, 기관 관리자, 라이선스, 비즈니스 이용권, 완주 기록, 부모 확인 대기, 부모 연결 대기, 연결 안 됨, 기관 및 단체.
- `next` 등 이동 경로 파라미터는 앱 내부 경로만 허용: 정규식 `^\/(?![/\\])[^\\\s]*$`.
- 접근성: 새 버튼은 기존 `ActionButton`(44px 이상)만 사용, `accessibilityRole` 유지.
- 베타 개방 설정 이름: `qstory.beta.open-access-tutor-org`, env `BETA_OPEN_ACCESS_TUTOR_ORG`, 기본값 `true`. PARENT에는 적용하지 않는다.
- 안내 문구(비보호자 이용권): "베타 기간에는 모든 이야기가 열려 있어요."
- 매 태스크 끝: FE `npm run typecheck && npm run lint && npm test` (fe 폴더), BE `./gradlew test` (be 폴더).
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- 브랜치: FE `feat/ux-foundation`(이미 생성), BE `feat/beta-open-access`(Task 1에서 생성).

## Review Focus

1. 링크로 바로 들어온 화면(히스토리 없음)에서 뒤로가기 → 앱 밖으로 나가지 않고 대체 경로로 가야 한다 → Task 4 `backTarget('default', …)` 테스트.
2. `next`에 `//evil.com`, `/\evil.com`, `https://…`가 들어오면 무시하고 기본 경로로 → Task 9 `readOnboardingParams` 테스트.
3. 비로그인 사용자가 잠긴 이야기를 누르면 로그인 후 그 이야기 상세로 돌아와야 한다(`/login`이 `next`를 버리지 않음) → Task 5 `storyDestination` + `LoginPage` 테스트.
4. 기관이 없는 관리자(organizationId null)·소속 없는 개인 선생님도 베타 플래그가 켜져 있으면 열려야 하고, 꺼지면 기존 규칙 → Task 1 BE 테스트.
5. 다른 이야기를 열었을 때 이전 이야기의 이어듣기 창이 뜨지 않아야 한다 → Task 12 `resumableProgressFor` 테스트.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `be/src/main/java/com/qstory/backend/config/BetaProperties.java` (new) | 베타 개방 설정 바인딩 |
| `be/.../entitlement/service/EntitlementService.java` | 베타 개방 분기 |
| `fe/src/shared/config/glossary.ts` (new) | 용어·상태 라벨·금지어 상수 |
| `fe/src/shared/config/glossary.test.ts` (new) | 금지어 소스 스캔 |
| `fe/src/entities/auth/model/dashboard-nav.ts` | `navKeyForPath` + `dashboardNavItems(user, navigate, pathname)` |
| `fe/src/entities/auth/model/home-path.ts` | `homePathForAuth`, `libraryPathFor`, `subscriptionPathFor` 추가 |
| `fe/src/shared/lib/back-target.ts` (new) | `backTarget` 순수 함수 + `useBackOr` 훅 |
| `fe/src/shared/lib/relative-day.ts` (new) | `relativeDayLabel` |
| `fe/src/features/story-library/lib/story-destination.ts` (new) | 이야기 카드 목적지 결정 |
| `fe/src/pages/home/model/onboarding-params.ts` (new) | `safeNextPath`, `readOnboardingParams` (HomePage에서 이동) |
| `fe/src/entities/analytics/model/local-story-progress.ts` | `resumableProgressFor` 추가 |
| 기타 pages/* | 위 함수 호출로 교체, 문구 수정 |

---

### Task 1: BE — 베타 기간 선생님·기관 전체 개방

**Files:**
- Create: `be/src/main/java/com/qstory/backend/config/BetaProperties.java`
- Modify: `be/src/main/java/com/qstory/backend/entitlement/service/EntitlementService.java`
- Modify: `be/src/main/resources/application.yml` (`qstory:` 블록)
- Test: `be/src/test/java/com/qstory/backend/entitlement/service/EntitlementServiceTest.java`

**Interfaces:**
- Produces: `record BetaProperties(boolean openAccessTutorOrg)` (prefix `qstory.beta`); `EntitlementService(OrganizationRepository, AppUserRepository, TutorStudentRepository, OrganizationTutorRepository, BetaProperties)`.

- [ ] **Step 1: 브랜치 생성**

```bash
cd be && git switch -c feat/beta-open-access
```

- [ ] **Step 2: 실패하는 테스트 작성** — `EntitlementServiceTest.java`의 서비스 생성부를 바꾸고 테스트 4개 추가.

생성부(기존 40-41행 교체):
```java
    private final EntitlementService service = new EntitlementService(
            organizationRepository, appUserRepository, tutorStudentRepository, organizationTutorRepository,
            new BetaProperties(false));
    private final EntitlementService betaOpenService = new EntitlementService(
            organizationRepository, appUserRepository, tutorStudentRepository, organizationTutorRepository,
            new BetaProperties(true));
```

추가 테스트(클래스 끝):
```java
    @Test
    void betaOpenAccessLetsTutorWithoutOrganizationIn() {
        CurrentUser tutor = new CurrentUser(UUID.randomUUID(), Role.TUTOR, null);
        when(appUserRepository.findById(tutor.userId()))
                .thenReturn(Optional.of(AppUser.builder().role(Role.TUTOR).subscriptionStatus(SubscriptionStatus.NONE).build()));
        when(organizationTutorRepository.findOrganizationsOfTutor(tutor.userId())).thenReturn(List.of());
        assertDoesNotThrow(() -> betaOpenService.assertAccessible(paidStory, tutor));
    }

    @Test
    void betaOpenAccessLetsDirectorWithoutOrganizationIn() {
        CurrentUser director = new CurrentUser(UUID.randomUUID(), Role.DIRECTOR, null);
        when(appUserRepository.findById(director.userId()))
                .thenReturn(Optional.of(AppUser.builder().role(Role.DIRECTOR).subscriptionStatus(SubscriptionStatus.NONE).build()));
        assertDoesNotThrow(() -> betaOpenService.assertAccessible(paidStory, director));
    }

    @Test
    void betaOpenAccessDoesNotApplyToParents() {
        when(appUserRepository.findById(parentId))
                .thenReturn(Optional.of(AppUser.builder().role(Role.PARENT).subscriptionStatus(SubscriptionStatus.NONE).build()));
        when(tutorStudentRepository.findClassSeatsOfParent(parentId)).thenReturn(List.of());
        assertThrows(ApiException.class, () -> betaOpenService.assertAccessible(paidStory, parent));
    }

    @Test
    void tutorWithoutSubscriptionStaysLockedWhenBetaFlagIsOff() {
        CurrentUser tutor = new CurrentUser(UUID.randomUUID(), Role.TUTOR, null);
        when(appUserRepository.findById(tutor.userId()))
                .thenReturn(Optional.of(AppUser.builder().role(Role.TUTOR).subscriptionStatus(SubscriptionStatus.NONE).build()));
        when(organizationTutorRepository.findOrganizationsOfTutor(tutor.userId())).thenReturn(List.of());
        assertThrows(ApiException.class, () -> service.assertAccessible(paidStory, tutor));
    }

    @Test
    void hasAccessReflectsBetaOpenAccessForTutor() {
        AppUser tutor = AppUser.builder().id(UUID.randomUUID()).role(Role.TUTOR).subscriptionStatus(SubscriptionStatus.NONE).build();
        when(organizationTutorRepository.findOrganizationsOfTutor(tutor.getId())).thenReturn(List.of());
        assertEquals(true, betaOpenService.hasAccess(tutor));
        assertEquals(false, service.hasAccess(tutor));
    }
```
(구현자 확인 사항: `AppUser.builder()`에 `id`/`subscriptionStatus` 빌더 메서드가 있는지, `personalGrantsAccess`가 `appUserRepository.findById`를 쓰는지 `EntitlementService.java:88-95`에서 확인하고 스텁을 맞출 것.)

- [ ] **Step 3: 실패 확인**

Run: `cd be && ./gradlew test --tests "*EntitlementServiceTest"`
Expected: 컴파일 실패 — `BetaProperties` 없음.

- [ ] **Step 4: 구현**

`BetaProperties.java`:
```java
package com.qstory.backend.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 베타 운영 스위치. openAccessTutorOrg가 켜져 있으면 선생님·관리자 계정에 결제 없이 모든 이야기를 연다 -
 * 보호자는 그대로 이용권이 필요하다. 정식 출시 때 BETA_OPEN_ACCESS_TUTOR_ORG=false로 끈다.
 */
@ConfigurationProperties(prefix = "qstory.beta")
public record BetaProperties(boolean openAccessTutorOrg) {}
```

`EntitlementService.java`:
- import `com.qstory.backend.config.BetaProperties;`, `com.qstory.backend.identity.Role;`
- 필드 `private final BetaProperties beta;` 추가, 생성자 마지막 파라미터 `BetaProperties beta` 추가 후 `this.beta = beta;`
- 메서드 추가:
```java
    /** 베타 기간 선생님·관리자 전체 개방 - 보호자는 해당하지 않는다. */
    private boolean betaOpen(Role role) {
        return beta.openAccessTutorOrg() && (role == Role.TUTOR || role == Role.DIRECTOR);
    }
```
- `assertAccessible`의 402 판정 조건(52행) 앞부분을 다음으로:
```java
        if (callerOrNull == null || !(betaOpen(callerOrNull.role()) || orgGrantsAccess(callerOrNull) || personalGrantsAccess(callerOrNull))) {
```
- `hasAccess` 첫 줄에:
```java
        if (betaOpen(user.getRole())) {
            return true;
        }
```

`application.yml`의 `qstory:` 블록(`ffmpeg-path` 다음 줄)에:
```yaml
  beta:
    # 베타 기간 선생님·관리자 전체 개방(보호자 제외). 정식 출시 때 false.
    open-access-tutor-org: ${BETA_OPEN_ACCESS_TUTOR_ORG:true}
```

- [ ] **Step 5: 통과 확인**

Run: `cd be && ./gradlew test`
Expected: 전체 PASS. `new EntitlementService(` 를 쓰는 다른 테스트가 있으면(`grep -rn "new EntitlementService(" src/test`) 같은 방식으로 `new BetaProperties(false)` 추가.

- [ ] **Step 6: 커밋**

```bash
cd be && git add -A src/main/java/com/qstory/backend/config/BetaProperties.java src/main/java/com/qstory/backend/entitlement src/main/resources/application.yml src/test
git commit -m "feat(entitlement): 베타 기간 선생님·관리자 전체 개방 설정 추가

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: 용어 사전 + 상태 라벨 + 역할 라벨

**Files:**
- Create: `fe/src/shared/config/glossary.ts`
- Modify: `fe/src/shared/config/index.ts` (export 추가)
- Modify: `fe/src/entities/auth/model/role-label.ts`
- Modify: `fe/src/pages/mypage-subscription/ui/MyPageSubscriptionPage.tsx:8-13`, `fe/src/pages/organization-subscription/ui/OrganizationSubscriptionPage.tsx:15-17`, `fe/src/pages/organization-signup/ui/OrganizationSignupPage.tsx:17-22`
- Test: `fe/src/shared/config/glossary.test.ts`

**Interfaces:**
- Produces: `subscriptionStatusLabel(status: 'NONE'|'TRIALING'|'ACTIVE'|'EXPIRED'): string`, `BETA_OPEN_ACCESS_NOTICE: string`, `BANNED_UI_TERMS: readonly string[]`, `GLOSSARY` 상수.

- [ ] **Step 1: 실패하는 테스트** — `glossary.test.ts`(라벨 부분만; 금지어 스캔은 Task 13에서 추가)

```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from './glossary';

test('이용권 상태 라벨은 한 벌이다', () => {
  assert.equal(subscriptionStatusLabel('NONE'), '이용권 없음');
  assert.equal(subscriptionStatusLabel('TRIALING'), '체험 중');
  assert.equal(subscriptionStatusLabel('ACTIVE'), '이용 중');
  assert.equal(subscriptionStatusLabel('EXPIRED'), '만료됨');
});

test('베타 개방 안내 문구', () => {
  assert.equal(BETA_OPEN_ACCESS_NOTICE, '베타 기간에는 모든 이야기가 열려 있어요.');
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/shared/config/glossary.test.ts` → FAIL(모듈 없음)

- [ ] **Step 3: 구현** — `glossary.ts`

```ts
/**
 * 화면 문구의 단일 기준(UX 정리 0번 스펙 §1). 새 문구는 여기 단어를 쓰고, BANNED_UI_TERMS는
 * glossary.test.ts가 소스 전체에서 재발을 막는다.
 */
export const GLOSSARY = {
  classGroup: '반',
  lesson: '수업',
  guardian: '보호자',
  pendingGuardian: '보호자 연결 대기',
  entitlement: '이용권',
  report: '리포트',
  organization: '기관',
  director: '관리자',
} as const;

type SubscriptionStatus = 'NONE' | 'TRIALING' | 'ACTIVE' | 'EXPIRED';

const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  NONE: '이용권 없음',
  TRIALING: '체험 중',
  ACTIVE: '이용 중',
  EXPIRED: '만료됨',
};

export function subscriptionStatusLabel(status: SubscriptionStatus): string {
  return SUBSCRIPTION_STATUS_LABEL[status];
}

/** 선생님·관리자에게 보이는 이용권 안내 - BE qstory.beta.open-access-tutor-org와 짝. */
export const BETA_OPEN_ACCESS_NOTICE = '베타 기간에는 모든 이야기가 열려 있어요.';

export const BANNED_UI_TERMS = [
  '학부모',
  '부모 리포트',
  '구독',
  '원장',
  '기관 관리자',
  '라이선스',
  '비즈니스 이용권',
  '완주 기록',
  '부모 확인 대기',
  '부모 연결 대기',
  '연결 안 됨',
  '기관 및 단체',
] as const;
```

`shared/config/index.ts`에 `export * from './glossary';` 추가.

`role-label.ts`의 맵:
```ts
const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: '관리자',
  PARENT: '보호자',
  TUTOR: '선생님',
  STAFF: '콘텐츠 운영자',
};
```

세 페이지의 로컬 `STATUS_LABEL`/라벨 맵을 지우고 `subscriptionStatusLabel(…)` 호출로 교체(`import { subscriptionStatusLabel } from '@/shared/config';`). 맵을 쓰던 표현식 `STATUS_LABEL[x]` → `subscriptionStatusLabel(x)`.

- [ ] **Step 4: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/shared/config src/entities/auth/model/role-label.ts src/pages/mypage-subscription src/pages/organization-subscription src/pages/organization-signup
git commit -m "feat(ux): 용어 사전과 이용권 상태 라벨 단일화

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: 탭 강조를 경로로 결정

**Files:**
- Modify: `fe/src/entities/auth/model/dashboard-nav.ts`
- Modify: `dashboardNavItems(`를 호출하는 37개 페이지(목록은 `grep -rln "dashboardNavItems(" src/pages`)
- Test: `fe/src/entities/auth/model/dashboard-nav.test.ts`

**Interfaces:**
- Produces: `navKeyForPath(role: Role, pathname: string): DashboardNavKey | null`; `dashboardNavItems(user: UserSummary, navigate: (path: string) => void, pathname: string)`.

- [ ] **Step 1: 실패하는 테스트**

```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { navKeyForPath } from './dashboard-nav';

test('관리자 하위 화면은 자기 탭을 강조한다', () => {
  assert.equal(navKeyForPath('DIRECTOR', '/organization'), 'home');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/classes'), 'classes');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/classes/abc'), 'classes');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/tutors/t1'), 'tutors');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/usage'), 'usage');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/reports'), 'reports');
  assert.equal(navKeyForPath('DIRECTOR', '/organization/subscription'), 'mypage');
});

test('선생님 경로 매핑은 현재 동작을 유지한다', () => {
  assert.equal(navKeyForPath('TUTOR', '/tutor'), 'home');
  assert.equal(navKeyForPath('TUTOR', '/tutor/library'), 'library');
  assert.equal(navKeyForPath('TUTOR', '/tutor/students/s1'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/class-groups/new'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/tutor/lessons/l1'), 'classes');
  assert.equal(navKeyForPath('TUTOR', '/reports/c1'), 'reports');
  assert.equal(navKeyForPath('TUTOR', '/tutor/join-organization'), 'mypage');
  assert.equal(navKeyForPath('TUTOR', '/stories/HG'), 'library');
});

test('보호자 경로 매핑', () => {
  assert.equal(navKeyForPath('PARENT', '/parent'), 'home');
  assert.equal(navKeyForPath('PARENT', '/stories/HG'), 'library');
  assert.equal(navKeyForPath('PARENT', '/reports/c1'), 'reports');
  assert.equal(navKeyForPath('PARENT', '/payment/checkout'), 'mypage');
});

test('접두사가 단어 경계에서만 맞는다', () => {
  assert.equal(navKeyForPath('PARENT', '/parentx'), null);
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/entities/auth/model/dashboard-nav.test.ts` → FAIL(`navKeyForPath` 없음)

- [ ] **Step 3: 구현** — `dashboard-nav.ts`

`import type { Role, UserSummary } from '../api/auth-api';`로 바꾸고 다음을 추가:
```ts
const COMMON_TABS: Array<[string, DashboardNavKey]> = [
  ['/mypage', 'mypage'],
  ['/payment', 'mypage'],
];

/** 역할별 "경로 접두사 → 탭". 가장 긴 접두사가 이긴다. 선생님 반·학생 탭 재편은 2번 하위 프로젝트에서. */
const PATH_TABS: Record<Role, Array<[string, DashboardNavKey]>> = {
  PARENT: [
    ['/parent', 'home'],
    ['/library', 'library'],
    ['/stories', 'library'],
    ['/reports', 'reports'],
    ...COMMON_TABS,
  ],
  TUTOR: [
    ['/tutor', 'home'],
    ['/tutor/library', 'library'],
    ['/stories', 'library'],
    ['/tutor/classes', 'classes'],
    ['/tutor/lessons', 'classes'],
    ['/tutor/students', 'classes'],
    ['/tutor/class-groups', 'classes'],
    ['/tutor/reports', 'reports'],
    ['/reports', 'reports'],
    ['/tutor/join-organization', 'mypage'],
    ...COMMON_TABS,
  ],
  DIRECTOR: [
    ['/organization', 'home'],
    ['/organization/classes', 'classes'],
    ['/organization/tutors', 'tutors'],
    ['/organization/usage', 'usage'],
    ['/organization/reports', 'reports'],
    ['/organization/subscription', 'mypage'],
    ...COMMON_TABS,
  ],
  STAFF: [['/staff', 'home'], ...COMMON_TABS],
};

export function navKeyForPath(role: Role, pathname: string): DashboardNavKey | null {
  let best: { length: number; key: DashboardNavKey } | null = null;
  for (const [prefix, key] of PATH_TABS[role] ?? []) {
    const matches = pathname === prefix || pathname.startsWith(`${prefix}/`);
    if (matches && (!best || prefix.length > best.length)) best = { length: prefix.length, key };
  }
  return best?.key ?? null;
}
```
`dashboardNavItems`의 세 번째 파라미터를 `pathname: string`으로 바꾸고, 함수 첫 줄에 `const active = navKeyForPath(user.role, pathname);` 추가(나머지 로직은 그대로 `entry.key === active`).
(구현자 확인: `Role` 타입이 `auth-api.ts`에서 export되는지 — `ROLE_LABEL: Record<Role, …>`에서 쓰이므로 존재. STAFF 외 다른 역할 값이 있으면 `PATH_TABS`에 빈 배열로 추가.)

- [ ] **Step 4: 호출부 일괄 교체** — 스크래치 스크립트로 처리(저장소에 커밋하지 않음):

```bash
cd fe && node - <<'EOF'
const fs = require('fs');
const { execSync } = require('child_process');
const files = execSync('grep -rl "dashboardNavItems(" src/pages').toString().trim().split('\n');
for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const callRe = /dashboardNavItems\(([^,()]+(?:\([^)]*\))?[^,()]*), navigate, '[a-z]+'\)/g;
  // 호출이 들어 있는 컴포넌트마다, 그 앞에서 가장 가까운 useNavigate() 선언 뒤에 pathname을 둔다.
  const inserts = new Set();
  for (const m of src.matchAll(callRe)) {
    const navDecl = src.lastIndexOf('const navigate = useNavigate();', m.index);
    if (navDecl < 0) throw new Error(`navigate 선언 없음: ${file}`);
    inserts.add(navDecl + 'const navigate = useNavigate();'.length);
  }
  for (const pos of [...inserts].sort((a, b) => b - a)) {
    src = src.slice(0, pos) + '\n  const { pathname } = useLocation();' + src.slice(pos);
  }
  src = src.replace(callRe, 'dashboardNavItems($1, navigate, pathname)');
  src = src.replace(/import \{([^}]*)\} from 'react-router-dom';/, (all, names) =>
    names.includes('useLocation') ? all : `import {${names.trimEnd()}, useLocation } from 'react-router-dom';`);
  fs.writeFileSync(file, src);
}
EOF
grep -rn "navigate, '[a-z]*')" src/pages || echo "all replaced"
```
Expected: `all replaced`. 그다음 `npm run typecheck && npm run lint` — 같은 컴포넌트에 `pathname` 이름이 이미 있어 충돌하면 해당 파일만 `const { pathname: navPathname } = useLocation();`으로 바꾸고 호출 인자도 맞춘다.

- [ ] **Step 5: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 6: 커밋**

```bash
git add src/entities/auth/model/dashboard-nav.ts src/entities/auth/model/dashboard-nav.test.ts src/pages
git commit -m "feat(nav): 하단 탭 강조를 경로로 결정 - 관리자 화면이 홈 탭을 강조하던 문제 수정

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: 뒤로가기 `useBackOr` + 홈 경로 헬퍼

**Files:**
- Create: `fe/src/shared/lib/back-target.ts`, `fe/src/shared/lib/back-target.test.ts`
- Modify: `fe/src/shared/lib/index.ts`
- Modify: `fe/src/entities/auth/model/home-path.ts` (+ test `home-path.test.ts` 신규)
- Modify: `fe/src/pages/report-history/ui/ReportHistoryDetailPage.tsx:80-83`, `ReportHistoryPage.tsx:157`, `fe/src/pages/tutor-class-group/ui/TutorClassGroupNewPage.tsx:70`, `TutorClassGroupPage.tsx:67`, `fe/src/pages/mypage-delete-account/ui/MyPageDeleteAccountPage.tsx:56`
- Modify (홈 이동): `fe/src/pages/one-story/model/use-one-story-runtime.ts:1829,1866`, `fe/src/pages/story-player/ui/StoryPlayerRoute.tsx:70`

**Interfaces:**
- Produces: `backTarget(locationKey: string, fallback: string): -1 | string`; `useBackOr(fallback: string): () => void`; `homePathForAuth(state: AuthState): string`; `libraryPathFor(user: UserSummary): string`; `subscriptionPathFor(user: UserSummary): string`.

- [ ] **Step 1: 실패하는 테스트**

`back-target.test.ts`:
```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { backTarget } from './back-target';

test('앱 안에서 이동해 왔으면 직전 화면으로', () => {
  assert.equal(backTarget('k3j2', '/reports'), -1);
});

test('링크로 바로 들어왔으면(첫 항목) 대체 경로로', () => {
  assert.equal(backTarget('default', '/reports'), '/reports');
});
```

`home-path.test.ts`:
```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { UserSummary } from '../api/auth-api';
import { homePathForAuth, libraryPathFor, subscriptionPathFor } from './home-path';

const user = (role: UserSummary['role']) => ({ role } as UserSummary);

test('로그인 상태면 역할 홈, 아니면 /', () => {
  assert.equal(homePathForAuth({ status: 'authenticated', token: 't', user: user('PARENT') }), '/parent');
  assert.equal(homePathForAuth({ status: 'anonymous' }), '/');
  assert.equal(homePathForAuth({ status: 'loading' }), '/');
});

test('역할별 서재·이용권 경로', () => {
  assert.equal(libraryPathFor(user('PARENT')), '/library');
  assert.equal(libraryPathFor(user('TUTOR')), '/tutor/library');
  assert.equal(libraryPathFor(user('DIRECTOR')), '/organization');
  assert.equal(subscriptionPathFor(user('DIRECTOR')), '/organization/subscription');
  assert.equal(subscriptionPathFor(user('PARENT')), '/mypage/subscription');
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/shared/lib/back-target.test.ts src/entities/auth/model/home-path.test.ts` → FAIL

- [ ] **Step 3: 구현**

`back-target.ts`:
```ts
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * react-router는 히스토리의 첫 항목(주소창·외부 링크로 바로 연 화면)에 key 'default'를 준다 -
 * 그때 navigate(-1)은 앱 밖으로 나가므로 대체 경로로 보낸다.
 */
export function backTarget(locationKey: string, fallback: string): -1 | string {
  return locationKey === 'default' ? fallback : -1;
}

/** "왔던 곳으로, 없으면 fallback으로" 뒤로가기 핸들러. 페이지의 조기 return보다 위에서 호출한다. */
export function useBackOr(fallback: string): () => void {
  const navigate = useNavigate();
  const { key } = useLocation();
  return useCallback(() => {
    const target = backTarget(key, fallback);
    if (target === -1) navigate(-1);
    else navigate(target, { replace: true });
  }, [key, fallback, navigate]);
}
```
`shared/lib/index.ts`에 `export * from './back-target';` 추가.

`home-path.ts`에 추가(`import type { AuthState } from './current-user';`):
```ts
/** "홈으로" 버튼의 목적지 - 로그인 상태면 역할 홈으로 바로 가서 "/" 경유 리다이렉트를 없앤다. */
export function homePathForAuth(state: AuthState): string {
  return state.status === 'authenticated' ? homePathFor(state.user) : '/';
}

export function libraryPathFor(user: UserSummary): string {
  if (user.role === 'PARENT') return '/library';
  if (user.role === 'TUTOR') return '/tutor/library';
  return homePathFor(user);
}

export function subscriptionPathFor(user: UserSummary): string {
  return user.role === 'DIRECTOR' ? '/organization/subscription' : '/mypage/subscription';
}
```
(구현자 확인: `current-user.tsx`가 `home-path.ts`를 import해 순환이 생기면 `import type`이므로 런타임 순환은 없다.)

- [ ] **Step 4: 화면 적용**

- `ReportHistoryDetailPage.tsx`: 컴포넌트 상단(다른 훅들 옆, 조기 return 전)에
  ```ts
  const reportsFallback = state.status === 'authenticated' && state.user.role === 'TUTOR' ? '/tutor/reports' : '/reports';
  const goBack = useBackOr(reportsFallback);
  ```
  `onBack={() => navigate(… '/tutor/reports' : '/reports')}` → `onBack={goBack}`.
- `ReportHistoryPage.tsx:157`: `onBack={() => navigate('/mypage')}` → `onBack={() => navigate(homePathFor(state.user))}` (`homePathFor` import 추가).
- `TutorClassGroupNewPage.tsx`, `TutorClassGroupPage.tsx`: `const goBack = useBackOr('/tutor/students');`를 `useNavigate()` 다음 줄에 두고 `onBack={goBack}`.
- `MyPageDeleteAccountPage.tsx`: `const goBack = useBackOr('/mypage');`, `onBack={goBack}`.
- `use-one-story-runtime.ts` 1829, 1866행: `navigate('/')` → `navigate(homePathForAuth(authState))` (`homePathForAuth`를 `@/entities/auth` import에 추가, `authState`는 126행에 이미 있음. 두 콜백의 의존성 배열에 `authState` 추가).
- `StoryPlayerRoute.tsx:70`: `useAuth()`로 `state`를 받고 `navigate(homePathForAuth(state))`.

- [ ] **Step 5: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 6: 커밋**

```bash
git add src/shared/lib src/entities/auth/model/home-path.ts src/entities/auth/model/home-path.test.ts src/pages
git commit -m "feat(nav): 뒤로가기는 왔던 곳으로, 홈으로는 역할 홈으로 바로

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: 이야기 열기 목적지 통일 + 상세를 탭 셸 안으로

**Files:**
- Create: `fe/src/features/story-library/lib/story-destination.ts`, `story-destination.test.ts`
- Modify: `fe/src/features/story-library/index.ts` (export)
- Modify: `fe/src/features/story-library/ui/story-library-grid.tsx:149-151,176-186`
- Modify: `fe/src/pages/library/ui/LibraryPage.tsx:238-251`
- Modify: `fe/src/pages/tutor-library/ui/TutorLibraryPage.tsx:221-229`
- Modify: `fe/src/pages/parent-home/ui/ParentHomePage.tsx:165,202,219`
- Modify: `fe/src/pages/login/ui/LoginPage.tsx`
- Modify: `fe/src/pages/story-detail/ui/StoryDetailPage.tsx`
- Test: `fe/src/pages/login/ui/login-redirect.test.ts` (new, 아래 순수 함수용)

**Interfaces:**
- Consumes: `unlockStateFor` (`@/entities/story`), `DEFAULT_BETA_STORY_ID`, `useBackOr`, `libraryPathFor`, `navKeyForPath` 경유 `dashboardNavItems(user, navigate, pathname)`.
- Produces: `storyDestination(story: StoryCatalogEntry, auth: AuthState): string`; `loginRedirectPath(search: string): string`.

- [ ] **Step 1: 실패하는 테스트**

`story-destination.test.ts`:
```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AuthState, UserSummary } from '@/entities/auth';
import type { StoryCatalogEntry } from '@/entities/story';

import { storyDestination } from './story-destination';

const story = (storyId: string, requiresEntitlement: boolean) =>
  ({ storyId, requiresEntitlement } as StoryCatalogEntry);
const authed = (role: UserSummary['role'], grantsAccess: boolean): AuthState =>
  ({ status: 'authenticated', token: 't', user: { role, grantsAccess } as UserSummary });

test('로그인 상태면 체험 이야기도 상세로', () => {
  assert.equal(storyDestination(story('HG', false), authed('PARENT', false)), '/stories/HG');
});

test('비로그인 체험 이야기는 데모로, 무료 이야기는 상세로', () => {
  assert.equal(storyDestination(story('HG', false), { status: 'anonymous' }), '/demo');
  assert.equal(storyDestination(story('FREE', false), { status: 'anonymous' }), '/stories/FREE');
});

test('비로그인 잠긴 이야기는 로그인 후 상세로 돌아온다', () => {
  assert.equal(storyDestination(story('P1', true), { status: 'anonymous' }), '/login?next=%2Fstories%2FP1');
});

test('로그인했지만 잠긴 이야기는 이용권 페이지로', () => {
  assert.equal(storyDestination(story('P1', true), authed('PARENT', false)), '/mypage/subscription');
  assert.equal(storyDestination(story('P1', true), authed('TUTOR', false)), '/mypage/subscription');
});

test('열린 유료 이야기는 상세로', () => {
  assert.equal(storyDestination(story('P1', true), authed('TUTOR', true)), '/stories/P1');
});
```

`login-redirect.test.ts`:
```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loginRedirectPath } from './login-redirect';

test('next를 로그인 흐름으로 넘긴다', () => {
  assert.equal(loginRedirectPath('?next=%2Fstories%2FP1'), '/?flow=sign-in&next=%2Fstories%2FP1');
});

test('next가 없으면 그대로', () => {
  assert.equal(loginRedirectPath(''), '/?flow=sign-in');
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/features/story-library/lib/story-destination.test.ts src/pages/login/ui/login-redirect.test.ts` → FAIL (`@/` 별칭은 기존 테스트에서도 쓰므로 그대로 동작)

- [ ] **Step 3: 구현**

`story-destination.ts`:
```ts
import type { AuthState } from '@/entities/auth';
import { DEFAULT_BETA_STORY_ID, unlockStateFor, type StoryCatalogEntry } from '@/entities/story';

/**
 * 이야기 카드를 눌렀을 때의 목적지 - 홈/서재/선생님 서재/공용 그리드가 모두 이 함수를 쓴다(스펙 §2-4).
 * 로그인 상태에선 체험 이야기(HG)도 상세로 보낸다: /demo는 비로그인 체험용이라 연락처 수집 창이 뜬다.
 */
export function storyDestination(story: StoryCatalogEntry, auth: AuthState): string {
  const detail = `/stories/${story.storyId}`;
  const locked = unlockStateFor(story, auth) === 'locked';
  if (auth.status !== 'authenticated') {
    if (locked) return `/login?next=${encodeURIComponent(detail)}`;
    return story.storyId === DEFAULT_BETA_STORY_ID ? '/demo' : detail;
  }
  return locked ? '/mypage/subscription' : detail;
}
```
(`DEFAULT_BETA_STORY_ID`가 `@/entities/story` index에서 export되는지 확인 — 아니면 `@/entities/story/model/story-registry`에서 import.)
`features/story-library/index.ts`에 `export * from './lib/story-destination';`.

`fe/src/pages/login/ui/login-redirect.ts`:
```ts
/** `/login?next=` 딥링크의 next를 홈 로그인 흐름으로 넘긴다(검증은 홈의 safeNextPath가 한다). */
export function loginRedirectPath(search: string): string {
  const next = new URLSearchParams(search).get('next');
  const qs = new URLSearchParams({ flow: 'sign-in' });
  if (next) qs.set('next', next);
  return `/?${qs.toString()}`;
}
```
`LoginPage.tsx`:
```tsx
import { Navigate, useLocation } from 'react-router-dom';

import { loginRedirectPath } from './login-redirect';

/** `/login` 딥링크(이메일·북마크·외부 링크)를 홈("/") OnboardingFlow의 sign-in 스텝으로 넘긴다. next는 유지한다. */
export function LoginPage() {
  const { search } = useLocation();
  return <Navigate to={loginRedirectPath(search)} replace />;
}
```

카드 onPress 교체(모두 `import { storyDestination } from '@/features/story-library';` — 같은 feature 안인 grid는 상대 경로 `../lib/story-destination`):
- `story-library-grid.tsx`: `goToLocked` 삭제, 카드 `onPress={() => navigate(storyDestination(story, auth))}`. 클래스 주석(101-107행)에서 "/parent와 함께 쓴다"·"임시 목적지" 문장을 "카드 목적지는 storyDestination()이 정한다."로 교체.
- `LibraryPage.tsx` 카드: `onPress={() => navigate(storyDestination(story, auth))}`.
- `TutorLibraryPage.tsx` 카드: 같은 방식(기존 주석 "베타 스토리도 /demo가 아니라 상세로" 유지 — 함수가 그렇게 동작).
- `ParentHomePage.tsx` 165·202·219행: `navigate(`/stories/${x.storyId}`)` → `navigate(storyDestination(x, state))`.

`StoryDetailPage.tsx`:
- import 추가: `AppNavShell`(`@/shared/ui`), `dashboardNavItems, libraryPathFor`(`@/entities/auth`), `useBackOr`(`@/shared/lib`), `useLocation`.
- 훅 영역에:
  ```ts
  const { pathname } = useLocation();
  const goBack = useBackOr(state.status === 'authenticated' ? libraryPathFor(state.user) : '/');
  ```
- 기존 `return (<SafeAreaView …> … </SafeAreaView>)`의 내부 본문(← 처음으로 링크 제외)을 `const body = (<>…</>);`로 빼고:
  ```tsx
  if (state.status === 'authenticated') {
    return (
      <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={goBack}>
        {body}
      </AppNavShell>
    );
  }
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Pressable onPress={goBack} accessibilityRole="link" hitSlop={8} style={styles.backLink}>
        <Text style={styles.backLinkText}>← 처음으로</Text>
      </Pressable>
      {body}
    </SafeAreaView>
  );
  ```
  모달 두 개(ChildPickerModal, ClassLessonStartModal)는 `body` 안에 포함한다.
- `toggleBookmark`의 비로그인 분기 `navigate('/login')` → `navigate(`/login?next=${encodeURIComponent(`/stories/${storyId}`)}`)`.

- [ ] **Step 4: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 5: 커밋**

```bash
git add src/features/story-library src/pages/library src/pages/tutor-library src/pages/parent-home src/pages/login src/pages/story-detail
git commit -m "feat(story): 이야기 카드 목적지 통일, 로그인 next 유지, 상세 화면을 탭 셸 안으로

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: 마이페이지 메뉴·설정 화면 막다른 길

**Files:**
- Modify: `fe/src/pages/mypage/ui/MyPage.tsx`
- Modify: `fe/src/pages/mypage-notifications/ui/MyPageNotificationsPage.tsx:33-40`, `fe/src/pages/mypage-privacy/ui/MyPagePrivacyPage.tsx:59-68`, `fe/src/pages/mypage-support/ui/MyPageSupportPage.tsx:21-29`
- Modify: `fe/src/pages/mypage-subscription/ui/MyPageSubscriptionPage.tsx`
- Modify: `fe/src/pages/mypage-delete-account/ui/MyPageDeleteAccountPage.tsx`
- Modify: `fe/src/pages/mypage-account/ui/MyPageAccountPage.tsx:112-119`

**Interfaces:**
- Consumes: `BETA_OPEN_ACCESS_NOTICE`, `subscriptionStatusLabel` (`@/shared/config`), `subscriptionPathFor` (`@/entities/auth`).

이 태스크는 UI 배선이라 단위 테스트 대신 Task 14의 Playwright 점검으로 검증한다.

- [ ] **Step 1: 설정 화면 역할 가드 완화** — 세 파일의 effect 조건을 다음으로:
```ts
  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') navigate('/', { replace: true });
  }, [state, navigate]);
```
`MyPagePrivacyPage`의 `VoiceResearchConsentSection` 렌더가 PARENT 조건으로 감싸져 있는지 확인(아니면 `state.user.role === 'PARENT' ? <VoiceResearchConsentSection …/> : null`). 알림 화면의 수업 알림 2개는 이미 PARENT 조건(파일 상단 주석) — 유지. BE `/v1/me/notification-settings`, `/v1/feedback`은 모든 로그인 역할 허용(확인 완료).
알림 화면 상단 주석의 "학부모와 선생님 모두 사용할 수 있다" → "모든 로그인 역할이 쓸 수 있다".

- [ ] **Step 2: MyPage 메뉴**
- `FeedbackModal` import·`openModal` state·모달 렌더·`onOpenFeedback` prop 전부 제거. 두 메뉴에서 "개선사항 요청" 행 삭제. 상단 주석의 "개선사항 요청만 오버레이 모달로 열린다" 문장 삭제.
- `ParentMenu` 계정 그룹: `<MenuRow label="이용권/결제" …/>` → `label="이용권"`.
- `GenericMenu` 이용권 행:
```tsx
        <MenuRow
          label="이용권"
          hint={user.role === 'PARENT' ? undefined : BETA_OPEN_ACCESS_NOTICE}
          onPress={() => navigate(subscriptionPathFor(user))}
        />
```
  `isOrganizationTutor` 변수가 더 이상 안 쓰이면 삭제.
- 수업 그룹 hint "선생님·기관 연결과 관리" → "반 코드로 반에 연결해요".

- [ ] **Step 3: 이용권 페이지** — `MyPageSubscriptionPage.tsx` 본문:
```tsx
        <SectionHeader title="이용권" />
        <View style={styles.card}>
          <Pill label={subscriptionStatusLabel(user.subscriptionStatus)} />
          <StatusBanner
            label={user.grantsAccess ? '지금 모든 이야기를 이용할 수 있어요.' : '지금은 무료 이야기만 이용할 수 있어요.'}
            variant={user.grantsAccess ? 'info' : 'warning'}
          />
          {user.subscriptionExpiresAt ? <Text style={styles.expiry}>이용권 만료일 · {formatDate(user.subscriptionExpiresAt)}</Text> : null}
          {isParent ? (
            <ActionButton label={user.grantsAccess ? '이용권 연장하기' : '이용권 결제하기'} onPress={() => navigate('/payment/checkout?target=PARENT')} />
          ) : (
            <Text style={styles.note}>{BETA_OPEN_ACCESS_NOTICE}</Text>
          )}
          {user.role === 'DIRECTOR' ? (
            <ActionButton variant="secondaryFull" label="기관 이용권 보기" onPress={() => navigate('/organization/subscription')} />
          ) : null}
        </View>
```
(`secondaryFull` variant는 `JoinClassPage.tsx:103`에서 사용 중.)

- [ ] **Step 4: 탈퇴 이중 확인 제거** — `MyPageDeleteAccountPage.tsx`: `confirming` state와 `<Modal …/>` 삭제, 버튼을
```tsx
          <ActionButton
            label="탈퇴하기"
            variant="stop"
            onPress={handleConfirmDelete}
            loading={deleting}
            disabled={!reasonCategory || deleting}
          />
```
`handleConfirmDelete` 안의 `setConfirming(false)` 호출이 있으면 삭제. 안 쓰는 `Modal` import 정리. (`ActionButton`이 `loading` prop을 받는지 `shared/ui`에서 확인 — 없으면 `label={deleting ? '탈퇴하는 중…' : '탈퇴하기'}`.)

- [ ] **Step 5: 계정 관리의 탈퇴 링크 제거** — `MyPageAccountPage.tsx:112-119`의 `<Pressable …>회원 탈퇴</Pressable>` 블록과 `deleteAccountLink`/`deleteAccountText` 스타일 삭제.

- [ ] **Step 6: 확인·커밋**

Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS
```bash
git add src/pages/mypage src/pages/mypage-notifications src/pages/mypage-privacy src/pages/mypage-support src/pages/mypage-subscription src/pages/mypage-delete-account src/pages/mypage-account
git commit -m "fix(mypage): 관리자·스태프 메뉴 튕김, 관리자 이용권 경로, 탈퇴 이중 확인, 피드백 진입 중복 정리

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: 결제 화면 막다른 길

**Files:**
- Modify: `fe/src/pages/payment-checkout/ui/PaymentCheckoutPage.tsx:30-37,96`
- Modify: `fe/src/pages/payment-fail/ui/PaymentFailPage.tsx`
- Modify: `fe/src/pages/payment-success/ui/PaymentSuccessPage.tsx:21-23,53`

**Interfaces:**
- Consumes: `homePathFor`, `subscriptionPathFor`, `useBackOr`.

- [ ] **Step 1: Checkout** — 리다이렉트 effect를:
```ts
  const location = useLocation();
  useEffect(() => {
    if (state.status === 'anonymous') {
      navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [state.status, navigate, location.pathname, location.search]);
```
`if (!allowed) return null;`을:
```tsx
  if (state.status !== 'authenticated') return null;
  if (!allowed) {
    return (
      <AppNavShell items={dashboardNavItems(state.user, navigate, location.pathname)} onBack={() => navigate(homePathFor(state.user))}>
        <View style={styles.content}>
          <Text style={styles.title} accessibilityRole="header">이 계정으로는 결제할 수 없어요</Text>
          <StatusBanner
            variant="warning"
            label={target === null ? '결제 정보가 올바르지 않아요.' : '보호자 이용권은 보호자 계정에서, 기관 이용권은 기관 관리자 계정에서 결제해요.'}
          />
          <ActionButton label="내 홈으로" onPress={() => navigate(homePathFor(state.user))} />
        </View>
      </AppNavShell>
    );
  }
```
주의: 금지어 "기관 관리자" — 문구를 `'보호자 이용권은 보호자 계정에서, 기관 이용권은 관리자 계정에서 결제해요.'`로 쓴다.
import: `useLocation`, `StatusBanner`, `homePathFor`. Task 3 스크립트가 이미 `const { pathname } = useLocation();`을 넣었다면 `location.pathname` 대신 `pathname`을 쓰고 `useLocation()` 중복 호출을 하나로 합친다.

- [ ] **Step 2: Fail**
```tsx
export function PaymentFailPage() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const { state } = useAuth();
  const [params] = useSearchParams();
  const fallback = state.status === 'authenticated' ? subscriptionPathFor(state.user) : '/';
  const goBack = useBackOr(fallback);

  useEffect(() => {
    if (state.status === 'anonymous') navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true });
  }, [state.status, navigate, pathname, search]);

  if (state.status !== 'authenticated') return null;
  const message = params.get('message') || '결제가 완료되지 않았어요. 결제수단을 확인한 뒤 다시 시도해 주세요.';
  const retryTarget = state.user.role === 'DIRECTOR' ? 'ORGANIZATION' : 'PARENT';

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={goBack}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">결제가 완료되지 않았어요</Text>
        <StatusBanner variant="warning" label={message} />
        <ActionButton label="다시 결제하기" onPress={() => navigate(`/payment/checkout?target=${retryTarget}`)} />
        <ActionButton variant="secondaryFull" label="이용권 관리로 돌아가기" onPress={() => navigate(fallback)} />
      </View>
    </AppNavShell>
  );
}
```
(import: `useEffect`, `useLocation`, `subscriptionPathFor`, `useBackOr`. Task 3에서 이미 `pathname`이 추가됐다면 중복 선언을 합친다.)

- [ ] **Step 3: Success** — 비로그인 리다이렉트를 `navigate(`/login?next=${encodeURIComponent(pathname + search)}`, { replace: true })`로, `AppNavShell`에 `onBack={goBack}` 추가(`const goBack = useBackOr(state.status === 'authenticated' ? subscriptionPathFor(state.user) : '/');`를 조기 return 전에).

- [ ] **Step 4: 확인·커밋**

Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS
```bash
git add src/pages/payment-checkout src/pages/payment-fail src/pages/payment-success
git commit -m "fix(payment): 역할 불일치 안내, 실패 후 다시 결제, 로그인 후 결제 결과로 복귀

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: 온보딩 파라미터 분리 + 튜토리얼에서 역할 선택으로 바로

**Files:**
- Create: `fe/src/pages/home/model/onboarding-params.ts`, `onboarding-params.test.ts`
- Modify: `fe/src/pages/home/ui/HomePage.tsx:11-47,101-106`
- Modify: `fe/src/features/onboarding/ui/onboarding-flow.tsx` (`ROLE_CARDS`, `DISPLAY_NAME_PLACEHOLDER`)
- Modify: `fe/src/pages/home/ui/HomePage.tsx` `ROLE_OPTIONS`
- Modify: `fe/src/pages/signup/ui/SignupPage.tsx`

**Interfaces:**
- Produces: `type OnboardingEntry = { step: 'welcome' | 'role' | 'sign-up' | 'sign-in'; role?: 'PARENT'|'DIRECTOR'|'TUTOR'; classCode?: string; next?: string }`; `safeNextPath(value: string | null): string | undefined`; `readOnboardingParams(params: URLSearchParams): OnboardingEntry | null`.

- [ ] **Step 1: 실패하는 테스트** — `onboarding-params.test.ts`
```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { readOnboardingParams, safeNextPath } from './onboarding-params';

const read = (qs: string) => readOnboardingParams(new URLSearchParams(qs));

test('역할 없이 가입으로 오면 역할 선택부터', () => {
  assert.deepEqual(read('flow=sign-up'), { step: 'role', next: undefined });
});

test('역할이 있으면 가입 폼으로, next를 싣는다', () => {
  assert.deepEqual(read('flow=sign-up&role=tutor&next=%2Forg-invite%2Fabc'), {
    step: 'sign-up', role: 'TUTOR', classCode: undefined, next: '/org-invite/abc',
  });
});

test('외부로 튕기는 next는 버린다', () => {
  assert.equal(safeNextPath('//evil.com'), undefined);
  assert.equal(safeNextPath('/\\evil.com'), undefined);
  assert.equal(safeNextPath('https://evil.com'), undefined);
  assert.equal(safeNextPath('/ok path'), undefined);
  assert.equal(safeNextPath('/stories/HG'), '/stories/HG');
});

test('알 수 없는 flow는 null', () => {
  assert.equal(read('flow=x'), null);
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/pages/home/model/onboarding-params.test.ts` → FAIL

- [ ] **Step 3: 구현** — `onboarding-params.ts` (HomePage의 `OnboardingEntry`, `safeNextPath`, `readOnboardingParams`를 옮기고 수정)
```ts
export type OnboardingEntry = {
  step: 'welcome' | 'role' | 'sign-up' | 'sign-in';
  role?: 'PARENT' | 'DIRECTOR' | 'TUTOR';
  /** 반 초대 링크(/join?code=)에서 "계정 만들기"로 왔을 때 보호자 가입 폼에 미리 채울 반 코드. */
  classCode?: string;
  /** 로그인·가입 뒤 돌아갈 앱 내부 경로(반 초대 링크, 기관 초대 수락 등). */
  next?: string;
};

/** 로그인 뒤 돌아갈 경로는 앱 내부 경로만 받는다 - 외부 주소로 튕기는 오픈 리다이렉트를 막는다. */
export function safeNextPath(value: string | null): string | undefined {
  // "/\evil.com"은 브라우저가 "//evil.com"으로 읽고, 탭·줄바꿈은 지워진다 - 백슬래시와 공백 문자도 거절한다.
  return value && /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : undefined;
}

/**
 * `?flow=sign-in|sign-up|welcome` + 선택적 `?role=parent|organization|tutor` (+ `classCode`, `next`)를
 * OnboardingEntry로 정규화한다. 역할 없이 가입으로 오면(튜토리얼의 "회원가입하기") 가입/로그인을 다시
 * 묻지 않고 역할 선택부터 보여 준다.
 */
export function readOnboardingParams(params: URLSearchParams): OnboardingEntry | null {
  const flow = params.get('flow');
  if (flow !== 'sign-in' && flow !== 'sign-up' && flow !== 'welcome') return null;
  const next = safeNextPath(params.get('next'));
  if (flow === 'sign-in') return { step: 'sign-in', next };
  if (flow === 'welcome') return { step: 'welcome' };
  const roleParam = params.get('role');
  const role: OnboardingEntry['role'] =
    roleParam === 'organization' ? 'DIRECTOR'
      : roleParam === 'tutor' ? 'TUTOR'
        : roleParam === 'parent' ? 'PARENT'
          : undefined;
  const classCode = params.get('classCode')?.trim().toUpperCase() || undefined;
  return role ? { step: 'sign-up', role, classCode, next } : { step: 'role', next };
}
```
`HomePage.tsx`: 옮긴 세 정의를 삭제하고 `import { readOnboardingParams, type OnboardingEntry } from '../model/onboarding-params';`. `<OnboardingFlow …>`의 `signInNext={onboarding.next}`를 `signInNext={onboarding.step === 'sign-in' ? onboarding.next : undefined}`로 바꾼다(가입용 `signUpNext` 전달은 Task 9 Step 3).
`OnboardingFlow`의 `OnboardingStep`에 이미 `'role'`이 있으므로 `initialStep={onboarding.step}` 그대로 동작.

`SignupPage.tsx`: next 전달
```tsx
  const nextParam = searchParams.get('next');
  if (nextParam) qs.set('next', nextParam);
```

역할 카드 문구: `onboarding-flow.tsx` `ROLE_CARDS` PARENT `title: '보호자'`, `description: '아이와 함께 이야기 서재를 쓰고, 리포트를 받아요.'`; DIRECTOR `title: '기관'`. `DISPLAY_NAME_PLACEHOLDER.PARENT: '아이에게 보일 보호자 이름'`. HomePage `ROLE_OPTIONS` PARENT `label: '보호자'`, DIRECTOR `label: '기관'`, 위 주석의 "기관 및 단체" 언급을 "기관"으로.

- [ ] **Step 4: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 5: 커밋**
```bash
git add src/pages/home src/pages/signup src/features/onboarding
git commit -m "feat(onboarding): 튜토리얼 가입은 역할 선택부터, 가입 next 전달 경로 마련

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: 기관 초대 — 비로그인 수락 후 초대 화면으로 복귀

**Files:**
- Modify: `fe/src/pages/org-invite-accept/ui/OrgInviteAcceptPage.tsx:66-71,123-125`
- Modify: `fe/src/features/onboarding/ui/onboarding-flow.tsx` (props, `onSignedUp`)
- Modify: `fe/src/pages/home/ui/HomePage.tsx` (`signUpNext` 전달)
- Modify: `fe/src/pages/onboarding-tutor/ui/OnboardingTutorPage.tsx:84`

**Interfaces:**
- Consumes: `OnboardingEntry.next` (Task 8).
- Produces: `OnboardingFlowProps.signUpNext?: string`; 순수 함수 `afterSignUpPath(role: OnboardingRole, signUpNext: string | undefined): string` (onboarding-flow 모듈 안 `features/onboarding/model/after-sign-up.ts`).

- [ ] **Step 1: 실패하는 테스트** — `fe/src/features/onboarding/model/after-sign-up.test.ts`
```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { afterSignUpPath } from './after-sign-up';

test('초대받아 가입한 선생님은 소속 설정 대신 초대 수락 화면으로', () => {
  assert.equal(afterSignUpPath('TUTOR', '/org-invite/abc'), '/org-invite/abc');
});

test('초대 없이 가입하면 역할별 온보딩으로', () => {
  assert.equal(afterSignUpPath('TUTOR', undefined), '/onboarding/tutor');
  assert.equal(afterSignUpPath('PARENT', undefined), '/onboarding/parent');
  assert.equal(afterSignUpPath('DIRECTOR', undefined), '/organization');
});

test('보호자의 next는 아이 등록 뒤에 쓰므로 온보딩부터', () => {
  assert.equal(afterSignUpPath('PARENT', '/join?code=AB12'), '/onboarding/parent');
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/features/onboarding/model/after-sign-up.test.ts` → FAIL

- [ ] **Step 3: 구현**

`after-sign-up.ts`:
```ts
type OnboardingRole = 'PARENT' | 'DIRECTOR' | 'TUTOR';

/**
 * 가입 직후(캐러셀 뒤) 갈 곳. 기관 초대 링크로 가입한 선생님은 소속 설정 온보딩을 건너뛰고 초대 수락
 * 화면으로 돌아간다 - 그 화면이 소속을 완성한다. 보호자의 next(반 연결)는 아이 등록 뒤에 쓴다.
 */
export function afterSignUpPath(role: OnboardingRole, signUpNext: string | undefined): string {
  if (role === 'TUTOR') return signUpNext ?? '/onboarding/tutor';
  if (role === 'PARENT') return '/onboarding/parent';
  return '/organization';
}
```
(DIRECTOR 홈은 `homePathFor`와 같은 `/organization`.)

`onboarding-flow.tsx`:
- props 타입에 `/** 가입 뒤 돌아갈 앱 내부 경로(기관 초대 수락 등). */ signUpNext?: string;` 추가, 구조분해에 `signUpNext`.
- `onSignedUp`의 `nextAfterCarousel` 계산을 `const nextAfterCarousel = afterSignUpPath(user.role as OnboardingRole, signUpNext);`로 교체(`user.role`이 STAFF일 수 없는 흐름 — 기존 삼항과 동일 범위). 의존성 배열에 `signUpNext`.

`HomePage.tsx`의 `<OnboardingFlow>`에 `signUpNext={onboarding.step === 'sign-in' ? undefined : onboarding.next}`.

`OrgInviteAcceptPage.tsx`:
- `const location = useLocation();`(import 추가) 후 비로그인 분기:
```ts
      navigate(`/signup?role=tutor&next=${encodeURIComponent(location.pathname)}`);
```
  주석 "IA 상 신규 계정 만들며 수락은 지원 범위 밖" → "가입을 마치면 이 화면으로 돌아와 수락한다."
- 본문 문구 "필요할 땐 마이페이지에서 소속을 해제할 수 있어요." → "소속 해제가 필요하면 관리자에게 요청해 주세요."

`OnboardingTutorPage.tsx:84` 문구 → "지금 결정하지 않아도 돼요. 기관 소속은 나중에 마이페이지 &gt; 소속에서 추가할 수 있어요."

- [ ] **Step 4: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 5: 커밋**
```bash
git add src/features/onboarding src/pages/home src/pages/org-invite-accept src/pages/onboarding-tutor
git commit -m "fix(invite): 비로그인 기관 초대 수락 시 가입 후 초대 화면으로 복귀, 소속 해제 안내 정정

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: 관리자 반 상세 초대 카드, 반 초대 링크 비보호자 안내, 선생님 서재 부제목

**Files:**
- Modify: `fe/src/pages/organization-class-detail/ui/OrganizationClassDetailPage.tsx:92-101`
- Modify: `fe/src/pages/join-class/ui/JoinClassPage.tsx:108-113`
- Modify: `fe/src/pages/tutor-library/ui/TutorLibraryPage.tsx:129`

- [ ] **Step 1: 관리자 반 상세** — import `InviteCodeCard, classInviteLink, classInviteShareMessage` from `@/features/invite-issue`. 반 코드 `metaRow`와 설명 `Text`를 다음으로 교체(제목 `Text`는 유지):
```tsx
            </View>

            <InviteCodeCard
              reusable
              shortCode={load.classGroup.joinCode}
              link={classInviteLink(load.classGroup.joinCode)}
              shareMessage={classInviteShareMessage(load.classGroup.name)}
            />
```
즉 첫 카드는 제목만 남기고, 카드 바로 뒤에 `InviteCodeCard`를 둔다. 안 쓰게 된 `metaRow`/`metaLabel`/`metaValue` 스타일은 다른 곳에서 쓰지 않으면 삭제.

- [ ] **Step 2: 반 초대 링크 비보호자** — `JoinClassPage.tsx` 비보호자 카드:
```tsx
          <View style={styles.card}>
            <Text style={styles.cardTitle}>반 초대 링크는 보호자 계정에서 열 수 있어요</Text>
            <Text style={styles.note}>지금은 보호자가 아닌 계정으로 로그인돼 있어요. 보호자에게 이 링크를 전달하거나, 보호자 계정으로 다시 열어 주세요.</Text>
            <ActionButton variant="gold" label="내 홈으로" onPress={() => navigate(homePathFor(state.user))} />
            <ActionButton variant="secondaryFull" label="로그아웃" onPress={logout} />
          </View>
```
(`homePathFor` import.)

- [ ] **Step 3: 선생님 서재 부제목** — `'다음 수업에 어떤 이야기를 쓸지 미리 살펴보고, 학생별로 담아 두세요.'` → `'다음 수업에 쓸 이야기를 미리 살펴보고 저장해 두세요.'`

- [ ] **Step 4: 확인·커밋**

Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS
```bash
git add src/pages/organization-class-detail src/pages/join-class src/pages/tutor-library
git commit -m "fix(class): 관리자 반 상세에 초대 공유 카드, 비보호자 반 링크 안내, 서재 문구 정정

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: 보호자 온보딩 "나중에"와 이어 읽기 날짜

**Files:**
- Create: `fe/src/shared/lib/relative-day.ts`, `relative-day.test.ts`
- Modify: `fe/src/shared/lib/index.ts`
- Modify: `fe/src/pages/onboarding-parent/ui/OnboardingParentPage.tsx:94-104`
- Modify: `fe/src/pages/parent-home/ui/ParentHomePage.tsx:177-180`

**Interfaces:**
- Produces: `relativeDayLabel(iso: string, now?: Date): string` → `'오늘'` | `'어제'` | `'N일 전에'`.

- [ ] **Step 1: 실패하는 테스트**
```ts
/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { relativeDayLabel } from './relative-day';

const now = new Date(2026, 9, 1, 9, 0); // 2026-10-01 09:00 (로컬)

test('같은 날은 오늘', () => {
  assert.equal(relativeDayLabel(new Date(2026, 9, 1, 0, 5).toISOString(), now), '오늘');
});

test('달력상 전날은 시간 차이와 상관없이 어제', () => {
  assert.equal(relativeDayLabel(new Date(2026, 8, 30, 23, 50).toISOString(), now), '어제');
});

test('그 이전은 N일 전에', () => {
  assert.equal(relativeDayLabel(new Date(2026, 8, 27, 12, 0).toISOString(), now), '4일 전에');
});

test('미래·잘못된 값은 오늘로 접는다', () => {
  assert.equal(relativeDayLabel(new Date(2026, 9, 2).toISOString(), now), '오늘');
  assert.equal(relativeDayLabel('not-a-date', now), '오늘');
});
```

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/shared/lib/relative-day.test.ts` → FAIL

- [ ] **Step 3: 구현**
```ts
const DAY_MS = 24 * 60 * 60 * 1000;

/** "오늘/어제/N일 전에" - 달력 날짜(로컬) 기준. "이어서 읽기"처럼 문장 가운데에 넣는다. */
export function relativeDayLabel(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '오늘';
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
  if (days <= 0) return '오늘';
  if (days === 1) return '어제';
  return `${days}일 전에`;
}
```
`shared/lib/index.ts`에 `export * from './relative-day';`.

`ParentHomePage.tsx` 이어서 읽기 subtitle:
```tsx
              subtitle={`${progress.childName || displayName}님이 ${relativeDayLabel(progress.savedAt)} 읽던 이야기예요.`}
```

`OnboardingParentPage.tsx`: "나중에" Pressable을 `step === 'child'`일 때만 렌더하고 동작을 동의 단계 이동으로:
```tsx
        {step === 'child' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="아이 등록 나중에 하기"
            onPress={() => setStep('consent')}
            hitSlop={8}
          >
            <Text style={styles.skipLabel}>나중에</Text>
          </Pressable>
        ) : null}
```
(`setStep`이 `rawStep` setter 이름과 같은지 확인 — 74행 `setStep('consent')` 사용 중.)

- [ ] **Step 4: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 5: 커밋**
```bash
git add src/shared/lib src/pages/onboarding-parent src/pages/parent-home
git commit -m "fix(parent): 온보딩 나중에가 필수 동의를 건너뛰지 않게, 이어 읽기 날짜를 실제 값으로

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: 플레이어 — 이어듣기 대상 이야기 필터, 하드코딩 이야기 이름, 조사

**Files:**
- Modify: `fe/src/entities/analytics/model/local-story-progress.ts` (+ 기존 test 파일에 케이스 추가)
- Modify: `fe/src/pages/one-story/model/use-one-story-runtime.ts:223-224`
- Modify: `fe/src/pages/one-story/ui/reader-card/processing-panel.tsx:28-39`, `generating-branch-panel.tsx:19-25`, `awaiting-choice-panel.tsx:30-36`, `reader-card.tsx:51`, `fe/src/pages/one-story/ui/OneStoryPage.tsx:65`

**Interfaces:**
- Produces: `resumableProgressFor(progress: LocalStoryProgress | null, storyId: string): LocalStoryProgress | null`.

- [ ] **Step 1: 실패하는 테스트** — `local-story-progress.test.ts`에 추가(파일 상단 import에 `resumableProgressFor` 추가)
```ts
test('다른 이야기의 진행 기록은 이어듣기 후보가 아니다', () => {
  const progress = { storyId: 'HG' } as LocalStoryProgress;
  assert.equal(resumableProgressFor(progress, 'HG'), progress);
  assert.equal(resumableProgressFor(progress, 'OTHER'), null);
  assert.equal(resumableProgressFor(null, 'HG'), null);
});
```
(`LocalStoryProgress` 타입 import가 없으면 `import type { LocalStoryProgress } from './local-story-progress';` 추가.)

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/entities/analytics/model/local-story-progress.test.ts` → FAIL

- [ ] **Step 3: 구현**

`local-story-progress.ts`:
```ts
/** 저장된 진행 기록이 지금 연 이야기의 것일 때만 이어듣기 후보로 쓴다 - 저장소에는 한 건만 남는다. */
export function resumableProgressFor(
  progress: LocalStoryProgress | null,
  storyId: string,
): LocalStoryProgress | null {
  return progress && progress.storyId === storyId ? progress : null;
}
```
(entities/analytics index가 `export *`인지 확인.)

`use-one-story-runtime.ts:223-224`:
```ts
  const [resumeCandidate, setResumeCandidate] =
    useState<LocalStoryProgress | null>(() => resumableProgressFor(loadLocalStoryProgress(), storyPackage.storyId));
```
(import에 `resumableProgressFor` 추가.)

로딩 문구 — 세 패널에서 `const storyTitle = runtime.storyPackage.manifest.title;`(구조분해 목록에 `storyPackage` 추가 가능) 후 `헨젤과 그레텔이{'\n'}` → `{withParticle(storyTitle, '이/가')}{'\n'}` (`import { withParticle } from '@/shared/lib';`). 예:
```tsx
          <>
            {withParticle(storyTitle, '이/가')}{'\n'}
            대답을 준비하고 있어요
          </>
```
(`runtime.storyPackage`가 `OneStoryRuntime` 타입에 노출되는지 — 훅 return 1948행 근처 `storyPackage,` 확인됨.)

`OneStoryPage.tsx:65`: `` `${scene?.title ?? '헨젤과 그레텔'} 삽화` `` → `` `${scene?.title ?? runtime.storyPackage.manifest.title} 삽화` ``.

`reader-card.tsx:51`: `` `${speaker?.displayName ?? '이야기 친구'}이 묻고 있어요` `` → `` `${withParticle(speaker?.displayName ?? '이야기 친구', '이/가')} 묻고 있어요` ``.

- [ ] **Step 4: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS. 추가로 `grep -rn "헨젤과 그레텔" src/pages/one-story/ui` → 결과 없음.

- [ ] **Step 5: 커밋**
```bash
git add src/entities/analytics src/pages/one-story
git commit -m "fix(player): 다른 이야기의 이어듣기 창 방지, 이야기 이름 하드코딩 제거, 조사 처리

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: 금지어 일괄 교체 + 재발 방지 테스트

**Files:**
- Modify: `fe/src/shared/config/glossary.test.ts`
- Modify: 금지어가 남은 모든 `src/**/*.ts(x)` (테스트 실패 목록 기준)

- [ ] **Step 1: 실패하는 테스트** — `glossary.test.ts`에 추가
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { BANNED_UI_TERMS } from './glossary';

const SRC_ROOT = join(import.meta.dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.ts$/.test(name) && !path.endsWith('glossary.ts') ? [path] : [];
  });
}

/** 블록 주석·줄 주석을 지운다(URL의 "://"는 남긴다). 문구 검사 대상은 코드에 남은 문자열·JSX 텍스트다. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('화면 문구에 금지어가 없다', () => {
  const hits: string[] = [];
  for (const file of sourceFiles(SRC_ROOT)) {
    const code = stripComments(readFileSync(file, 'utf8'));
    code.split('\n').forEach((line, index) => {
      for (const term of BANNED_UI_TERMS) {
        if (line.includes(term)) hits.push(`${relative(SRC_ROOT, file)}:${index + 1} "${term}"`);
      }
    });
  }
  assert.deepEqual(hits, []);
});
```
(Node v24 확인됨 — `import.meta.dirname` 사용 가능. 주석 제거 후 줄 번호가 원본과 어긋날 수 있다 — 블록 주석 치환을 `m => m.replace(/[^\n]/g, '')`로 바꿔 줄 수를 유지한다:
`source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''))`.)

- [ ] **Step 2: 실패 확인** — Run: `cd fe && npx tsx --test src/shared/config/glossary.test.ts` → FAIL, 금지어 위치 목록 출력.

- [ ] **Step 3: 목록대로 교체** — 규칙:
  - 학부모 → 보호자 (예: "학부모 계정" → "보호자 계정", "학부모님" → "보호자")
  - 부모 리포트 → 보호자 리포트
  - 구독 → 이용권 (예: "구독하고 잠금 해제" → "이용권으로 잠금 해제", "구독 후 열려요" → "이용권이 있으면 열려요", "이 작품을 이용하려면 구독이 필요해요" 류 FE 메시지 → "이 이야기는 이용권이 있어야 열려요")
  - 원장 / 기관 관리자 → 관리자
  - 라이선스 → 이용권 (예: "이용권 · 라이선스" → "이용권")
  - 완주 기록 → 리포트 (예: "완주 기록" 섹션 제목 → "리포트")
  - 부모 확인 대기 / 부모 연결 대기 / 연결 안 됨 / "학부모 연결 대기 중" / "연결 대기"(PENDING 표기) → 보호자 연결 대기
  - 기관 및 단체 → 기관
  - 식별자·URL·API 필드명(영문)은 건드리지 않는다. BE가 내려주는 에러 문구는 FE의 `shared/api/error-messages.ts` 매핑 쪽만 바꾼다.
  - "연결 대기" 단독 표기(`TutorClassGroupPage.tsx:108`)는 금지어 목록에 없지만 같은 개념이므로 "보호자 연결 대기"로 함께 바꾼다.

- [ ] **Step 4: 통과 확인** — Run: `cd fe && npm run typecheck && npm run lint && npm test` → PASS

- [ ] **Step 5: 커밋**
```bash
git add src
git commit -m "chore(copy): 용어 사전 기준으로 화면 문구 일괄 교체, 금지어 재발 방지 테스트

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: 통합 점검(Playwright) + 스펙 대비 확인

**Files:** 없음(점검만). 문제 발견 시 해당 태스크 파일 수정 후 별도 커밋.

- [ ] **Step 1: 전체 검사** — Run: `cd fe && npm run typecheck && npm run lint && npm test && npm run build` → 모두 PASS. `cd be && ./gradlew test` → PASS.

- [ ] **Step 2: 로컬 실행** — BE(`./gradlew bootRun`, dev 프로필)와 FE(`npm run dev`)를 띄운다. 계정이 필요하면 가입 화면에서 역할별로 새로 만든다.

- [ ] **Step 3: Playwright 점검표** (각 항목 스크린샷을 스크래치 폴더에 저장)
  1. 관리자 로그인 → 마이페이지의 모든 메뉴 클릭 → 홈으로 튕기는 메뉴 0개, "이용권" → `/organization/subscription`.
  2. 관리자 하위 화면 6개에서 하단 탭/사이드바 강조가 각자 탭인지.
  3. 개인 선생님 로그인 → 서재의 유료 이야기 → 상세로 열림(잠금 없음, 베타 개방). 이용권 화면에 베타 안내 문구.
  4. 보호자(이용권 없음) → 서재 유료 이야기 → `/mypage/subscription`. 서재 HG → `/stories/HG`(데모·연락처 창 없음).
  5. 비로그인 → 유료 카드 → 로그인 → 해당 상세로 복귀.
  6. 비로그인으로 `/org-invite/code/<코드>` → 수락 → 가입 → 캐러셀 → 초대 수락 화면 복귀(코드 재입력 없음).
  7. 튜토리얼 끝 "회원가입하기" → 역할 선택 화면이 바로 나옴.
  8. 보호자 온보딩 "나중에" → 동의 화면으로, 동의 화면엔 "나중에" 없음.
  9. 리포트 상세를 URL로 직접 열고 뒤로 → 리포트 목록(앱 밖으로 안 나감).
  10. 결제 실패 화면 → "다시 결제하기" 버튼 존재.
  11. 이야기 A를 듣다 나간 뒤 이야기 B 플레이어 진입 → 이어듣기 창 없음.
  12. 회원 탈퇴 화면 → 확인 모달 없이 버튼 한 번(실제 탈퇴는 테스트 계정으로만).

- [ ] **Step 4: 마무리** — 발견 사항이 없으면 FE·BE 브랜치를 push하고 PR 생성(사용자 확인 후). 메모리 규칙: 배포는 하되 Linear 이슈는 In Review.

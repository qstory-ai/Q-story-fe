# UX 후속 정리 (Q-35·36·37 이후) — Spec + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Q-35·36·37 머지 이후 재조사(2026-10-08)에서 나온 남은 문제를 고친다. 데이터 정확성(멈춘 회차, 이어 읽기 기록) → 시작·완주 흐름 → 반 상세 보강 → 작은 정리 순.

## 결정 사항 (2026-10-08 승인)
1. **멈춘 회차 표시**: 목록 응답의 `endStatus`(BE `StoryCompletionSummary`)를 FE 타입에 추가. 리포트 목록·홈 "최근 리포트"는 멈춘 회차에 "멈춤" 배지. 서재 "읽은 작품"·종합 통계는 완주(`COMPLETED`)만.
2. **이어 읽기 기록**: 로컬 진행 저장 키를 사용자별(`…progress.v1.{userId}`, 비로그인은 기존 키)로. 로그아웃 시 진행·선택 아이 삭제. 홈 "이어서 읽기"·서재 "읽는 중"은 현재 선택된 아이의 진행만. 기록의 childId가 내 아이 목록에 없으면 버림. 완주 상태에 도달하면(나가기 여부와 무관하게) 진행 삭제. 부제 "…님이" → 아이 이름에 맞는 호칭(withParticle, "님" 제거).
3. **시작 흐름**: 아이 선택 창에서 새 아이 등록 후 바로 그 아이로 시작(onSelected 호출). 서재 "읽는 중" 카드는 상세를 거치지 않고 바로 이어 읽기. 홈 히어로로 들어왔는데 같은 이야기 진행이 있으면 바로 이어 읽기. iOS: 홈/상세의 시작 탭 순간에 응답 오디오 프라이밍(`primeResponseAudio`)과 낭독 오디오 언락을 수행.
4. **완주 화면**: 제목을 리포트 버튼과 맞게("오늘 함께 읽었어요" 등), 리포트 안 1차 버튼은 "홈으로", 후기 버튼은 보조. 완주 후 "다시 읽기"는 확인 없이. UT 회차 코드는 UT 플래그(쿼리/환경)일 때만.
5. **반 상세 보강**: 반 상세(`ClassDetailPage`)에 이 반의 최근 리포트 목록(최신순, 진행 선생님·날짜·멈춤 배지)과 수업 목록(선생님만), "수업 만들기" 버튼(LessonFormModal을 이 반으로 미리 선택). 관리자는 리포트 목록만.
6. **관리자 작은 것**: 반 만든 뒤 반 상세로 이동. 리포트 탭 "최근 활동"에 반 이름. 선생님 상세의 학생·수업 줄 누르면 이동.
7. **가입 폼(작게)**: 역할 단계를 건너뛴 경우 "2 / 2" 표기 숨김, 비밀번호 확인 칸 → "보기" 토글, 동의에 "모두 동의" 버튼. 아이디는 유지.
8. **보호자 '아이 이름' 필드 삭제**: 내 정보·계정 화면의 옛 `childName` 입력 제거(아이 관리로 일원화). 서버 필드는 남겨도 됨.
9. **정리**: 문구 "부모/부모님" → "보호자"(선생님 화면 3곳 등), MyPage 주석·안 쓰는 분기, SUPPORT_EMAIL 상수 통일, BE 보호자 주문명 "(30일)" → `accessDays` 기반.
**보류:** 환불 기능·약관 URL·FAQ·아이디 제거·선생님 이용권 메뉴 숨김·리포트 탭 구조 개편.

## API 계약 (BE·FE)
```jsonc
// 신규: GET /v1/classes/{classId}/reports?limit=20
// 권한: 이 반의 담임 선생님, 이 반 기관의 관리자 (그 외 403/404 기존 패턴)
// 응답: 기존 학생 리포트 목록과 같은 요약 항목 배열(StoryCompletionSummary 형태, endStatus 포함),
//       각 항목에 진행 선생님 이름(tutorName), 참여 학생 이름 목록(studentNames) 추가 가능
// 변경: 기관 최근 활동 항목(OrganizationUsageRecentActivity)에 className(nullable) 추가
```

## Global Constraints
- 커밋에 `Co-Authored-By` 넣지 않음. push 금지.
- FE 검사: `npm run typecheck && npm run lint && npm test && npm run build` (파이프 없이, 종료 코드 확인). BE: system gradle `/d/gradle/gradle-9.2.0/bin/gradle`, JAVA_HOME `C:\Users\yooni\.jdks\ms-21.0.9`, `subst T:` 드라이브.
- 금지어 스캔 통과. 아동 UX 44px, 짧은 문구.
- 브랜치: fe `feat/ux-followups`, be `feat/class-reports`.

## Review Focus
1. 같은 기기에서 계정을 바꿔도 이전 계정의 진행·아이가 보이지 않아야 한다.
2. 멈춘 회차가 통계·"읽은 작품"에 세지지 않고, 리포트 목록에서는 사라지지 않고 "멈춤"으로 보여야 한다.
3. 반 리포트 API가 다른 기관·다른 담임에게 새지 않아야 한다(가정 기록 제외).
4. iOS에서 홈 탭 한 번으로 첫 낭독이 나와야 한다(실기기 확인 항목으로 보고).

---

### Task 1 (BE): 반 리포트 목록 API + 최근 활동 반 이름 + 주문명
- [ ] `GET /v1/classes/{classId}/reports` (ClassController, 서비스·리포지토리 쿼리: 반 수업 회차, 가정 기록 제외, 최신순, limit 기본 20 최대 50). 권한 테스트(담임 OK, 다른 선생님/다른 기관 관리자 거부, 관리자 OK).
- [ ] `OrganizationUsageRecentActivity.className` 추가.
- [ ] `PaymentService` 보호자 주문명 "(30일)" → `accessDays`.
- [ ] 커밋.

### Task 2 (FE): 멈춘 회차 표시
`entities/story-completion/api` 타입에 `endStatus`, 리포트 목록·홈 최근 리포트 배지, 서재 읽은 작품·종합 통계 완주만. 순수 필터 함수 테스트.

### Task 3 (FE): 이어 읽기 기록 계정·아이별
`entities/analytics/model/local-story-progress.ts`, `current-user.tsx`(로그아웃), `ParentHomePage`, `LibraryPage`, `play-path.ts`, 완주 시 삭제. 키 결정·필터 순수 함수 테스트(계정 전환, 아이 불일치).

### Task 4 (FE): 시작 흐름 + 완주 화면
결정 3·4. 아이 선택 창 등록 후 시작, 서재 읽는 중 바로 이어 읽기, 히어로+진행 바로 이어 읽기, iOS 오디오 프라이밍(탭 핸들러 안), 완주 화면 문구·버튼·확인 제거·UT 코드 플래그. 순수 로직(시작 경로 결정) 테스트.

### Task 5 (FE): 반 상세 보강 + 관리자 작은 것
결정 5·6. Task 1 API 사용. 반 리포트 목록 컴포넌트, 수업 목록(선생님), "수업 만들기"(LessonFormModal 반 미리 선택), 관리자 반 생성 후 상세 이동, 최근 활동 반 이름, 선생님 상세 줄 링크.

### Task 6 (FE): 가입 폼 + 아이 이름 필드 + 정리
결정 7·8·9(FE 부분).

### Task 7: 통합 점검·최종 리뷰

# 개인정보 수정 + 음성 인식 장애 대응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 음성 원본 1년·동의 시에만 저장, 약관 동의 기록, 회원 탈퇴 시 실제 삭제와 아이 프로필 마스킹, 출시 알림 거절 시 전화번호 미저장, 음성 인식 업체 장애 감지와 아이 화면 안내.

**Architecture:** BE에 `user_consent` 이력 테이블과 동의 페이로드를 추가하고 가입 경로(일반, 반 초대, OAuth 신규)에서 필수 동의를 강제한다. 음성 연구는 기본 꺼짐으로 바꾸고 보호자의 명시 동의일 때만 업로드를 받는다. 탈퇴는 계정 행을 익명화하고 딸린 데이터를 삭제한다. STT 업체의 재시도 불가 오류는 `STT_UNAVAILABLE`(503)로 구분해 FE가 글 질문으로 안내한다.

**Tech Stack:** BE Spring Boot 3 / JPA / Flyway(`db/schema/NNN-*.sql`, 다음 번호 066) / JUnit5+Mockito. FE React19 + react-native-web / `tsx --test`.

**Spec(대화로 승인된 설계, 2026-10-07):** 이 문서의 "결정 사항"이 스펙이다. 배경 조사: `qstory/legal/00-공개-전-확인사항.md`.

## 결정 사항 (스펙)
1. 음성 원본: 보관 365일. 저장 기본값 꺼짐. **보호자 계정이 명시적으로 동의한 경우에만** 원본 업로드를 받는다. 비로그인 체험·선생님/관리자 세션은 저장하지 않는다. 음성 인식 결과 문장(대화 원장)은 동의와 무관하게 1년 보관(기존 동작 유지).
2. 보호자 온보딩 동의 단계: "리포트 표시 범위"는 필수, "아이 음성 원본 보관(1년)"은 **선택 체크박스**. 체크 시 음성 동의 API 호출.
3. 동의 기록: `user_consent`에 (user_id, consent_type, version, agreed, source, created_at) 이력 저장. 타입: `TERMS, PRIVACY, MARKETING, CHILD_REPORT_SCOPE, VOICE_RAW`. 출처: `SIGNUP, OAUTH_SIGNUP, CLASS_JOIN_SIGNUP, ONBOARDING, MYPAGE`.
4. 가입 시 필수 동의(TERMS, PRIVACY) 없으면 400 `CONSENT_REQUIRED`. 마케팅 동의값을 가입 트랜잭션에서 `notification_settings.marketing_enabled`로 저장. 마케팅 엔티티 기본값 false. 소셜 버튼은 약관 체크 전 비활성.
5. 탈퇴: 계정 행은 남기되 익명화(결제 기록 5년 보관용). 딸린 데이터 삭제, 아이 프로필은 가입 기록만 남기고 마스킹. 역할별 처리는 Task 4.
6. 출시 알림: `wantsContact=false`면 전화번호를 저장하지 않는다(받아도 무시). DB `phone` nullable. FE는 "괜찮아요" 경로에서 전화번호를 필수로 요구하지 않는다.
7. STT: RTZR가 재시도 불가 4xx(결제·인증·권한 계열, 예: `H0001 Card registration is required`, 401/403)를 주면 ERROR 로그 `stt.provider-unavailable code=… status=…` + 503 `STT_UNAVAILABLE`. FE는 아이 화면에 "지금은 말로 질문하기가 어려워요. 글로 물어봐 줄래?"를 보여 주고 글 질문 입력으로 전환.

## API 계약 (BE·FE 공통, 정확히 이 이름)
```jsonc
// 가입 요청 공통 필드 (signup/parent|tutor|organization, classes/join, oauth google|kakao)
"consents": { "version": "2026-10-v1", "terms": true, "privacy": true, "marketing": false }
// OAuth: 기존 계정 로그인은 consents 불필요. 신규 생성 시 없거나 필수 false면 400 CONSENT_REQUIRED.

// POST /v1/me/consents  (로그인 필요) → 204
{ "source": "ONBOARDING", "items": [ { "type": "CHILD_REPORT_SCOPE", "agreed": true, "version": "2026-10-v1" } ] }

// 실패 응답: 기존 FailureBody 형식, code 값
"CONSENT_REQUIRED" (400), "STT_UNAVAILABLE" (503)
```
FE 상수: `CONSENT_VERSION = '2026-10-v1'` (`src/shared/config/glossary.ts` 옆이 아니라 `src/entities/auth/model/consent.ts`).

## Global Constraints
- 커밋 메시지에 `Co-Authored-By` 줄을 넣지 않는다.
- 적용된 마이그레이션 파일은 수정하지 않고 새 번호(066~)로 추가.
- BE 테스트 실행: `/d/gradle/gradle-9.2.0/bin/gradle test`, `JAVA_HOME=C:\Users\yooni\.jdks\ms-21.0.9`, 한글 경로 문제로 `subst T: "C:\Users\yooni\OneDrive\바탕 화면\qstory"` 후 `T:\be`에서 실행, 끝나면 `subst T: /d`.
- FE 검사: `npm run typecheck && npm run lint && npm test` (금지어 스캔 포함: 학부모, 구독, 원장, 기관 관리자 등).
- 브랜치: be `feat/privacy-consent`, fe `feat/privacy-consent`. push 금지.

## Review Focus
1. 이미 가입한 OAuth 사용자가 동의 없이 로그인할 때 막히지 않아야 한다(신규 생성만 검사).
2. 탈퇴 후 같은 이메일·소셜 계정으로 다시 가입할 수 있어야 한다(익명화로 유니크 충돌 없음).
3. 음성 동의를 철회했거나 동의하지 않은 보호자, 비로그인, 선생님 세션에서 원본 업로드가 서버에서 거절돼야 한다(FE만 믿지 않음).
4. 출시 알림 "괜찮아요"에 전화번호가 들어 있어도 저장되지 않아야 한다.
5. STT 일시 오류(5xx, 타임아웃)는 기존 재시도/실패 흐름을 유지하고, `STT_UNAVAILABLE`은 재시도 불가 계열에만 쓴다.

---

### Task 1 (BE): 동의 이력 + 가입 동의 강제 + 마케팅 기본값
**Files:** `db/schema/066-user-consent.sql`(new), `identity/entity/UserConsent.java`(new), repository, `identity/dto/ConsentPayload.java`(new), `SignupOrganizationOwnerRequest`, `org/dto/JoinClassRequest`, OAuth 요청 DTO, `AuthService`(createAccount, loginOrSignupWithOAuth), `ClassService.join`, `NotificationSettings`(기본 marketing false), 새 `ConsentController`(`POST /v1/me/consents`), `ErrorCode.CONSENT_REQUIRED`.
- [ ] 테스트 먼저: 동의 없는 가입 400 `CONSENT_REQUIRED`; 동의 있는 가입 시 TERMS/PRIVACY/MARKETING 행 3개 저장(source SIGNUP); 마케팅 true면 settings.marketing_enabled=true; OAuth 기존 계정은 consents 없이 로그인 성공; OAuth 신규는 consents 필수; `/v1/me/consents` 저장.
- [ ] 066: `user_consent(id uuid pk, user_id uuid not null references app_user(id) on delete cascade, consent_type varchar(40) not null, version varchar(40) not null, agreed boolean not null, source varchar(40) not null, created_at timestamptz not null default now())` + index(user_id, consent_type).
- [ ] 구현, 전체 BE 테스트, 커밋.

### Task 2 (BE): 음성 원본 1년·명시 동의만
**Files:** `voiceresearch/service/VoiceResearchService.java`, 관련 컨트롤러, `VoiceResearchServiceAccountConsentTest`.
- [ ] 테스트: RETENTION 365일(statusOf.retentionDays=365); 행 없는 보호자 기본 disabled; 익명·선생님 업로드 거절(403); 명시 동의 보호자만 업로드 허용; grant/withdraw 시 `user_consent`에 VOICE_RAW agreed=true/false 행(source MYPAGE 또는 요청이 준 source) 저장.
- [ ] `RETENTION = Duration.ofDays(365)`, `DEFAULT_ENABLED = false`, 업로드 게이트를 "PARENT + explicit enabled"로 강화. 기존 만료 스케줄러는 그대로(기존 90일 동의 행은 만료일 기준 정리됨 — 만료일 재계산은 하지 않음).
- [ ] 커밋.

### Task 3 (BE): 출시 알림 전화번호 + STT 장애 구분
**Files:** `db/schema/067-launch-notification-phone-nullable.sql`, `LaunchNotificationService`, `LaunchNotificationRequest` 엔티티, `provider/rtzr/util/RtzrSttClient.java`, `question/service/QuestionPipelineService`, `CompanionChatPipelineService`, `ErrorCode.STT_UNAVAILABLE`.
- [ ] 테스트: wantsContact=false + phone 있음 → 저장된 phone null; wantsContact=false + phone 없음 → 성공; wantsContact=true + phone 없음/형식 오류 → 400(기존). RTZR 400 H0001 → `SttUnavailableException`(또는 기존 예외 계층에 맞춘 이름) → 503 `STT_UNAVAILABLE` + ERROR 로그; RTZR 5xx는 기존 동작.
- [ ] 067: `alter table launch_notification_requests alter column phone drop not null;`
- [ ] 커밋.

### Task 4 (BE): 회원 탈퇴 실제 삭제 + 익명화
**Files:** `identity/service/AuthService.deleteAccount/releaseRelationships`, 새 `identity/service/AccountErasureService.java`, 필요한 repository delete 메서드, `db/schema/068-deletion-fk.sql`(improvement_feedback.user_id FK를 on delete set null로 등 필요 시).
처리(같은 트랜잭션, 음성 철회는 기존처럼 먼저 별도 트랜잭션):
- 공통: 비밀번호 재설정 토큰, 북마크, 알림, 알림 설정, `user_consent`는 **보존**(동의 이력 증빙 — 계정 행이 남으므로 유지), 개선 의견 삭제, `conversation_record where user_id` 삭제, 프로필 사진 Storage 객체 삭제 후 컬럼 null.
- 계정 익명화: `email = deleted+<uuid>@deleted.invalid`, `display_name = '탈퇴한 사용자'`, `login_id = 'deleted:<uuid>'`(원래값 제거), `password_hash = null`, `oauth_provider/oauth_subject = null`, `child_name = null`, `deleted_at = now`.
- 보호자: 가정 세션 `story_completion where user_id = 보호자 and lesson/class 없음` 삭제; 반 수업 기록은 남기고 `story_completion_participant where parent_user_id = 보호자` 삭제; 기존 tutor_student 연결 해제 유지; **아이 프로필 마스킹**: `name = '삭제됨'`, `birth_year = null`, `gender = null`, `avatar_key = 기본 키`, `age_band`는 not null이면 유지, `id/created_at/parent_id` 유지.
- 선생님: 기관 소속이면 담당 반 `class_group.tutor_id = null`(반·수업·학생 유지), 기존 detach 유지. 개인(소속 없음)이면 본인 반·수업·학생 삭제(기존 CASCADE 관계 활용, 명시 삭제).
- 관리자: 기관·소속 데이터 유지, 계정만 익명화.
- 결제 기록(`payment_order`)과 탈퇴 사유는 유지.
- [ ] 테스트(서비스 단위, mock repository 또는 기존 테스트 관례): 역할별 삭제/유지 대상, 아이 마스킹 값, 탈퇴 후 같은 이메일 재가입 가능(유니크 충돌 없음).
- [ ] 커밋.

### Task 5 (FE): 가입 동의 전송 + 소셜 버튼 잠금
**Files:** `src/entities/auth/model/consent.ts`(new: CONSENT_VERSION, toConsentPayload), `entities/auth/api/auth-api.ts`(signup*, oauthLogin, joinClass에 consents), `features/terms-consent/ui/TermsConsent.tsx`, `features/onboarding/ui/onboarding-flow.tsx`(SignUpStep 제출, 마케팅 fire-and-forget 제거, 소셜 버튼을 `termsConsentIsValid` 전 비활성 + 안내 문구), `features/oauth-login/ui/social-login-buttons.tsx`(disabled/consents prop), `shared/api/error-messages.ts`(CONSENT_REQUIRED 문구).
- [ ] 테스트(`consent.test.ts`): toConsentPayload 매핑, 버전 상수.
- [ ] 로그인 화면의 소셜 버튼은 기존 계정 로그인용으로 유지하고, 신규 계정이면 서버 CONSENT_REQUIRED → "회원가입에서 약관에 동의한 뒤 소셜 계정으로 가입해 주세요." 안내.
- [ ] 커밋.

### Task 6 (FE): 온보딩 음성 체크박스 + 런타임 기본 꺼짐 + 문구 1년
**Files:** `pages/onboarding-parent/ui/OnboardingParentPage.tsx`, `pages/one-story/model/use-one-story-runtime.ts`(enabled 기본 false, 보호자 explicit enabled일 때만 true, 조회 실패 시 false), `entities/analytics/model/voice-research.ts`(문구), `features/terms-consent/ui/TermsConsent.tsx`, `pages/landing/model/content.ts`(90일 → 1년), 새 consent API 클라이언트(`POST /v1/me/consents`).
- [ ] 동의 단계: 리포트 범위(필수) + 음성 원본(선택). "동의하고 다음" 시 `/v1/me/consents`(CHILD_REPORT_SCOPE, source ONBOARDING) 저장, 음성 체크 시 기존 음성 동의 API 호출. 실패 시 오류 표시하고 다음 단계로 넘어가지 않음.
- [ ] 음성 문구 예: "아이의 질문 음성 원본을 음성 인식 개선을 위해 1년간 비공개로 보관해요. 체크하지 않아도 질문은 문장으로 바뀌어 그대로 이용할 수 있어요. 마이페이지에서 언제든 끌 수 있어요."
- [ ] 테스트: 런타임 enabled 결정 로직을 순수 함수로 빼서 테스트(역할×동의 상태×조회 실패).
- [ ] 커밋.

### Task 7 (FE): 출시 알림 거절 + STT 장애 안내
**Files:** `features/launch-notification-gate/model/use-launch-notification-gate.ts`, `ui/launch-notification-gate.tsx`, `entities/launch-notification/api/*`(phone optional), `shared/api/error-messages.ts`(STT_UNAVAILABLE), 플레이어 음성 실패 처리(`use-one-story-runtime.ts` 녹음→전사 실패 경로, companion chat 음성 경로).
- [ ] "괜찮아요": 전화번호 없이도 제출 가능, 제출 시 phone을 보내지 않음. "연락 받고 싶어요"는 기존처럼 전화번호 필수.
- [ ] STT_UNAVAILABLE 수신 시 아이 화면 문구 "지금은 말로 질문하기가 어려워요. 글로 물어봐 줄래?" + 글 질문 모드로 전환(질문 기회 소모 없음).
- [ ] 테스트: 게이트 canSubmit 로직(순수 함수로 분리) — 거절은 이름 등만, 연락 희망은 전화 필수.
- [ ] 커밋.

### Task 8: 통합 점검 + 약관 문서 갱신
- [ ] FE 전체 검사·빌드, BE 전체 테스트.
- [ ] `qstory/legal/00-공개-전-확인사항.md`의 A1, A3, A4, A6, A7, A8과 B(음성 1년)를 처리됨으로 표시, `03-개인정보-처리방침.md` 탈퇴 조항을 실제 처리(익명화+삭제+마스킹)에 맞게 수정.

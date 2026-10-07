# 스토리 플레이어 질문 단계 축소·나가기 통일 (Q-34) — Spec + Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** 아이가 질문 한 번에 누르는 탭을 3~4번에서 0~1번으로 줄이고, 선택지 선택 후 로딩을 없애고, 나가기 경로를 하나로 통일한다.

**Architecture:** 플레이어 상태 머신(`entities/story-runtime/model/runtime.ts`)과 런타임 훅(`pages/one-story/model/use-one-story-runtime.ts`)을 중심으로 바꾼다. 녹음 자동 시작·무음 종료·자동 전송은 순수 함수(타이밍·판정)와 훅 배선으로 나눈다. 선택지 음성 미리 만들기는 BE `/v1/narrations/stream`에 `prefetch` 플래그를 추가하고, 별도 Gemini 키가 있을 때만 동작한다.

**Tech Stack:** FE React19 + react-native-web, Web Audio(AnalyserNode)로 무음 판정, `tsx --test`. BE Spring Boot, JUnit5.

## 결정 사항 (2026-10-08 대화로 승인)
1. **자동 녹음(가정 세션)**: 질문 초대 낭독이 끝나면 마이크 자동 시작 + "지금 말해 줘!" 표시. 마이크 권한은 "이야기 시작하기" 탭 때 미리 요청.
2. **무음 자동 종료**: 말한 뒤 약 1.5초 조용하면 녹음 종료(최소 발화 0.4초 이상일 때만 종료 판정). "다 했어요" 버튼은 보조로 유지. 최대 30초 기존 유지.
3. **무응답 재질문**: 마이크가 켜진 뒤 15초 동안 발화가 없으면 캐릭터가 한 번 "궁금한 거 있으면 말해 줘~"(기기 TTS 또는 기존 낭독 경로 — 서버 TTS 호출 금지) 후 다시 15초 대기. 그래도 없으면 질문을 건너뛰고 이야기 계속.
4. **반 수업 세션(lessonId 있음)**: 자동 시작 대신 기존처럼 "말로 질문하기" 버튼으로 시작(교실 소음). 무음 자동 종료·자동 전송은 동일 적용.
5. **자동 확인**: 음성 인식 문장을 약 2.5초 보여준 뒤 자동 전송. 그 사이 "다시 말하기"(녹음 재시작) 버튼. 카운트다운은 시각적으로 표시.
6. **글 질문**: "질문 내용 확인하기" 누르면 바로 전송(이중 확인 제거).
7. **선택지 음성 미리 만들기**: `awaiting-choice` 진입 시 선택지 3개의 `branchLine` 음성을 `prefetch: true`로 요청해 캐시. 선택 시 준비된 음성 즉시 재생, 없으면 기존처럼 그때 요청. BE는 prefetch 요청에 `GEMINI_TTS_PREFETCH_API_KEY`(속성 `qstory.providers.gemini.prefetch-api-key`) 전용 클라이언트를 쓴다. **키가 없으면 TTS 호출 없이 즉시 409 `PREFETCH_DISABLED`** → FE는 그 세션 동안 prefetch를 멈춘다.
8. **나가기 통일**: 로고는 누를 수 없음. 상단 홈 아이콘 하나 → 항상 "계속 듣기 / 나가기" 확인. "나가기"는 진행 저장 후 로그인 시 역할 홈(`homePathForAuth`), 비로그인은 `/`. 외부 사이트 이동(`LANDING_URL`)과 종료 사유 설문(8문항)을 플레이어에서 제거. "처음부터 다시 듣기"와 오류 배너의 "처음 화면으로"는 확인 후에만 기록 삭제.
9. **라벨**: 건너뛰기 계열 → "이야기 계속 듣기". 녹음 중 질문 버리기 버튼 → "그만할래". `rejoining` 죽은 상태 제거.

**범위 밖:** 아이/보호자 화면 분리, 녹음 확인 단계 완전 제거.

## API 계약
```jsonc
// POST /v1/narrations/stream  (기존 body에 필드 추가)
{ ...기존 필드, "prefetch": true }
// prefetch=true 이고 prefetch 키 미설정 → 409 FailureBody code "PREFETCH_DISABLED" (TTS 호출 없음)
// prefetch=true 이고 키 설정 → 기존과 같은 스트림 응답, prefetch 전용 키로 생성
// prefetch 생략/false → 기존 동작(기존 키)
```

## Global Constraints
- 커밋 메시지에 `Co-Authored-By` 넣지 않는다. push 금지.
- 서버 TTS를 새로 호출하는 코드는 prefetch(별도 키) 외에 추가하지 않는다(하루 100회 한도 공유).
- 아동 UX: 버튼 44px 이상, 문구는 짧고 아이 말투. 금지어 스캔 통과.
- FE 검사: `npm run typecheck && npm run lint && npm test && npm run build` (파이프 없이, 종료 코드 확인). BE: system gradle `/d/gradle/gradle-9.2.0/bin/gradle`, JAVA_HOME `C:\Users\yooni\.jdks\ms-21.0.9`, `subst T:` 드라이브에서 실행.
- 브랜치: fe `feat/q-34-player-simplify`, be `feat/q-34-choice-prefetch`.

## Review Focus
1. 마이크 권한 거부·미지원 브라우저(iOS Safari 등)에서 자동 시작이 실패해도 버튼 방식으로 떨어져 질문할 수 있어야 한다.
2. 아이가 말하는 중간에 잠깐 쉬어도(0.5~1초) 녹음이 끊기지 않아야 한다. 주변 소음만 있을 때 무한 녹음되지 않아야 한다(최대 30초).
3. 자동 전송 카운트다운 중 "다시 말하기"를 누르면 전송이 취소되고 질문 기회를 쓰지 않아야 한다.
4. 나가기 후 같은 이야기로 돌아오면 이어듣기가 되어야 한다(진행 저장).
5. prefetch 키가 없을 때 선택지 진입마다 서버 TTS가 3번 호출되지 않아야 한다(409 후 세션 내 중단).

---

### Task 1 (FE): 나가기 통일
**Files:** `pages/one-story/ui/top-bar.tsx`, `pages/one-story/ui/modals/home-menu-modal.tsx`, `pages/one-story/model/use-one-story-runtime.ts`(leaveTemporarily/finishToday/finishExperience/restartStory 경로, exitReason 상태), `pages/one-story/ui/reader-card/parent-message-banner.tsx`, `pages/one-story/ui/chapter-sidebar.tsx`(필요 시), `pages/one-story/lib/constants.ts`(종료 사유 목록 사용처 정리), 관련 analytics(EXPLICIT_EXIT 이벤트는 사유 없이 유지 가능).
- [ ] 홈 메뉴를 "계속 듣기 / 나가기" 2개로. "나가기" = 진행 저장(기존 로컬 진행 저장 경로) 후 `homePathForAuth`로 이동. 외부 URL 이동 제거.
- [ ] 로고 Pressable 제거(정적 표시). 완주 화면 홈 아이콘도 같은 확인 흐름.
- [ ] "처음부터 다시"(사이드바·배너)는 확인 모달 후 restart.
- [ ] 테스트: 나가기 목적지 결정 순수 함수(auth 상태별) 테스트.
- [ ] 커밋.

### Task 2 (FE): 라벨 통일, 글 질문 단일 확인, rejoining 제거
**Files:** reader-card 패널들(question-invite, recording-voice, recording-text, processing, failed-recoverable, awaiting-choice, confirm-transcript), `entities/story-runtime/model/runtime.ts`(rejoining 타입·statusCopy·전이 제거), `runtime-view.ts`.
- [ ] 건너뛰기 계열 → "이야기 계속 듣기", 녹음 중 버리기 → "그만할래".
- [ ] 글 질문: 제출 시 확인 단계(ConfirmTranscriptPanel) 없이 라우팅 시작.
- [ ] `rejoining` 상태와 참조 제거, 기존 runtime 테스트 갱신.
- [ ] 커밋.

### Task 3 (FE): 자동 확인(2.5초) + 다시 말하기
**Files:** `pages/one-story/ui/reader-card/confirm-transcript-panel.tsx`, `use-one-story-runtime.ts`(pendingTranscription 확인 경로), `pages/one-story/lib/constants.ts`(AUTO_CONFIRM_MS = 2500).
- [ ] 음성 인식 문장 표시 + 카운트다운 → 자동으로 기존 "확인" 동작 실행. "다시 말하기" = 타이머 취소 + 녹음 재시작(질문 기회 미소모). 언마운트/상태 변경 시 타이머 정리.
- [ ] 테스트: 카운트다운 타이머 로직을 순수 함수/작은 컨트롤러로 분리해 가짜 시계로 테스트(취소 시 미전송).
- [ ] 커밋.

### Task 4 (FE): 자동 녹음 시작 + 무음 종료 + 무응답 재질문
**Files:** `features/record-question/*`(녹음기), 새 `features/record-question/model/silence-detector.ts`(순수 판정), `use-one-story-runtime.ts`(초대 낭독 종료 → 자동 BEGIN_QUESTION, 15초 재질문), `question-invite-panel.tsx`/`recording-voice-panel.tsx`(“지금 말해 줘!”), 시작 시 권한 요청(`idle` → START 시).
- [ ] silence-detector: 입력 = 프레임별 RMS 시퀀스와 시간, 파라미터(threshold, minSpeechMs 400, trailingSilenceMs 1500) → 종료 시점 판정. 노이즈 바닥 적응(첫 300ms 평균 기반) 포함. 테스트(말 중간 0.8초 쉼은 유지, 1.5초 침묵 종료, 소음만 있으면 미종료 → 30초 상한).
- [ ] 가정 세션: 초대 낭독 끝나면 자동 녹음. 반 수업(lessonId): 버튼 시작 유지.
- [ ] 15초 무발화 → 재질문 1회(서버 TTS 금지, 기기 TTS나 텍스트 표시) → 15초 더 → 이야기 계속(CONTINUE).
- [ ] 권한 거부/미지원 → 기존 버튼 방식으로 표시.
- [ ] 커밋.

### Task 5 (BE): prefetch 전용 키와 PREFETCH_DISABLED
**Files:** `config/AppProperties`(Gemini에 prefetchApiKey) 또는 별도 properties, `application.yml`(`prefetch-api-key: ${GEMINI_TTS_PREFETCH_API_KEY:}`), `provider/gemini/util/GeminiTtsClient`(키를 주입받는 인스턴스 2개 또는 키 파라미터), `narration/controller/NarrationController`(`/v1/narrations/stream` body `prefetch`), 서비스, `ErrorCode.PREFETCH_DISABLED`.
- [ ] 테스트: prefetch=true·키 없음 → 409, TTS 클라이언트 미호출; prefetch=true·키 있음 → prefetch 클라이언트 사용; prefetch 없음 → 기존 클라이언트.
- [ ] 커밋.

### Task 6 (FE): 선택지 음성 미리 만들기
**Files:** `features/route-question/model/response-narration.ts`(prefetch 옵션), `use-one-story-runtime.ts`(awaiting-choice 진입 시 3개 prefetch, 선택 시 캐시 사용, 409 PREFETCH_DISABLED 시 세션 내 중단, 상태 이탈 시 abort), `awaiting-choice-panel.tsx`(준비된 경우 로딩 패널 생략).
- [ ] 테스트: prefetch 캐시/중단 로직 순수 모듈 테스트(409 후 재요청 없음, 캐시 히트 시 fetch 없음).
- [ ] 커밋.

### Task 7: 통합 점검
- [ ] FE 전체 검사·빌드, BE 전체 테스트.
- [ ] Playwright(로컬 FE + 모킹 또는 로컬 BE)로: 나가기 확인 흐름, 글 질문 단일 확인, 자동 확인 카운트다운과 다시 말하기, 라벨 확인. 마이크 자동 시작은 가능한 범위(가짜 미디어 스트림 플래그 `--use-fake-device-for-media-stream`)에서 확인.

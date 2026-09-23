---
name: Q-Story
description: 아이의 질문이 이야기를 움직이는 인터랙티브 동화 - 네이비 콘솔(운영 화면)과 스토리북(리더) 두 세계
colors:
  background: "#F7F8FA"
  content-surface: "#FFFFFF"
  content-surface-border: "rgba(15, 23, 42, 0.08)"
  content-panel: "rgba(15, 23, 42, 0.03)"
  on-content: "#1E293B"
  on-content-muted: "rgba(30, 41, 59, 0.68)"
  on-card-title: "#1E293B"
  on-card-body: "#475569"
  on-card-muted: "#64748B"
  primary: "#1E293B"
  primary-hover: "#0F172A"
  link-on-light: "#2451B2"
  gold: "#F6C64D"
  gold-text: "#8A6300"
  sidebar-background: "#242D38"
  error: "#C24A2E"
  positive: "#2F9E62"
  warning: "#E8B931"
  storybook-card: "rgba(255, 252, 245, 0.96)"
  reader-heading: "#28153F"
  cover-fallback: "#243447"
typography:
  display:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "26px"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  heading:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  small:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  caption:
    fontFamily: "Pretendard Variable, Pretendard, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  control: "4px"
  inner-card: "8px"
  input: "12px"
  button: "14px"
  card: "16px"
  modal: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  ms: "12px"
  md: "16px"
  ml: "20px"
  lg: "24px"
  xl: "32px"
  xxl: "40px"
  xxxl: "56px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#FFFFFF"
    rounded: "{rounded.button}"
    height: "56px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    height: "56px"
  button-secondary:
    backgroundColor: "rgba(30, 41, 59, 0.06)"
    textColor: "{colors.primary}"
    rounded: "{rounded.button}"
    height: "40px"
    padding: "0 12px"
  button-disabled:
    backgroundColor: "rgba(30, 41, 59, 0.06)"
    textColor: "#8A94A6"
  card-surface:
    backgroundColor: "{colors.content-surface}"
    rounded: "{rounded.card}"
    padding: "20px"
  card-panel:
    backgroundColor: "{colors.content-panel}"
    rounded: "{rounded.card}"
    padding: "20px"
  text-field:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.on-card-title}"
    rounded: "{rounded.input}"
    height: "52px"
    padding: "0 20px"
  pill:
    backgroundColor: "rgba(30, 41, 59, 0.06)"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "5px 12px"
  sidebar-item-active:
    backgroundColor: "rgba(255, 255, 255, 0.10)"
    textColor: "#FFFFFF"
    rounded: "12px"
    height: "44px"
---

# Q-Story Design System

## Overview

Q-Story는 두 세계를 갖는다. 토큰의 단일 출처는 `src/shared/ui/theme.ts`(`storybookTheme`)이고, 이 문서는 그 값을 옮겨 적은 것이다.

- **콘솔 세계(Operate)**: 로그인·온보딩·튜터/기관/부모 대시보드·마이페이지·리포트. 라이트 회색 배경(`background`) 위 순백 카드, 네이비 텍스트와 네이비 primary, 오른쪽에 고정된 다크 네이비 사이드바. 골드는 채움·마커(캘린더 오늘, 활성 아이콘, CTA)로만 쓰고 글자로 놓을 때는 앰버 `gold-text`를 쓴다.
- **스토리북 세계(Experience)**: 이야기 플레이어(`pages/one-story`)와 랜딩. 장면 삽화 위 다크 배경, 크림 카드(`storybook-card`), 골드 강조, 보라 계열 리더 헤딩(`reader-heading`). 아이가 직접 조작하므로 모든 컨트롤은 44px 이상이고, 오버레이 텍스트는 짧은 그림자로 어떤 삽화 위에서도 읽힌다.

2026-09-23에 예전 보라 톤(#43225F 계열 텍스트, 라벤더 배경·테두리)을 콘솔 세계에서 걷어내 네이비로 통일했다. 리더는 자기 세계를 유지한다.

## Colors

- `background` `#F7F8FA`: 콘솔 페이지 최외곽. 인증 화면(`shellBackground`)도 같은 값.
- `content-surface` `#FFFFFF` + `content-surface-border`: 카드. 그림자는 `elevation.low`(offset 6, blur 18, 6% 알파)만.
- `content-panel`: 카드 안의 서브 패널·리스트 행·필터 칩 배경.
- 텍스트 3단: `on-card-title`(#1E293B) / `on-card-body`(#475569) / `on-card-muted`(#64748B). 배경 직접 위에서는 `on-content` / `on-content-muted`. 모두 흰 배경 4.5:1 이상.
- `primary` #1E293B: CTA 채움, 활성 상태, 링크가 아닌 강조. hover는 `primary-hover`.
- `link-on-light` #2451B2: 라이트 배경 위 텍스트 링크. 항상 밑줄.
- `gold` #F6C64D: 골드 CTA 채움, 오늘 마커, 사이드바 활성 아이콘. 글자에는 `gold-text` #8A6300.
- 상태: `positive` / `warning` / `error`(=danger). 배너는 `semantic.*.background/border/text` 세트를 쓴다.
- `sidebar-background` #242D38: 넓은 화면 오른쪽 고정 사이드바, 좁은 화면 하단 탭은 흰 배경.

## Typography

Pretendard Variable 한 가족. `global.css`가 react-native-web의 기본 `System` 폰트를 `!important`로 덮어쓴다.

- 페이지 제목 `display` 26/900, 섹션 제목 `heading` 24/700, 카드 제목 16/700(또는 900), 본문 16/400, 보조 14/400, 캡션·필 12/600.
- 헤딩류는 줄간격 1.2 + 자간 -0.02em, 본문류는 1.4.
- 카운트 라벨(학생 3명, 97점)은 `tabular-nums`.
- 헤딩 위에 카테고리 라벨(eyebrow)을 두지 않는다. 단계 표시("회원가입 · 2 / 2", "1 · 아이 등록")처럼 진행 정보를 담을 때만 작은 라벨을 허용한다.

## Layout

- 단일 컬럼 폼 420px(`layout.contentMaxWidth`), 리스트 페이지 560, 튜터 홈 720, 대시보드 카드 640/760, 서재 그리드 1040.
- 넓은 화면(≥860px)은 `AppNavShell`이 오른쪽 220px 사이드바를 고정하고, 좁은 화면은 상단 바(뒤로·홈) + 하단 탭.
- 간격은 4px 사다리(`spacing`). 카드 안 gap 8~12, 카드 사이 16, 섹션 사이 24 이상. 헤딩 위 여백이 아래보다 크다.
- 페이지 가로 패딩 20px(ml). 폰에서도 16px 이상.

## Elevation & Depth

- 카드: hairline 테두리 + `elevation.low`. 진한 드롭섀도 금지.
- 모달: `elevation.modal`(offset 18, blur 40, 22%) + `scrim` rgba(15, 8, 25, 0.72).
- 사이드바는 그림자 없이 색 대비로만 분리한다.
- 플레이어 상단 바 텍스트: `textShadow` 0/1/4 rgba(22,12,36,0.6).

## Shapes

- 입력 12, 버튼 14, 카드 16, 모달 20, 필·아바타·원형 버튼 999, 체크박스·라디오 4.
- 카드 안에 카드를 넣지 않는다. 필요하면 `card-panel`(옅은 회색 패널)이나 `inner-card`(8) 행을 쓴다.

## Components

- **ActionButton**: primary(네이비 채움, 56), gold(골드 채움, 56), secondary(옅은 네이비 채움, 40, 텍스트 네이비), outline. 비활성은 회색 채움 + 회색 라벨(`button-disabled`), 반투명 처리 금지. 눌림은 opacity 0.9 + scale 0.96.
- **TextField / SelectField / Textarea**: 흰 배경, hairline 테두리(`lightCardBorder`), 포커스 시 primary 테두리, 오류 시 error 테두리 + 아래 오류 문장. 라벨 12/500.
- **Card**: surface(순백) / panel(옅은 회색) / outlined.
- **Pill**: onCard(옅은 네이비) 기본, onLight(중립 회색) 상태 라벨, accent(골드) 소수 강조.
- **BrandLockup**: `tone="onLight"`(콘솔) / `onDark`(리더·랜딩). 콘솔에서 골드 Q는 앰버.
- **AppNavShell**: 역할별 항목은 `dashboardNavItems`. DIRECTOR는 홈·반/학생·선생님·이용 현황·리포트·마이페이지.
- **BirthYearChips**: 아이 나이는 "2019년생 · 7세" 칩으로 받는다.
- **StatusBanner / EmptyState / ErrorState / LoadingState**: 상태 화면은 이 네 컴포넌트만 쓴다.

## Do's and Don'ts

- Do: 텍스트는 세 단계(title/body/muted)만, 색으로 위계를 만들지 않는다.
- Do: 아이가 누르는 컨트롤은 44px 이상, 라벨은 행동을 말한다("이야기 시작", "부모 초대 코드").
- Do: 골드는 채움과 마커에, 글자는 앰버(`gold-text`)로.
- Don't: 크림 카드(`storybook-card`)를 콘솔 페이지에 쓰지 않는다. 라이트 회색 배경 위에서 누렇게 뜬다.
- Don't: 라벤더·보라 텍스트 토큰을 새로 만들지 않는다. 남아 있는 보라는 리더 전용(`reader*`)뿐이다.
- Don't: 헤딩 위 eyebrow, 골드 테두리 강조, 카드 안 카드, 세로로 쌓인 전폭 보조 버튼.

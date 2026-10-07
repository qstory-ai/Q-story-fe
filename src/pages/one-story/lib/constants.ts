export const QUESTION_AUDIO_HEAD_START_MS = 2_000;
// 운영 환경 점검 결과 TTS 준비에 최대 약 10.7초까지 걸리는 것을 확인했다. 8초 만에
// 기기 TTS로 폴백하면 Gretel의 목소리가 로봇 같은 음성으로 바뀌어버리므로,
// 기기 폴백이 발동하기 전까지 캐릭터 목소리에 조금 더 시간을 준다.
export const RESPONSE_AUDIO_PREPARE_MS = 12_000;
export const FIXED_AUDIO_FAILURE_RECOVERY_MS = 2_500;

// LiveBranchGenerationService(실시간 새 분기 생성) 폴링 간격/총 대기 한도. 백엔드가 재시도까지
// 소진하려면 시간이 걸리므로 간격을 짧게 두되, 90초를 넘기면 사람 승인 없는 콘텐츠를 계속
// 기다리게 하지 않고 안전하게 이야기를 이어간다(runtime.ts의 LIVE_BRANCH_FAILED 참고).
// 3개 옵션 병렬 이미지 생성(각각 draft 3회 + 이미지 1회 재시도)이 60초 안팎까지 걸려 여유를 둔 값.
export const LIVE_BRANCH_POLL_INTERVAL_MS = 1_800;
export const LIVE_BRANCH_POLL_TIMEOUT_MS = 90_000;

// 음성 인식 문장이 보이면 이 시간 뒤에 자동으로 질문을 보낸다(Q-34). "다시 말하기"로 취소할 수 있다.
export const AUTO_CONFIRM_MS = 2_500;

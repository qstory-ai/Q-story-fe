import { readEnv } from '@/shared/config';

export const EXIT_REASONS = [
  '기다림이 길었어요',
  '음성 질문이 어려웠어요',
  '소리가 끊기거나 이상했어요',
  '자막이 음성과 맞지 않았어요',
  '그림이나 내용이 어색했어요',
  '아이가 흥미를 잃었어요',
  '이야기나 화면이 어려웠어요',
  '시간이 부족했어요',
] as const;

export const EXIT_REASON_CODES: Record<(typeof EXIT_REASONS)[number], string> = {
  '기다림이 길었어요': 'long_wait',
  '음성 질문이 어려웠어요': 'voice_difficulty',
  '소리가 끊기거나 이상했어요': 'audio_issue',
  '자막이 음성과 맞지 않았어요': 'caption_sync_issue',
  '그림이나 내용이 어색했어요': 'visual_or_story_issue',
  '아이가 흥미를 잃었어요': 'lost_interest',
  '이야기나 화면이 어려웠어요': 'content_difficulty',
  '시간이 부족했어요': 'not_enough_time',
};

export const QUESTION_AUDIO_HEAD_START_MS = 2_000;
// 운영 환경 점검 결과 TTS 준비에 최대 약 10.7초까지 걸리는 것을 확인했다. 8초 만에
// 기기 TTS로 폴백하면 Gretel의 목소리가 로봇 같은 음성으로 바뀌어버리므로,
// 기기 폴백이 발동하기 전까지 캐릭터 목소리에 조금 더 시간을 준다.
export const RESPONSE_AUDIO_PREPARE_MS = 12_000;
export const FIXED_AUDIO_FAILURE_RECOVERY_MS = 2_500;

export const LANDING_URL = readEnv('VITE_QSTORY_LANDING_URL') || 'https://qstory.ai.kr';

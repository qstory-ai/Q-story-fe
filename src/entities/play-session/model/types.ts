/**
 * 한 회차(sessionId = conversationId) 안의 대화 한 줄 - 백엔드 play_turn과 같은 모양(Q-39 API 계약).
 * 아이 말 원문과 그레텔 답을 그대로 남겨 부모 리포트가 "실제로 주고받은 말"을 보여 준다.
 */
export type PlayTurnRole = 'CHILD' | 'CHARACTER' | 'SYSTEM';

/**
 * 누가 입력했는지 - 앱은 자동으로 판별하지 않는다. 기본은 확인 안 됨, 반 수업은 선생님 입력,
 * 보호자가 대신 입력했다고 고른 경우만 GUARDIAN_PROXY.
 */
export type PlayTurnSpeaker = 'UNVERIFIED' | 'GUARDIAN_PROXY' | 'TEACHER_RELAY';

export type PlayTurnEntryMode = 'SPONTANEOUS' | 'INVITE' | 'HELP';

export type PlayTurnEvent =
  | 'ACTION_CONFIRMED'
  | 'ACTION_DECLINED'
  | 'INVITE_SKIPPED'
  | 'INVITE_CLOSED'
  // Q-40 UT: 대화가 끊긴 순간 - 그레텔 답 실패, 받아쓰기 실패(errorCode 포함).
  | 'REPLY_FAILED'
  | 'STT_FAILED';

export type PlayTurn = {
  seq: number;
  occurredAt: string;
  sceneId: string;
  visualId?: string | null;
  anchorId?: string | null;
  entryMode?: PlayTurnEntryMode | null;
  role: PlayTurnRole;
  speaker?: PlayTurnSpeaker | null;
  characterSpeakerId?: string | null;
  text?: string | null;
  inputMode?: 'VOICE' | 'TEXT' | null;
  transcriptEdited?: boolean | null;
  fixed?: boolean | null;
  helpStep?: number | null;
  replyKind?: string | null;
  proposedFamilyId?: string | null;
  replyAudioPlayed?: boolean | null;
  event?: PlayTurnEvent | null;
  familyId?: string | null;
  viaSuggestion?: boolean | null;
  suggestionLabel?: string | null;
  resultVisualId?: string | null;
  /** 그레텔 답(CHARACTER): 아이 말을 보낸 뒤 답이 화면에 나오기까지 걸린 시간(ms). */
  latencyMs?: number | null;
  /** REPLY_FAILED·STT_FAILED의 실패 코드. */
  errorCode?: string | null;
};

/** 기록할 한 줄 - seq·시각은 기록기가 붙인다. */
export type PlayTurnInput = Omit<PlayTurn, 'seq' | 'occurredAt'> & { occurredAt?: string };

/** 회차 단위 정보 - 대화를 보낼 때마다 같이 보내 서버가 회차 기록을 만들고 갱신한다. */
export type PlaySessionContext = {
  storyId: string;
  contentVersion: string;
  childId?: string | null;
  tutorStudentId?: string | null;
  lessonId?: string | null;
  readFromSceneId?: string | null;
  readThroughSceneId?: string | null;
  /** Q-40 UT - 회차를 어디서 시작했는지(home_hero·resume·report_reread·detail·lesson·demo·library). 처음 값만 남는다. */
  entrySource?: string | null;
  /** HOME(가정) 또는 수업 진행 형태 INDIVIDUAL·SMALL_GROUP·WHOLE_CLASS. */
  playSetting?: PlaySetting | null;
  devicePlatform?: string | null;
  deviceBrowser?: string | null;
  viewportClass?: string | null;
};

/** 회차 진행 형태 - 가정은 HOME, 반 수업은 선생님이 시작할 때 고른다(Q-40). */
export type PlaySetting = 'HOME' | 'INDIVIDUAL' | 'SMALL_GROUP' | 'WHOLE_CLASS';

export const LESSON_PLAY_SETTINGS: readonly Exclude<PlaySetting, 'HOME'>[] = ['INDIVIDUAL', 'SMALL_GROUP', 'WHOLE_CLASS'];

export const PLAY_SETTING_LABELS: Record<PlaySetting, string> = {
  HOME: '가정',
  INDIVIDUAL: '개별',
  SMALL_GROUP: '소그룹',
  WHOLE_CLASS: '전체 반',
};

export function parsePlaySetting(value: string | null | undefined): PlaySetting | null {
  return value === 'HOME' || value === 'INDIVIDUAL' || value === 'SMALL_GROUP' || value === 'WHOLE_CLASS' ? value : null;
}

/**
 * UT 회차 코드 - 회차 id(UUID)의 앞 6자를 대문자로. 관찰자가 화면에서 보고 적어, 관찰·인터뷰를 같은 회차 기록에
 * 이어 붙인다(Grafana "Q-Story UT 회차"가 이 코드로 찾는다).
 */
export function sessionShortCode(sessionId: string | null | undefined): string | null {
  if (!sessionId) return null;
  const hex = sessionId.replace(/-/g, '');
  return /^[0-9a-fA-F]{6}/.test(hex) ? hex.slice(0, 6).toUpperCase() : null;
}

export type PlayTurnBatch = PlaySessionContext & {
  turns: PlayTurn[];
  /** 통계 세션 id - 로그인하지 않은 회차도 이 값으로 받고, 중간에 로그인하면 앞부분을 계정에 잇는다. */
  betaSessionId?: string;
};

/** 회차를 시작한 곳(Q-40 UT) - 요청받은 첫 사용·다시 읽기·스스로 시작을 나눠 보는 데 쓴다. */
export type PlayEntrySource = 'home_hero' | 'resume' | 'report_reread' | 'detail' | 'lesson' | 'demo' | 'library';

/**
 * 플레이어 주소에서 시작한 곳을 정한다. from= 쿼리(리포트 "다시 읽기"·서재)가 가장 구체적이고, 그다음 수업,
 * 이어서 읽기(resume=1), 홈 히어로(from=home), 나머지는 상세 화면의 시작 버튼.
 */
export function playEntrySource(input: {
  from?: string | null;
  entry?: 'resume' | 'start' | null;
  lessonId?: string | null;
  demo?: boolean;
}): PlayEntrySource {
  if (input.demo) return 'demo';
  if (input.from === 'report') return 'report_reread';
  if (input.from === 'library') return 'library';
  if (input.lessonId) return 'lesson';
  if (input.entry === 'resume') return 'resume';
  if (input.from === 'home') return 'home_hero';
  return 'detail';
}

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

export type PlayTurnEvent = 'ACTION_CONFIRMED' | 'ACTION_DECLINED' | 'INVITE_SKIPPED' | 'INVITE_CLOSED';

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
};

export type PlayTurnBatch = PlaySessionContext & { turns: PlayTurn[] };

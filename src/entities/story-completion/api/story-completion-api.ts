import { apiBaseUrl } from '@/shared/config';
import { requestJson, type PublicRequestOptions as RequestOptions } from '@/shared/api';
import type { CompanionChatSummary, QuestionOutcome } from '@/entities/analytics';
import type { PlayTurn } from '@/entities/play-session';

export type StoryCompletionSummary = {
  id: string;
  storyId: string;
  completedAt: string;
  durationSeconds: number | null;
  /**
   * 부모(PARENT) 계정에서 어느 아이 프로필로 진행한 세션인지 - 리포트 페이지의 아이별 필터에
   * 이 값이 있는 항목만 노출한다. 선생님 세션이나 legacy 기록(childName 시절)은 null.
   */
  childId: string | null;
  /** 상시 대화(companion-chat) 태그 집계 스냅샷 - 완주 시점 기록. 대화 안 했으면 null. */
  companionChatSummary: CompanionChatSummary | null;
  /** 선생님 세션이면 어느 학생의 기록인지. 이름은 수업의 students로 조인한다. 가정 세션은 null. */
  tutorStudentId: string | null;
  /** 수업 상세에서 시작한 세션이면 그 수업 id. */
  lessonId: string | null;
  sessionKind: StorySessionKind;
  /** 선생님 세션에 참여한 학생 수 - 반 수업이면 반 전체, 개별 수업이면 1, 가정 세션은 0. */
  participantCount: number;
};

/**
 * CLASS: 반 수업 - 여러 아이가 함께 읽은 세션 하나(누가 말했는지 모르는 단체 기록).
 * TUTOR: 선생님과 한 아이의 개별 수업. HOME: 집에서 부모와 읽은 기록.
 */
export type StorySessionKind = 'CLASS' | 'TUTOR' | 'HOME';

/** COMPLETED: 끝까지 읽음. EXITED: 중간에 나감(잠시 나가기·오늘 체험 마치기) - 이어 읽으면 COMPLETED로 바뀐다. */
export type StoryEndStatus = 'COMPLETED' | 'EXITED';

export type ReportFollowUp = {
  type: 'REASON' | 'POSSIBILITY' | 'EXPERIENCE' | 'LOOK_TOGETHER' | 'RECALL';
  text: string;
};

/** 아이 말에서 드러난 관심·생각 하나 - 근거는 그 회차 대화 줄의 seq로 가리킨다. */
export type ReportObservation = {
  key: string;
  sceneId: string;
  anchorId: string | null;
  evidenceSeqs: number[];
  expressionTypes: string[];
  signals: string[];
  initiative: string;
  observation: string;
};

export type ReportTalkCard = {
  key: string;
  headline: string;
  explanation: string;
  acknowledge: string | null;
  openingLine: string;
  followUps: ReportFollowUp[];
};

/** 아이 말이 없을 때·반 수업에서 쓰는 "이 장면으로 나눌 수 있는 이야기". */
export type ReportSceneTalk = {
  sceneId: string;
  openingLine: string;
  followUps: ReportFollowUp[];
};

export type ReportAnalysis = {
  status: 'PENDING' | 'READY' | 'FAILED' | 'SKIPPED';
  modelId?: string | null;
  promptVersion?: string | null;
  observations: ReportObservation[];
  cards: ReportTalkCard[];
  commonScenes: ReportSceneTalk[];
};

export type TeacherNote = {
  /** 선생님만 보는 메모 - 기록 주인 선생님과 같은 기관 관리자에게만 온다. */
  internal: string | null;
  /** 부모에게 공유하는 한마디. */
  forParents: string | null;
};

export type StoryCompletionDetail = StoryCompletionSummary & {
  outcomes: QuestionOutcome[];
  /** 리포트 머리말용 - 반 수업이면 반 이름, 기관 반이면 기관 이름, 선생님 세션이면 진행한 선생님. */
  className: string | null;
  organizationName: string | null;
  tutorDisplayName: string | null;
  /** Q-39 - 옛 서버·옛 기록에는 없을 수 있다. */
  contentVersion?: string | null;
  endStatus?: StoryEndStatus | null;
  readFromSceneId?: string | null;
  readThroughSceneId?: string | null;
  /** 그 회차 대화 전부(seq 순). 반 수업을 부모가 보면 아이 말 text는 비어 온다. */
  turns?: PlayTurn[] | null;
  /** false면 보관 기간이 지나 대화 원문이 지워진 기록 - outcomes 요약으로만 보여 준다. */
  turnsAvailable?: boolean | null;
  teacherNote?: TeacherNote | null;
  analysis?: ReportAnalysis | null;
  /** 보는 사람이 부모일 때 이 기록과 이어진 자기 아이 - "아이랑 다시 읽기"가 이 중에서 고른다. */
  linkedChildren?: { id: string; name: string }[] | null;
};

export class StoryCompletionApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function request<T>(path: string, init: RequestInit, token: string, options: RequestOptions = {}): Promise<T> {
  return requestJson(StoryCompletionApiError, path, init, { baseUrl: apiBaseUrl, ...options, token });
}

/**
 * 방금 끝난 세션의 리포트를 저장한다. outcomes는 실시간 리포트 화면이 이미 구성해 둔 것과 동일한
 * QuestionOutcome[]이다.
 * - tutorStudentId: 선생님이 자신이 등록한 학생과 진행한 세션일 때만 (StoryPlayerRoute의
 *   ?tutorStudentId= 참고). 가정 세션은 생략.
 * - childId: 부모 계정에서 어느 아이 프로필로 진행한 세션인지 - 아이별 리포트 필터를 위해 첨부.
 *   선생님 세션은 childId를 생략하고 대신 tutorStudentId만 넘긴다.
 */
export function recordStoryCompletion(
  token: string,
  input: {
    storyId: string;
    durationSeconds: number | null;
    outcomes: QuestionOutcome[];
    tutorStudentId?: string;
    childId?: string;
    /** 이 세션에서 사용한 companion-chat conversationId - 있으면 서버가 태그 집계를 스냅샷 저장. */
    companionConversationId?: string;
    /** 수업 상세에서 시작한 세션이면 그 수업 id. 반 수업이면 서버가 참여 학생 전원을 묶어 기록 한 건으로 남긴다. */
    lessonId?: string;
    /** 끝까지 읽었는지(COMPLETED, 기본) 중간에 나갔는지(EXITED). 같은 회차를 다시 저장하면 서버가 갱신한다. */
    endStatus?: StoryEndStatus;
    contentVersion?: string;
    readFromSceneId?: string;
    readThroughSceneId?: string;
  },
  options?: RequestOptions,
): Promise<StoryCompletionSummary> {
  return request('/v1/story-completions', { method: 'POST', body: JSON.stringify(input) }, token, options);
}

export function listStoryCompletions(
  token: string,
  filters?: { childId?: string | null },
  options?: RequestOptions,
): Promise<StoryCompletionSummary[]> {
  const query = filters?.childId ? `?childId=${encodeURIComponent(filters.childId)}` : '';
  return request(`/v1/story-completions${query}`, { method: 'GET' }, token, options);
}

export function getStoryCompletion(
  token: string,
  id: string,
  options?: RequestOptions,
): Promise<StoryCompletionDetail> {
  return request(`/v1/story-completions/${id}`, { method: 'GET' }, token, options);
}

/** 최근 N회의 전체 리포트를 outcomes와 함께 가져온다 - 목록 화면의 누적 트렌드 카드(buildRecentApproachTrend)용. */
export function listRecentStoryCompletions(
  token: string,
  limit: number,
  filters?: { childId?: string | null },
  options?: RequestOptions,
): Promise<StoryCompletionDetail[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filters?.childId) params.set('childId', filters.childId);
  return request(`/v1/story-completions/recent?${params.toString()}`, { method: 'GET' }, token, options);
}

/** 반·개별 수업 기록의 교사 메모 저장 - 기록 주인 선생님만. */
export function saveTeacherNote(
  token: string,
  id: string,
  note: { internal: string | null; forParents: string | null },
  options?: RequestOptions,
): Promise<TeacherNote> {
  return request(`/v1/story-completions/${id}/teacher-note`, { method: 'PUT', body: JSON.stringify(note) }, token, options);
}

/** 분석이 실패한 기록의 분석만 다시 만든다(기본 기록은 그대로). */
export function retryReportAnalysis(token: string, id: string, options?: RequestOptions): Promise<unknown> {
  return request(`/v1/story-completions/${id}/analysis/retry`, { method: 'POST' }, token, options);
}

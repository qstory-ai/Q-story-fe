import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  audioClockNow,
  estimateReplySpeechSeconds,
  playDecodedClip,
  playResponseAudio,
  preloadDecodedClip,
  primeResponseAudio,
  type DecodedClipPlayback,
} from '@/features/route-question';
import type { BufferedResponseAudio, ResponseAudio } from '@/shared/lib';
import {
  LISTEN_NOW_COPY,
  NO_SPEECH_REPROMPT_COPY,
  primeRecorderAudio,
  useAudioRecorderAdapter,
  useSpeechAutoStop,
} from '@/features/record-question';
import { fetchLineNarration, fetchReplyNarration } from '@/features/narrate-story';
import { reportClientError } from '@/entities/analytics';
import {
  CompanionChatError,
  RATE_LIMITED_CHILD_COPY,
  isRateLimitedError,
  sendCompanionChatMessage,
  startLiveTranscription,
  textOnlyCompanionReply,
  transcribeCompanionChatAudio,
  type CompanionChatReply,
  type CompanionReplyKind,
  type LiveTranscription,
} from '@/entities/companion-chat';
import { STT_UNAVAILABLE_CHILD_COPY, isSttUnavailableCode } from '@/entities/speech-pipeline';
import type { PlayTurnInput } from '@/entities/play-session';
import { STT_STREAMING_ENABLED } from '@/shared/config';

import { GRETEL_COMPANION } from '../lib/companion-character';
import { buildDialogueScene, wrapUpFor, type WrapUpSignal } from '../lib/dialogue-context';
import {
  NO_ATTEMPTS,
  attemptAfterReply,
  attemptOnClose,
  attemptRequest,
  inAttempt,
  type AttemptEvent,
  type AttemptState,
} from '../lib/dialogue-attempt';
import { nextDialogueStep } from '../lib/dialogue-next-phase';
import {
  DIALOGUE_THINKING_FILLER,
  DIALOGUE_VOICE_STREAMING,
  FILLER_DELAY_MS,
  pickThinkingFiller,
  planFillerCut,
  thinkingFillerClipId,
} from '../lib/dialogue-voice';
import { punctuateChildQuestion } from '../lib/question-punctuation';
import type { QuestionSkipReason } from '../lib/question-skip';
import type { OneStoryRuntime } from './use-one-story-runtime';

/** CHAT = 아이가 스스로 연 그레텔 대화, INVITE = 이야기 속 질문 초대에서 이어지는 대화. */
export type DialogueMode = 'CHAT' | 'INVITE';

export type DialogueTurn = {
  id: string;
  role: 'CHILD' | 'CHARACTER';
  text: string;
  /** 그레텔 말 중에서 도움 대사·초대 대사처럼 미리 정해 둔 말인지(대화 기록에서 구분해 보여 준다). */
  fixed?: boolean;
  /**
   * 시도 장면 줄이면 그 줄을 읽은 화자(내레이터·그레텔) - 패널이 말풍선 대신 그림책 장면처럼 보여 준다. 그레텔 대화 기록
   * (history)에는 넣지 않는다(장면은 attempt.active.scene으로 따로 보낸다).
   */
  sceneSpeakerId?: string;
};

/**
 * 패널이 지금 무엇을 기다리는지. 한 번에 하나만 - 버튼 묶음이 이 값 하나로 정해진다.
 * - ready: 아이 차례(말하기/글로 쓰기/도와줘/이야기 계속)
 * - recording · transcribing: 말하는 중, 받아 적는 중
 * - confirm: 받아 적은 문장 확인(Q-34 결정 - 확인 단계 유지)
 * - typing: 글로 쓰는 중
 * - thinking · speaking: 그레텔이 답을 준비 중, 말하는 중
 * - offer-help: "조금 도와줄까?"(아이가 모르겠다고 함)
 * - proposal: 준비된 행동으로 해 볼지 확인(그렇게 해보기 / 더 이야기하기)
 * - suggest-return: 3왕복 뒤 복귀 제안(이야기로 돌아가기 / 더 이야기하기)
 * - error: 실패해도 "다시 말하기 / 이야기 계속"은 항상 남긴다
 */
export type DialoguePhase =
  | 'ready'
  | 'recording'
  | 'transcribing'
  | 'confirm'
  | 'typing'
  | 'thinking'
  | 'speaking'
  | 'offer-help'
  | 'proposal'
  | 'suggest-return'
  | 'error';

const MAX_TEXT = 160;

type Proposal = { familyId: string; childMeaning: string };

type StepMetadata = Record<string, string | number | boolean>;

/**
 * "생각 중" 채움말 한 번. 답 음성을 기다리게 하지 않는다 - 답 첫 소리 시각이 정해지면 yieldTo로 건너뛰거나 줄여 끈다.
 * 멈춤은 요청의 음성 AbortSignal(stopSpeaking)로 한다.
 */
type ThinkingFiller = {
  /** 답 문장이 왔다 - 아직 소리를 내기 전이면 건너뛴다(이미 말하는 중이면 답 음성이 올 때까지 둔다). */
  skip: () => void;
  /** 답 첫 소리가 replyStartAt(audioClockNow 시계, 초)에 난다. */
  yieldTo: (replyStartAt: number) => void;
  /** 지금 소리를 내는 중인지 - 그동안 답 음성은 조각을 더 모은다(채움말이 기다림을 가린다). */
  isPlaying: () => boolean;
};

/** 답 요청을 마친 상태 - 말풍선은 이미 떴고, 음성은 받는 중이거나 이미 들려주는 중이다. */
type PreparedReply = {
  reply: CompanionChatReply;
  /** 말풍선을 띄운 시각(Date.now()). */
  shownAt: number;
  /** 답 음성 재생 - 들려줬으면 true, 음성이 없거나 실패하면 false, 끊겼으면 null. */
  voicePlayed: Promise<boolean | null>;
};

type ReplyRequest = Omit<Parameters<typeof sendCompanionChatMessage>[0], 'deferAudio' | 'stream'>;

/** 재생하지 않을 PCM 스트림은 닫는다 - 서버가 끝까지 만들어 보내지 않게. */
function discardVoice(voice: Promise<ResponseAudio | null>) {
  void voice.then(
    (audio) => {
      if (audio?.kind === 'pcm-stream') void audio.stream.cancel().catch(() => {});
    },
    () => {},
  );
}

export function useDialogue({
  runtime,
  conversationId,
  tutorStudentId,
  lessonId,
  paused = false,
}: {
  runtime: OneStoryRuntime;
  conversationId: string;
  tutorStudentId?: string;
  lessonId?: string;
  /** 챕터·홈 메뉴가 패널을 가리는 중 - 듣기를 멈춘다(보이지 않는 패널이 녹음·자동 종료하지 않게). */
  paused?: boolean;
}) {
  const {
    storyPackage,
    runtimeState,
    currentClip,
    isQuestionInvitePlayback,
    activeQuestionPrompt,
    questionOutcomes,
    conversationAttribution,
    trackStoryEvent,
    recordTurn,
    visualAssetId,
  } = runtime;
  const character = GRETEL_COMPANION;
  // 자동 전송 안내에 쓰는 이름 - 이야기 데이터의 화자 이름을 우선 쓰고, 없으면 '친구'.
  const characterName =
    storyPackage.manifest.speakers.find((speaker) => speaker.id === character.speakerId)?.displayName ?? '친구';
  const recorder = useAudioRecorderAdapter();

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<DialogueMode>('CHAT');
  const [anchorId, setAnchorId] = useState<string | null>(null);
  const [turns, setTurns] = useState<DialogueTurn[]>([]);
  const [phase, setPhase] = useState<DialoguePhase>('ready');
  const [draft, setDraft] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [helpStep, setHelpStep] = useState(0);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [extended, setExtended] = useState(false);
  // 보호자가 아이 대신 글을 썼다고 표시했는지(Q-39 입력 주체) - 앱은 누가 말했는지 스스로 판별하지 않는다.
  const [guardianProxy, setGuardianProxy] = useState(false);
  // 실시간 받아 적기 중간 문장("듣고 있어요: …") - 말하는 동안만 보인다.
  const [livePartial, setLivePartial] = useState('');
  // 이번 말하기의 실시간 받아 적기. 실패하면 같이 녹음한 blob으로 배치 받아 적기를 한다.
  const liveRef = useRef<LiveTranscription | null>(null);

  const childTurnCountRef = useRef(0);
  const openedAtRef = useRef(0);
  const entryModeRef = useRef<'SPONTANEOUS' | 'INVITE' | 'HELP'>('SPONTANEOUS');
  const lastChildMeaningRef = useRef('');
  const lastReplyRef = useRef('');
  const inputModeRef = useRef<'VOICE' | 'TEXT'>('TEXT');
  // 받아 적은 문장 그대로(고쳐 썼는지 비교용).
  const sttDraftRef = useRef<string | null>(null);
  // 이번 질문 초대에서 아이가 한 번이라도 말했는지 - 닫을 때 건너뜀/대화 후 닫음을 가른다.
  const inviteChildSpokeRef = useRef(false);
  // 요청마다 번호를 붙여, 닫았거나 새 말을 시작한 뒤에 도착한 답·전사는 버린다.
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const audioAbortRef = useRef<AbortController | null>(null);
  // 바로 앞에 들려준 채움말 - 같은 말이 연달아 나오지 않게.
  const fillerIndexRef = useRef<number | null>(null);
  const thinkingFillers = storyPackage.dialogue.thinkingFillers;
  /** 채움말 녹음 주소 - i번째(0부터). 녹음이 없으면 undefined(소리 없이 넘어간다). */
  const fillerUri = useCallback(
    (index: number) => storyPackage.audioAssets[thinkingFillerClipId(index)]?.uri,
    [storyPackage.audioAssets],
  );
  // 채움말을 미리 받아 풀어 둔다 - 들려줄 때 다시 받거나 버퍼링하지 않게(1초 시점에 바로 소리가 나야 한다).
  const preloadFillers = useCallback(() => {
    if (!DIALOGUE_THINKING_FILLER) return;
    thinkingFillers.forEach((_, index) => {
      const uri = fillerUri(index);
      if (uri) void preloadDecodedClip(uri);
    });
  }, [fillerUri, thinkingFillers]);
  useEffect(() => {
    preloadFillers();
  }, [preloadFillers]);

  // 질문 초대 상태에서는 currentClip이 비어 있으므로, 마지막으로 들은 대사 id를 따로 기억한다.
  const lastClipIdRef = useRef<string | null>(null);
  const currentClipId = currentClip?.id ?? null;
  useEffect(() => {
    if (currentClipId) lastClipIdRef.current = currentClipId;
  }, [currentClipId]);

  const sceneId = 'sceneId' in runtimeState ? runtimeState.sceneId : null;
  /**
   * 마지막으로 들은 대사. 저장된 진행에서 질문 초대 상태로 바로 이어 들으면 이 화면에서 초대 대사가
   * 재생된 적이 없으므로, 질문 초대 중이면 초대 대사 묶음의 마지막 대사로 본다.
   */
  const heardClipId = useCallback(() => {
    if (lastClipIdRef.current) return lastClipIdRef.current;
    const anchor = anchorId
      ? storyPackage.manifest.questionAnchors.find((candidate) => candidate.id === anchorId)
      : null;
    const group = anchor
      ? storyPackage.manifest.audioGroups.find((candidate) => candidate.id === anchor.afterAudioGroupId)
      : null;
    return group?.clips.at(-1)?.id ?? null;
  }, [anchorId, storyPackage]);
  const inviteHelp = anchorId ? (storyPackage.dialogue.inviteHelp[anchorId] ?? null) : null;
  const helpSteps = useMemo(() => inviteHelp?.steps ?? [], [inviteHelp]);
  const executedActions = useMemo(
    () =>
      questionOutcomes
        .map((outcome) => outcome.actionFamilyId)
        .filter((familyId): familyId is string => Boolean(familyId)),
    [questionOutcomes],
  );

  const logStep = useCallback(
    (turnKind: string, metadata: StepMetadata = {}) => {
      const payload: StepMetadata = {
        entry_mode: entryModeRef.current,
        turn_kind: turnKind,
        elapsed_ms: Math.max(0, Date.now() - openedAtRef.current),
        ...metadata,
      };
      if (anchorId) payload.anchor_id = anchorId;
      if (sceneId) payload.scene_id = sceneId;
      void trackStoryEvent('dialogue_step', payload);
    },
    [anchorId, sceneId, trackStoryEvent],
  );

  /** 대화 한 줄을 회차 기록(Q-39)에 남긴다 - 장면·그림·질문 지점·진입 방식은 지금 상태로 채운다. */
  const logTurn = useCallback(
    (input: Omit<PlayTurnInput, 'sceneId'> & { sceneId?: string }) => {
      const turnSceneId = input.sceneId ?? sceneId;
      if (!turnSceneId) return;
      recordTurn({
        visualId: visualAssetId,
        anchorId: mode === 'INVITE' ? anchorId : null,
        entryMode: entryModeRef.current,
        ...input,
        sceneId: turnSceneId,
      });
    },
    [anchorId, mode, recordTurn, sceneId, visualAssetId],
  );

  const stopSpeaking = useCallback(() => {
    audioAbortRef.current?.abort();
    audioAbortRef.current = null;
    void runtime.stopDialogueSpeech();
  }, [runtime]);

  /** 진행 중인 실시간 받아 적기를 버린다(닫기·다시 말하기·글로 쓰기·포기). 받아 적기를 시작한 transcribe()는 먼저 꺼내 간다. */
  const dropLive = useCallback(() => {
    liveRef.current?.abort();
    liveRef.current = null;
    setLivePartial('');
  }, []);

  const cancelPending = useCallback(() => {
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    dropLive();
  }, [dropLive]);

  const addTurn = useCallback((turn: Omit<DialogueTurn, 'id'>) => {
    setTurns((previous) => [
      ...previous,
      { ...turn, id: `${Date.now()}-${previous.length}` },
    ]);
  }, []);

  // 질문 초대 시도 장면 상태 - 질문 지점마다 만든 장면 수(서버 상한과 같은 수)와 지금 장면. 서버는 들고 있지 않는다.
  const attemptRef = useRef<AttemptState>(NO_ATTEMPTS);

  /** 시도 장면 시작·마침을 회차 기록·통계·리포트에 남긴다(무엇을 해 봤고, 장면 안에서 몇 번 이어졌는지). */
  const reportAttempt = useCallback(
    (event: AttemptEvent) => {
      if (event.kind === 'START') {
        logTurn({ role: 'SYSTEM', event: 'TRY_FAILED', text: event.tried });
        logStep('TRY_FAIL', { scene_lines: event.sceneLineCount });
        runtime.recordAttemptStarted(event.anchorId, event.tried);
        return;
      }
      logTurn({ role: 'SYSTEM', event: 'TRY_ENDED', text: event.tried, attemptTurns: event.turns });
      logStep('TRY_END', { attempt_turns: event.turns, attempt_end: event.reason });
      runtime.recordAttemptEnded(event.anchorId, event.turns, event.reason);
    },
    [logStep, logTurn, runtime],
  );

  /** 그레텔의 고정 대사를 기록에 남기고 그레텔 목소리로 말한다(미리 녹음한 음성이 있으면 그것). */
  const sayFixedLine = useCallback(
    async (lineId: string, text: string, helpStepNumber?: number) => {
      const seq = requestSeqRef.current;
      addTurn({ role: 'CHARACTER', text, fixed: true });
      logTurn({
        role: 'CHARACTER',
        text,
        fixed: true,
        characterSpeakerId: character.speakerId,
        ...(helpStepNumber ? { helpStep: helpStepNumber, entryMode: 'HELP' as const } : {}),
      });
      setPhase('speaking');
      try {
        await runtime.speakDialogueLine(lineId, text, character.speakerId);
      } catch {
        // 음성이 실패해도 글은 이미 패널에 있다.
      }
      if (seq === requestSeqRef.current) setPhase('ready');
    },
    [addTurn, character.speakerId, logTurn, runtime],
  );

  // ── 열고 닫기 ─────────────────────────────────────────────

  const resetSessionState = () => {
    setDraft('');
    setErrorMessage(null);
    setHelpStep(0);
    setProposal(null);
    setExtended(false);
    setPhase('ready');
  };
  const resetSessionRefs = useCallback((entryMode: 'SPONTANEOUS' | 'INVITE') => {
    childTurnCountRef.current = 0;
    lastChildMeaningRef.current = '';
    lastReplyRef.current = '';
    openedAtRef.current = Date.now();
    entryModeRef.current = entryMode;
  }, []);

  /** 아이가 스스로 그레텔에게 말을 건다 - 낭독을 멈추고 삽화를 둔 채 하단 패널을 연다. */
  const openChat = useCallback(async () => {
    if (open) return;
    primeResponseAudio();
    preloadFillers();
    resetSessionState();
    resetSessionRefs('SPONTANEOUS');
    setMode('CHAT');
    setAnchorId(null);
    const greeting = '응, 나 여기 있어. 무슨 이야기 하고 싶어?';
    setTurns([{ id: 'greeting', role: 'CHARACTER', text: greeting, fixed: true }]);
    setOpen(true);
    await runtime.pauseForDialogue();
    logStep('OPEN');
    logTurn({ role: 'CHARACTER', text: greeting, fixed: true, characterSpeakerId: character.speakerId, anchorId: null, entryMode: 'SPONTANEOUS' });
  }, [character.speakerId, logStep, logTurn, open, preloadFillers, resetSessionRefs, runtime]);

  // 질문 초대 대사가 끝나면(awaiting-question) 초대 카드(QuestionInvitePanel)가 [궁금한 거 물어보기]
  // [이야기 계속 듣기]를 띄워 아이가 고를 때까지 기다린다 - 패널을 저절로 열지 않는다(PM: 너무 빨리 사라짐).
  // 물어보기를 누르면 openInvite가 같은 패널을 질문 초대 모드로 연다(초대 대사가 그레텔의 첫 말풍선).
  // 이야기가 질문 초대를 벗어나면(행동 확인, 처음부터 다시 등) 초대 패널은 렌더 중에 닫는다.
  const invitedAnchorId = runtimeState.status === 'awaiting-question' ? runtimeState.anchorId : null;
  const [seenInviteAnchorId, setSeenInviteAnchorId] = useState<string | null>(null);
  if (invitedAnchorId !== seenInviteAnchorId) {
    setSeenInviteAnchorId(invitedAnchorId);
    if (!invitedAnchorId && mode === 'INVITE' && open) {
      setOpen(false);
    }
  }
  useEffect(() => {
    if (invitedAnchorId) {
      inviteChildSpokeRef.current = false;
      // 초대 대사는 낭독으로 이미 들었다 - 패널을 열지 않고 건너뛰어도 그레텔이 물은 줄은 기록에 남긴다.
      if (sceneId) {
        recordTurn({
          sceneId,
          visualId: visualAssetId,
          anchorId: invitedAnchorId,
          entryMode: 'INVITE',
          role: 'CHARACTER',
          text: activeQuestionPrompt,
          fixed: true,
          characterSpeakerId: character.speakerId,
        });
      }
      return;
    }
    // 초대가 끝났으면 늦게 올 답·전사를 버리고 소리·녹음을 멈춘다(닫힌 패널이 말하지 않게).
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    audioAbortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invitedAnchorId]);

  // Q-34: 초대 대사가 나오는 동안 마이크 권한을 미리 받아 둔다 - 말하기를 누른 순간 기다리지 않게.
  useEffect(() => {
    if (isQuestionInvitePlayback && recorder.permissionState === 'unknown' && !recorder.permissionRequestPending) {
      void recorder.requestPermission();
    }
  }, [isQuestionInvitePlayback, recorder]);

  /** 대화를 닫고 이야기로 돌아간다. 일반 대화는 멈춘 문장부터, 질문 초대는 기본 이야기로 이어 간다. */
  const close = useCallback(
    async (
      reason: 'CONTINUE' | 'CLOSED_BY_REPLY' | 'CHILD_ENDED' = 'CONTINUE',
      skipReason?: QuestionSkipReason,
    ) => {
      cancelPending();
      stopSpeaking();
      if (recorder.isRecording) await recorder.stopRecording();
      logStep('CLOSE', { reply_kind: reason, turn_number: childTurnCountRef.current });
      // 진행 중인 시도 장면도 함께 끝난다 - 원래 질문 지점(이야기 진행)은 그대로다.
      const closedAttempt = attemptOnClose(attemptRef.current);
      attemptRef.current = closedAttempt.state;
      if (closedAttempt.event) reportAttempt(closedAttempt.event);
      if (mode === 'INVITE' && anchorId) {
        logTurn({ role: 'SYSTEM', event: inviteChildSpokeRef.current ? 'INVITE_CLOSED' : 'INVITE_SKIPPED' });
        if (childTurnCountRef.current > 0) {
          runtime.recordDialogueOutcome(anchorId, lastChildMeaningRef.current, lastReplyRef.current);
        }
        // B처럼 행동 없이 대화만 하는 지점은 "어떻게 했는지 이어서 볼까?"로 이야기에 돌아간다.
        const continueLine = inviteHelp?.continueLine;
        if (continueLine && childTurnCountRef.current > 0) {
          await sayFixedLine(`dialogue-${anchorId}-continue`, continueLine);
        }
        setOpen(false);
        // 그 사이 이야기가 이미 다른 상태로 넘어갔으면(행동 실행·처음부터 다시 등) 다시 넘기지 않는다.
        await runtime.continueFromInvite(anchorId, skipReason);
        return;
      }
      setOpen(false);
      await runtime.resumeAfterDialogue();
    },
    [
      anchorId, cancelPending, inviteHelp?.continueLine, logStep, logTurn, mode, recorder, reportAttempt, runtime,
      sayFixedLine, stopSpeaking,
    ],
  );

  // ── 그레텔에게 보내기 ─────────────────────────────────────

  /**
   * "생각 중" 채움말 - FILLER_DELAY_MS 안에 답 문장이 안 오면 미리 받아 풀어 둔 채움말 하나를 답 음성과 같은
   * AudioContext로 들려준다(녹음이 없거나 풀지 못했으면 소리 없이 넘어간다). 답 음성은 채움말을 기다리지 않는다 -
   * 답 첫 소리가 정해지면 아직 시작 전인 채움말은 건너뛰고, 말하는 중이면 그 직전에 줄여 끈다(planFillerCut).
   */
  const startThinkingFiller = useCallback(
    (seq: number, signal: AbortSignal): ThinkingFiller => {
      // waiting: 1초 기다리는 중, loading: 녹음을 아직 푸는 중, playing: 소리를 내는 중, done: 끝·건너뜀·멈춤.
      let state: 'waiting' | 'loading' | 'playing' | 'done' = 'waiting';
      let playback: DecodedClipPlayback | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const stillWanted = () => !signal.aborted && seq === requestSeqRef.current;
      const finish = () => {
        state = 'done';
        if (timer) clearTimeout(timer);
        signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        playback?.stop();
        finish();
      };
      if (!DIALOGUE_THINKING_FILLER || thinkingFillers.length === 0 || signal.aborted) {
        state = 'done';
        return { skip: () => {}, yieldTo: () => {}, isPlaying: () => false };
      }
      signal.addEventListener('abort', onAbort, { once: true });
      const scheduledAt = Date.now() + FILLER_DELAY_MS;
      timer = setTimeout(() => {
        timer = null;
        const index = pickThinkingFiller(thinkingFillers.length, fillerIndexRef.current);
        const uri = index === null ? undefined : fillerUri(index);
        if (state !== 'waiting' || index === null || !uri || !stillWanted()) {
          finish();
          return;
        }
        state = 'loading';
        // 고른 번호의 녹음을 그대로 튼다(번호·주소·기록이 같은 채움말을 가리킨다).
        void preloadDecodedClip(uri).then((buffer) => {
          if (state !== 'loading' || !buffer || !stillWanted()) {
            finish();
            return;
          }
          const started = playDecodedClip(buffer);
          if (!started) {
            finish();
            return;
          }
          state = 'playing';
          playback = started;
          fillerIndexRef.current = index;
          logStep('FILLER', { filler_clip: thinkingFillerClipId(index), filler_late_ms: Math.max(0, Date.now() - scheduledAt) });
          void started.ended.then(() => {
            if (playback === started) finish();
          });
        });
      }, FILLER_DELAY_MS);
      return {
        skip: () => {
          if (state === 'waiting' || state === 'loading') finish();
        },
        yieldTo: (replyStartAt) => {
          if (state === 'done') return;
          const cut = planFillerCut(
            { startAt: playback?.startAt ?? null, endAt: playback?.endAt ?? null },
            replyStartAt,
            audioClockNow(),
          );
          if (cut.kind === 'skip') {
            playback?.stop();
            finish();
          } else if (cut.kind === 'fade') {
            playback?.fadeOut(cut.from, cut.to);
          }
        },
        isPlaying: () => state === 'playing' && playback !== null && audioClockNow() < playback.endAt,
      };
    },
    [fillerUri, logStep, thinkingFillers],
  );

  /** 답 문장의 음성 - 스트리밍이면 첫 조각부터 재생할 수 있는 PCM, 아니면 전체 음성. 실패는 null(글만 남는다). */
  const fetchReplyVoice = useCallback(
    (text: string, signal: AbortSignal): Promise<ResponseAudio | null> => {
      const input = { storyId: storyPackage.manifest.storyId, speakerId: character.speakerId, text };
      return (DIALOGUE_VOICE_STREAMING ? fetchReplyNarration(input, signal) : fetchLineNarration(input)).catch(
        () => null,
      );
    },
    [character.speakerId, storyPackage.manifest.storyId],
  );

  /** 시도 장면 한 줄의 음성 - 그 줄 화자(내레이터·그레텔)의 목소리로 실시간 TTS 한 번. 실패하면 null(글만 남는다). */
  const fetchSceneLineVoice = useCallback(
    (speakerId: string, text: string, signal: AbortSignal): Promise<ResponseAudio | null> => {
      const input = { storyId: storyPackage.manifest.storyId, speakerId, text };
      return (DIALOGUE_VOICE_STREAMING ? fetchReplyNarration(input, signal) : fetchLineNarration(input)).catch(
        () => null,
      );
    },
    [storyPackage.manifest.storyId],
  );

  /**
   * 그레텔에게 답을 받는다. 스트리밍이면 답 문장이 오는 즉시 말풍선을 띄우고 같은 문장의 음성을 바로 요청해, 첫 조각이
   * 오는 대로 들려준다 - 답의 나머지(태그·replyKind)를 기다리지 않는다. 그 전에 FILLER_DELAY_MS가 지나면 채움말을
   * 들려주고, 답 첫 소리가 정해지면 채움말을 건너뛰거나 줄여 끈다(채움말이 답을 늦추지 않는다). 기기 음성으로 대신하지
   * 않는다(목소리가 달라진다). 이미 말풍선을 띄운 뒤 마지막 줄만 실패하면 보인 문장으로 마무리한다. 그 사이 끊겼으면 null.
   */
  const requestReply = useCallback(
    async (
      input: ReplyRequest,
      seq: number,
      controller: AbortController,
      onVoiceStarted?: () => void,
    ): Promise<PreparedReply | null> => {
      const audioController = new AbortController();
      audioAbortRef.current = audioController;
      const filler = startThinkingFiller(seq, audioController.signal);
      const cancelled = () => audioController.signal.aborted || seq !== requestSeqRef.current;
      const playVoice = async (text: string, voice: Promise<ResponseAudio | null>): Promise<boolean | null> => {
        const audio = await voice;
        if (cancelled()) {
          discardVoice(voice);
          return null;
        }
        if (!audio) {
          // 음성이 없으면 채움말은 끝까지 두되 아직 시작 전이면 건너뛴다.
          filler.skip();
          return false;
        }
        let played = false;
        try {
          played = await playResponseAudio(
            audio,
            audioController.signal,
            () => {
              if (!cancelled()) setPhase('speaking');
              onVoiceStarted?.();
            },
            undefined,
            undefined,
            filler.yieldTo,
            {
              // 조각이 실시간보다 느리게 와도 끊기지 않을 만큼 모은 뒤 시작한다 - 채움말이 나오는 동안은 더 모은다.
              estimatedTotalSeconds: estimateReplySpeechSeconds(text),
              isCovered: filler.isPlaying,
              onStats: (stats) =>
                logStep('VOICE_DONE', {
                  buffer_wait_ms: stats.bufferWaitMs,
                  stall_count: stats.stallCount,
                  stall_ms: stats.stallMs,
                  audio_ms: Math.round(stats.audioSeconds * 1_000),
                }),
            },
          );
        } catch {
          // 음성이 실패해도 글 답은 패널에 있다.
        }
        filler.skip();
        if (cancelled()) return null;
        return played;
      };
      type Shown = { text: string; at: number; voicePlayed: Promise<boolean | null> };
      const shown: { current: Shown | null } = { current: null };
      const show = (text: string, voice: Promise<ResponseAudio | null>): Shown => {
        filler.skip();
        addTurn({ role: 'CHARACTER', text });
        shown.current = { text, at: Date.now(), voicePlayed: playVoice(text, voice) };
        return shown.current;
      };
      // 말풍선·음성을 버린다 - 아이가 끊었거나 새 요청이 시작됐다.
      const drop = () => {
        filler.skip();
        if (shown.current) audioController.abort();
      };
      let reply: CompanionChatReply;
      try {
        reply = await sendCompanionChatMessage(
          { ...input, deferAudio: true, stream: DIALOGUE_VOICE_STREAMING },
          controller.signal,
          (text) => {
            if (shown.current || seq !== requestSeqRef.current) return;
            show(text, fetchReplyVoice(text, audioController.signal));
          },
        );
      } catch (error) {
        const early = shown.current;
        if (!early || controller.signal.aborted || seq !== requestSeqRef.current) {
          drop();
          throw error;
        }
        reply = textOnlyCompanionReply(early.text);
      }
      if (seq !== requestSeqRef.current) {
        drop();
        return null;
      }
      // 시도 장면이 있으면(서버는 이때 답 문장을 먼저 보내지 않는다) 장면 줄을 내레이터·인물 목소리로 먼저 들려준 뒤 그레텔이
      // 장면 상황에서 묻는다 - 라이브 분기 대사처럼 줄마다 그 화자 목소리(실시간 TTS)다. 음성은 모두 한꺼번에 미리 받는다.
      const sceneLines = reply.dialogue.attempt?.scene ?? [];
      if (!shown.current && sceneLines.length > 0) {
        const replyVoice = reply.audioDeferred ? fetchReplyVoice(reply.responseText, audioController.signal) : null;
        const lineVoices = sceneLines.map((line) =>
          fetchSceneLineVoice(line.speakerId, line.text, audioController.signal),
        );
        filler.skip();
        // 채움말이 이미 나오는 중이면 끝날 때까지만 기다린다(장면 내레이션과 겹치지 않게).
        for (let waited = 0; filler.isPlaying() && waited < 3_000; waited += 100) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        for (const [index, line] of sceneLines.entries()) {
          if (cancelled()) {
            lineVoices.forEach(discardVoice);
            if (replyVoice) discardVoice(replyVoice);
            return null;
          }
          addTurn({ role: 'CHARACTER', text: line.text, sceneSpeakerId: line.speakerId });
          setPhase('speaking');
          const audio = await lineVoices[index];
          if (audio && !cancelled()) {
            try {
              await playResponseAudio(audio, audioController.signal);
            } catch {
              // 줄 음성이 실패해도 글은 패널에 있다.
            }
          }
        }
        if (cancelled()) {
          if (replyVoice) discardVoice(replyVoice);
          return null;
        }
        const current = show(
          reply.responseText,
          reply.audio ? Promise.resolve(reply.audio) : (replyVoice ?? Promise.resolve(null)),
        );
        return { reply, shownAt: current.at, voicePlayed: current.voicePlayed };
      }
      // 스트리밍이 아니었으면(서버 스위치가 꺼짐 등) 예전처럼 답 전체를 받은 뒤 말풍선을 띄우고 음성을 받는다.
      const ready: BufferedResponseAudio | null = reply.audio;
      const current =
        shown.current ??
        show(
          reply.responseText,
          ready
            ? Promise.resolve(ready)
            : reply.audioDeferred
              ? fetchReplyVoice(reply.responseText, audioController.signal)
              : Promise.resolve(null),
        );
      return { reply, shownAt: current.at, voicePlayed: current.voicePlayed };
    },
    [addTurn, fetchReplyVoice, fetchSceneLineVoice, logStep, startThinkingFiller],
  );

  /**
   * 그레텔 답의 음성이 끝나기를 기다린다(재생은 requestReply가 첫 조각부터 이미 시작했다). 반환: 들려줬으면 true,
   * 음성이 없거나 실패하면 false, 그 사이 아이가 끊었거나 새 요청이 시작됐으면 null(호출부는 바로 멈춘다).
   */
  const speakReply = useCallback(async (prepared: PreparedReply, seq: number): Promise<boolean | null> => {
    setPhase('speaking');
    const played = await prepared.voicePlayed;
    if (seq !== requestSeqRef.current) return null;
    return played;
  }, []);

  const send = useCallback(
    async (rawText: string, inputMode: 'VOICE' | 'TEXT') => {
      const text = rawText.trim().slice(0, MAX_TEXT);
      if (!text || !sceneId) return;
      cancelPending();
      stopSpeaking();
      const seq = requestSeqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      // 시도 장면 줄은 대화 기록에 넣지 않는다 - 장면은 attempt.active.scene으로 따로 간다.
      const history = turns
        .filter((turn) => !turn.sceneSpeakerId)
        .map(({ role, text: turnText }) => ({ role, text: turnText }));
      // 받아 적은 말엔 물음표가 없다 - 묻는 말이면 "?"를 붙여 말풍선에 보이고 그대로 보낸다(글로 쓴 말은 손대지 않는다).
      const childText = inputMode === 'VOICE' ? punctuateChildQuestion(text) : text;
      // 시도 장면 안의 말은 대화 정리(3왕복 뒤 복귀 제안) 횟수에 세지 않는다 - 장면은 따로 최대 maxTurns번이다.
      const attemptActiveNow = mode === 'INVITE' && inAttempt(attemptRef.current, anchorId);
      if (!attemptActiveNow) childTurnCountRef.current += 1;
      const turnNumber = childTurnCountRef.current;
      const wrapUp: WrapUpSignal = attemptActiveNow ? 'NONE' : wrapUpFor(turnNumber, extended);
      addTurn({ role: 'CHILD', text: childText });
      if (mode === 'INVITE') inviteChildSpokeRef.current = true;
      logTurn({
        role: 'CHILD',
        text: childText,
        inputMode,
        // 반 수업은 선생님이 반을 대신해 입력한다. 가정은 보호자가 대신 썼다고 고른 경우만 표시한다.
        speaker: lessonId ? 'TEACHER_RELAY' : guardianProxy ? 'GUARDIAN_PROXY' : 'UNVERIFIED',
        transcriptEdited: inputMode === 'VOICE' && sttDraftRef.current !== null ? text !== sttDraftRef.current.trim() : null,
        ...(helpStep > 0 ? { helpStep } : {}),
      });
      sttDraftRef.current = null;
      setDraft('');
      setProposal(null);
      setErrorMessage(null);
      setPhase('thinking');
      logStep('CHILD_TURN', { turn_number: turnNumber, help_step: helpStep });
      // 아이 말을 보낸 뒤 그레텔 답이 화면에 나오기까지(Q-40 UT - 기다림이 대화를 끊는지 본다).
      const sentAt = Date.now();

      try {
        const prepared = await requestReply(
          {
            storyId: storyPackage.storyId,
            sceneId,
            conversationId,
            transcript: childText,
            speakerId: character.speakerId,
            inputMode,
            childId: conversationAttribution.childId,
            tutorStudentId,
            lessonId,
            history,
            scene: buildDialogueScene(storyPackage, sceneId, heardClipId()),
            executedActions,
            anchorId: mode === 'INVITE' ? anchorId : null,
            wrapUp,
            ...(mode === 'INVITE' && anchorId ? { attempt: attemptRequest(attemptRef.current, anchorId) } : {}),
          },
          seq,
          controller,
          // 첫 소리가 난 순간도 남긴다(보낸 뒤 그레텔 목소리가 들리기까지).
          () => logStep('VOICE_START', { turn_number: turnNumber, latency_ms: Date.now() - sentAt }),
        );
        if (!prepared || seq !== requestSeqRef.current) return;

        const { reply } = prepared;
        const signal = reply.dialogue;
        lastReplyRef.current = reply.responseText;
        if (signal.childMeaning) lastChildMeaningRef.current = signal.childMeaning;
        // 말풍선은 requestReply가 띄웠다(스트리밍이면 답 문장이 온 순간).
        const latencyMs = prepared.shownAt - sentAt;
        logStep('REPLY', { reply_kind: signal.replyKind, turn_number: turnNumber, latency_ms: latencyMs });
        const replyTurn = {
          role: 'CHARACTER' as const,
          latencyMs,
          text: reply.responseText,
          characterSpeakerId: character.speakerId,
          replyKind: signal.replyKind,
          proposedFamilyId: mode === 'INVITE' ? signal.proposedActionFamilyId : null,
        };

        const step = nextDialogueStep({
          replyKind: signal.replyKind,
          childWantsToEnd: signal.childWantsToEnd,
          asksForHelp: signal.asksForHelp,
          proposedActionFamilyId: signal.proposedActionFamilyId,
          mode,
          wrapUp,
          helpAvailable: helpStep < helpSteps.length,
        });
        const { ending } = step;
        const nextPhase: DialoguePhase = step.phase;
        // 시도 장면: 시작(TRY_FAIL)·장면 안 대화·마침(ATTEMPT_END·상한·장면 안 행동 제안)을 넘긴다. 이야기 진행은 그대로다.
        const attemptStep = attemptAfterReply(attemptRef.current, {
          anchorId,
          mode,
          replyKind: signal.replyKind,
          proposedActionFamilyId: signal.proposedActionFamilyId,
          childWantsToEnd: signal.childWantsToEnd,
          attempt: signal.attempt,
          tried: signal.childMeaning || text,
          responseText: reply.responseText,
        });
        attemptRef.current = attemptStep.state;
        if (attemptStep.event) reportAttempt(attemptStep.event);
        // 시도 장면 줄도 회차 기록에 아이가 들은 그대로 남긴다(그레텔 답보다 앞).
        if (attemptStep.event?.kind === 'START') {
          for (const line of signal.attempt?.scene ?? []) {
            logTurn({ role: 'CHARACTER', text: line.text, characterSpeakerId: line.speakerId, replyKind: 'ATTEMPT_SCENE' });
          }
        }
        if (nextPhase === 'proposal' && signal.proposedActionFamilyId) {
          setProposal({
            familyId: signal.proposedActionFamilyId,
            childMeaning: signal.childMeaning || text,
          });
        }

        // 말풍선은 이미 떴다 - 음성은 그 뒤에 받아 첫 조각부터 들려준다(deferAudio, 음성 만들기가 기다림의 대부분).
        const played = await speakReply(prepared, seq);
        logTurn({ ...replyTurn, replyAudioPlayed: played === true });
        if (played === null) return;
        if (ending) {
          await close(signal.childWantsToEnd ? 'CHILD_ENDED' : 'CLOSED_BY_REPLY');
          return;
        }
        setPhase(nextPhase);
      } catch (error) {
        if (controller.signal.aborted || seq !== requestSeqRef.current) return;
        // 채움말이 나오는 중이면 멈춘다 - 오류 안내와 겹치지 않게.
        stopSpeaking();
        if (!attemptActiveNow) childTurnCountRef.current -= 1;
        setErrorMessage(
          isRateLimitedError(error)
            ? RATE_LIMITED_CHILD_COPY
            : error instanceof CompanionChatError
              ? error.message
              : '지금은 그레텔이 대답을 준비하지 못했어.',
        );
        setPhase('error');
        const errorCode = error instanceof CompanionChatError ? (error.code ?? 'FAILED') : 'FAILED';
        logStep('ERROR', { turn_number: turnNumber, error_code: errorCode, latency_ms: Date.now() - sentAt });
        logTurn({ role: 'SYSTEM', event: 'REPLY_FAILED', errorCode });
        reportClientError({
          kind: 'NETWORK',
          message: `dialogue ${error instanceof CompanionChatError ? (error.code ?? 'failed') : 'failed'}`,
          storyId: storyPackage.storyId,
          sceneId: sceneId ?? undefined,
        });
      }
    },
    [
      addTurn, anchorId, cancelPending, character.speakerId, close, conversationAttribution.childId,
      conversationId, executedActions, extended, guardianProxy, heardClipId, helpStep, helpSteps.length, lessonId,
      logStep, logTurn, mode, reportAttempt, requestReply, sceneId, speakReply, stopSpeaking, storyPackage,
      turns, tutorStudentId,
    ],
  );

  // ── 말하기 ────────────────────────────────────────────────

  // 조용해짐 감지와 '다 말했어' 버튼이 겹쳐도 녹음은 한 번만 끝낸다.
  const stoppingRef = useRef(false);
  // 듣기가 막힐 때(패널 닫힘·가려짐)마다 올린다 - 그 전에 시작한 녹음 시작·받아 적기는 버린다.
  const listenSeqRef = useRef(0);
  // 받아 적은 문장 하나는 한 번만 보낸다(자동 전송과 확인 버튼이 겹쳐도).
  const confirmSentRef = useRef(false);
  const transcribe = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const seqAtStop = requestSeqRef.current;
    const listenSeqAtStop = listenSeqRef.current;
    const stoppedAt = Date.now();
    // 실시간 받아 적기: 남은 PCM을 먼저 보내고 끝을 알린다 - MediaRecorder가 녹음 파일을 마무리하는 사이에 확정 문장이 온다.
    const live = liveRef.current;
    liveRef.current = null;
    const liveFinal = live ? recorder.finishPcmCapture().then(() => live.finish()) : Promise.resolve(null);
    const recording = await recorder.stopRecording().finally(() => {
      stoppingRef.current = false;
    });
    if (seqAtStop !== requestSeqRef.current || listenSeqAtStop !== listenSeqRef.current) {
      live?.abort();
      return;
    }
    if (!sceneId || (!recording?.uploadBlob && (!live || live.failed))) {
      live?.abort();
      setErrorMessage('잘 안 들렸어. 다시 말해 줄래?');
      setPhase('error');
      logTurn({ role: 'SYSTEM', event: 'STT_FAILED', errorCode: 'NO_RECORDING' });
      return;
    }
    cancelPending();
    const seq = requestSeqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('transcribing');
    try {
      const streamed = await liveFinal;
      if (seq !== requestSeqRef.current) return;
      setLivePartial('');
      let transcript = streamed;
      if (!transcript) {
        // 실시간 받아 적기가 없거나 실패했다 - 같이 녹음해 둔 파일로 받아 적는다(배치).
        if (!recording?.uploadBlob) throw new CompanionChatError('이번에는 말소리를 알아듣지 못했어.');
        transcript = await transcribeCompanionChatAudio(
          {
            storyId: storyPackage.storyId,
            sceneId,
            audioBlob: recording.uploadBlob,
            mimeType: recording.mimeType,
            sessionId: conversationId,
            childId: conversationAttribution.childId,
            tutorStudentId,
            lessonId,
          },
          controller.signal,
        );
      }
      if (seq !== requestSeqRef.current) return;
      // 말이 끝난 뒤 받아 적은 문장이 나오기까지 - 실시간(STREAM)과 배치(BATCH)를 운영에서 비교한다.
      logStep('TRANSCRIBED', { stt_mode: streamed ? 'STREAM' : 'BATCH', stt_ms: Date.now() - stoppedAt, stream_tried: Boolean(live) });
      inputModeRef.current = 'VOICE';
      confirmSentRef.current = false;
      sttDraftRef.current = transcript.slice(0, MAX_TEXT);
      setDraft(transcript.slice(0, MAX_TEXT));
      setPhase('confirm');
    } catch (error) {
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      logTurn({
        role: 'SYSTEM',
        event: 'STT_FAILED',
        errorCode: error instanceof CompanionChatError ? (error.code ?? 'FAILED') : 'FAILED',
      });
      if (error instanceof CompanionChatError && isSttUnavailableCode(error.code)) {
        // 음성 인식이 막혔다 - 안내 문구와 함께 글로 쓰는 입력으로 바로 넘긴다.
        setDraft('');
        inputModeRef.current = 'TEXT';
        setErrorMessage(STT_UNAVAILABLE_CHILD_COPY);
        setPhase('typing');
        return;
      }
      setErrorMessage(
        isRateLimitedError(error)
          ? RATE_LIMITED_CHILD_COPY
          : error instanceof CompanionChatError
            ? error.message
            : '이번에는 말소리를 알아듣지 못했어.',
      );
      setPhase('error');
    }
  }, [cancelPending, conversationAttribution.childId, conversationId, lessonId, logStep, logTurn, recorder, sceneId, storyPackage.storyId, tutorStudentId]);

  /** 말하기 - 그레텔이 말하는 중이면 끊고 바로 듣는다. 말이 끝나면(조용해지면) 저절로 멈춘다. */
  const startTalking = useCallback(async () => {
    primeResponseAudio();
    primeRecorderAudio();
    // 확인 단계에서 "다시 말하기"를 눌렀으면 마이크가 켜지는 사이 자동 전송이 끼어들지 않게 막는다.
    confirmSentRef.current = true;
    cancelPending();
    stopSpeaking();
    setErrorMessage(null);
    const seq = requestSeqRef.current;
    const listenSeq = listenSeqRef.current;
    const stillWanted = () => seq === requestSeqRef.current && listenSeq === listenSeqRef.current;
    if (recorder.permissionState !== 'granted') {
      const granted = await recorder.requestPermission();
      if (!stillWanted()) return;
      if (!granted) {
        setErrorMessage(recorder.error ?? '마이크를 쓸 수 없어. 글로 써 줄래?');
        setPhase('error');
        return;
      }
    }
    // 실시간 받아 적기 - 표 받기·연결은 마이크가 켜지는 동안 함께 한다(그 사이 소리는 모아 뒀다가 보낸다).
    const live =
      STT_STREAMING_ENABLED && sceneId
        ? startLiveTranscription({
            storyId: storyPackage.storyId,
            sceneId,
            sessionId: conversationId,
            childId: conversationAttribution.childId,
            tutorStudentId,
            lessonId,
            onPartial: (text) => {
              if (liveRef.current === live) setLivePartial(text);
            },
          })
        : null;
    liveRef.current = live;
    const discardLive = () => {
      if (liveRef.current === live) dropLive();
      else live?.abort();
    };
    try {
      await recorder.startRecording(
        live ? { onPcmFrame: live.push, onPcmUnavailable: () => live.abort() } : undefined,
      );
      // 마이크가 켜지는 사이 패널이 닫혔거나 가려졌거나 다른 입력이 시작됐으면 바로 끈다.
      if (!stillWanted()) {
        discardLive();
        void recorder.stopRecording();
        return;
      }
      setPhase('recording');
    } catch {
      discardLive();
      if (!stillWanted()) return;
      setErrorMessage(recorder.error ?? '녹음을 시작하지 못했어. 글로 써 줄래?');
      setPhase('error');
    }
  }, [
    cancelPending, conversationAttribution.childId, conversationId, dropLive, lessonId, recorder, sceneId, stopSpeaking,
    storyPackage.storyId, tutorStudentId,
  ]);

  const stopTalking = useCallback(() => {
    if (recorder.isRecording) void transcribe();
  }, [recorder.isRecording, transcribe]);

  /**
   * 마이크를 켰는데 끝내 말이 없었다(Q-34 무응답) - 녹음은 보내지 않고 버린다. 질문 초대에서 아직 한 마디도
   * 안 했으면 질문을 건너뛰고 이야기를 이어 가고, 대화 중이었으면 아이 차례로 돌아간다.
   */
  const giveUpListening = useCallback(async () => {
    if (stoppingRef.current) return;
    if (mode === 'INVITE' && childTurnCountRef.current === 0) {
      await close('CONTINUE', 'no_speech_timeout');
      return;
    }
    cancelPending();
    if (recorder.isRecording) await recorder.stopRecording();
    setPhase('ready');
  }, [cancelPending, close, mode, recorder]);

  // 말한 뒤 조용해지면 저절로 끝내고, 15초 말이 없으면 다시 묻고, 그 뒤 15초도 없으면 포기한다(30초 상한 포함).
  // 패널이 닫히거나(초대가 끝남·닫기) 메뉴에 가려지면 듣기를 멈춘다: 단계는 렌더 중에 맞추고,
  // 녹음 끄기와 늦게 올 결과 버리기는 effect에서 한다. 자동 종료·무응답 타이머는 enabled가 꺼지며 정리된다.
  const listeningBlocked = !open || paused;
  if (listeningBlocked && phase === 'recording') {
    setPhase('ready');
  }
  useEffect(() => {
    if (!listeningBlocked) return;
    listenSeqRef.current += 1;
    // 중간 문장은 듣는 단계에서만 보이므로 지우지 않아도 된다(다음 말하기가 cancelPending으로 지운다).
    liveRef.current?.abort();
    liveRef.current = null;
    void recorder.stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listeningBlocked]);

  const autoStop = useSpeechAutoStop(recorder, {
    enabled: phase === 'recording' && !listeningBlocked,
    onSpeechEnd: () => void transcribe(),
    onGiveUp: () => void giveUpListening(),
  });

  /**
   * 초대 카드의 [궁금한 거 물어보기] - 그레텔 패널을 질문 초대 모드로 열고, 초대 대사를 그레텔의 첫 말풍선으로
   * 둔다. 가정 세션은 누르자마자 듣기 시작한다(Q-34). 반 수업은 선생님이 "말하기"·"글로 쓰기"를 고른다.
   */
  const openInvite = useCallback(() => {
    if (!invitedAnchorId || open) return;
    primeResponseAudio();
    preloadFillers();
    resetSessionState();
    resetSessionRefs('INVITE');
    inviteChildSpokeRef.current = false;
    setMode('INVITE');
    setAnchorId(invitedAnchorId);
    setTurns([{ id: `invite-${invitedAnchorId}`, role: 'CHARACTER', text: activeQuestionPrompt, fixed: true }]);
    setOpen(true);
    const payload: StepMetadata = { entry_mode: 'INVITE', turn_kind: 'OPEN', anchor_id: invitedAnchorId };
    if (sceneId) payload.scene_id = sceneId;
    void trackStoryEvent('dialogue_step', payload);
    // 다음 틱에 시작한다 - 패널이 열린 뒤에 듣기 시작해야 "닫힌 패널은 듣지 않기" 가드에 걸리지 않는다.
    if (!lessonId) setTimeout(() => void startTalking(), 0);
  }, [activeQuestionPrompt, invitedAnchorId, lessonId, open, preloadFillers, resetSessionRefs, sceneId, startTalking, trackStoryEvent]);

  /** 초대 카드의 [이야기 계속 듣기] - 패널을 열지 않고 질문을 건너뛴다(대화 기록엔 INVITE_SKIPPED). */
  const skipInvite = useCallback(async () => {
    if (!invitedAnchorId) return;
    if (sceneId) {
      recordTurn({
        sceneId,
        visualId: visualAssetId,
        anchorId: invitedAnchorId,
        entryMode: 'INVITE',
        role: 'SYSTEM',
        event: 'INVITE_SKIPPED',
      });
    }
    await runtime.continueFromInvite(invitedAnchorId);
  }, [invitedAnchorId, recordTurn, runtime, sceneId, visualAssetId]);

  const confirmTranscript = useCallback(() => {
    if (confirmSentRef.current) return;
    confirmSentRef.current = true;
    void send(draft, 'VOICE');
  }, [draft, send]);

  // ── 글로 쓰기 ─────────────────────────────────────────────

  const startTyping = useCallback(() => {
    cancelPending();
    stopSpeaking();
    if (recorder.isRecording) void recorder.stopRecording();
    setErrorMessage(null);
    // 받아 적은 문장을 고쳐 쓰는 거면 음성 입력으로 남기고(고쳐 씀 표시), 새로 쓰는 거면 글 입력이다.
    if (phase !== 'confirm') {
      setDraft('');
      sttDraftRef.current = null;
      inputModeRef.current = 'TEXT';
    }
    setPhase('typing');
  }, [cancelPending, phase, recorder, stopSpeaking]);

  /** 글 입력은 한 번 누르면 바로 보낸다(Q-34 - 글 질문 이중 확인 제거). */
  const sendTyped = useCallback(() => {
    void send(draft, inputModeRef.current);
  }, [draft, send]);

  const cancelInput = useCallback(() => {
    if (recorder.isRecording) void recorder.stopRecording();
    cancelPending();
    setDraft('');
    setErrorMessage(null);
    setPhase('ready');
  }, [cancelPending, recorder]);

  // ── 도움 ──────────────────────────────────────────────────

  /**
   * 대화를 나눈 뒤의 도움 - 미리 쓴 도움 대사를 방향(hint)으로 보내 그레텔이 앞 대화에 이어지게 새로 말한다
   * (PM 피드백: 대화 중에 눌러도 처음 도움 멘트가 그대로 나왔다). 실패하면 false - 미리 쓴 대사로 돌아간다.
   */
  const sayContextualHelp = useCallback(
    async (step: number) => {
      if (!anchorId || !sceneId) return false;
      const seq = requestSeqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      setPhase('thinking');
      const sentAt = Date.now();
      try {
        const prepared = await requestReply(
          {
            storyId: storyPackage.storyId,
            sceneId,
            conversationId,
            transcript: '도와줘',
            speakerId: character.speakerId,
            inputMode: 'TEXT',
            childId: conversationAttribution.childId,
            tutorStudentId,
            lessonId,
            history: turns.map(({ role, text }) => ({ role, text })),
            scene: buildDialogueScene(storyPackage, sceneId, heardClipId()),
            executedActions,
            anchorId,
            wrapUp: 'NONE',
            help: { step, total: helpSteps.length, hint: helpSteps[step - 1] },
          },
          seq,
          controller,
        );
        if (!prepared || seq !== requestSeqRef.current) return true;
        const { reply } = prepared;
        lastReplyRef.current = reply.responseText;
        const played = await speakReply(prepared, seq);
        logTurn({
          role: 'CHARACTER',
          text: reply.responseText,
          latencyMs: prepared.shownAt - sentAt,
          characterSpeakerId: character.speakerId,
          replyKind: reply.dialogue.replyKind,
          replyAudioPlayed: played === true,
          helpStep: step,
          entryMode: 'HELP',
        });
        if (played !== null) setPhase('ready');
        return true;
      } catch {
        // 끊긴 요청이면 도움을 다시 말하지 않는다. 그 밖의 실패는 미리 쓴 대사로 돕는다.
        return controller.signal.aborted || seq !== requestSeqRef.current;
      }
    },
    [
      anchorId, character.speakerId, conversationAttribution.childId, conversationId, executedActions,
      heardClipId, helpSteps, lessonId, logTurn, requestReply, sceneId, speakReply, storyPackage, turns, tutorStudentId,
    ],
  );

  /** 아이가 원할 때만 도움 대사를 한 단계씩 들려준다(시간이 지났다고 저절로 주지 않는다). */
  const askHelp = useCallback(async (childLabel = '도와줘') => {
    if (!anchorId || helpStep >= helpSteps.length) return;
    cancelPending();
    stopSpeaking();
    // 아이가 누른 말을 아이 말풍선으로 먼저 보여 준 뒤 그레텔이 돕는다(대화처럼 읽히게). 기록엔 HELP 단계로 남는다.
    addTurn({ role: 'CHILD', text: childLabel });
    const step = helpStep + 1;
    setHelpStep(step);
    if (childTurnCountRef.current === 0) entryModeRef.current = 'HELP';
    logStep('HELP', { help_step: step });
    // 아이가 아직 아무 말도 안 했으면 이어 갈 맥락이 없다 - 미리 녹음한 도움 대사가 빠르고 정확하다.
    if (childTurnCountRef.current > 0 && (await sayContextualHelp(step))) return;
    await sayFixedLine(`dialogue-${anchorId}-help-${step}`, helpSteps[step - 1], step);
  }, [addTurn, anchorId, cancelPending, helpStep, helpSteps, logStep, sayContextualHelp, sayFixedLine, stopSpeaking]);

  /** 마지막 도움 단계에서 보여 주는 예시(C) - 고르면 바로 그 행동으로 이어 간다("예시 후 선택"). */
  const suggestions = helpStep >= helpSteps.length && helpSteps.length > 0 ? (inviteHelp?.suggestions ?? []) : [];

  // ── 행동 확인 ─────────────────────────────────────────────

  const runAction = useCallback(
    async (familyId: string, childMeaning: string, viaSuggestion: boolean, suggestionLabel?: string) => {
      cancelPending();
      stopSpeaking();
      if (recorder.isRecording) await recorder.stopRecording();
      logStep('CONFIRM', { family_id: familyId, via_suggestion: viaSuggestion, help_step: helpStep });
      logTurn({
        role: 'SYSTEM',
        event: 'ACTION_CONFIRMED',
        familyId,
        viaSuggestion,
        suggestionLabel: suggestionLabel ?? null,
        resultVisualId: storyPackage.branchIllustrationAssetId(familyId),
        ...(helpStep > 0 ? { helpStep } : {}),
      });
      inviteChildSpokeRef.current = true;
      setOpen(false);
      await runtime.confirmDialogueAction(familyId, childMeaning, { viaSuggestion, suggestionLabel });
    },
    [cancelPending, helpStep, logStep, logTurn, recorder, runtime, stopSpeaking, storyPackage],
  );

  const acceptProposal = useCallback(() => {
    if (proposal) void runAction(proposal.familyId, proposal.childMeaning, false);
  }, [proposal, runAction]);

  const chooseSuggestion = useCallback(
    (familyId: string, label: string) => {
      void runAction(familyId, label, true, label);
    },
    [runAction],
  );

  /** 행동 제안·복귀 제안·도움 제안을 미루고 대화를 이어 간다. */
  const keepTalking = useCallback(() => {
    if (phase === 'suggest-return') setExtended(true);
    logStep('KEEP_TALKING', { reply_kind: phase });
    // 제안한 행동을 지금은 하지 않기로 함 - 제안과 실제 실행을 구분해 남긴다.
    if (phase === 'proposal' && proposal) logTurn({ role: 'SYSTEM', event: 'ACTION_DECLINED', familyId: proposal.familyId });
    setProposal(null);
    setPhase('ready');
  }, [logStep, logTurn, phase, proposal]);

  // 이야기 화면을 떠나면 진행 중인 요청·음성을 멈춘다.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      audioAbortRef.current?.abort();
      liveRef.current?.abort();
    },
    [],
  );

  const listenPrompt = autoStop.reprompted ? NO_SPEECH_REPROMPT_COPY : LISTEN_NOW_COPY;
  const meterPercent = Math.max(8, Math.min(100, (((recorder.meteringDb ?? -60) + 60) / 48) * 100));

  return {
    open,
    mode,
    anchorId,
    character,
    turns,
    phase,
    draft,
    setDraft: (value: string) => setDraft(value.slice(0, MAX_TEXT)),
    errorMessage,
    meterPercent,
    listenPrompt,
    livePartial,
    characterName,
    canAskHelp: mode === 'INVITE' && helpStep < helpSteps.length,
    helpStep,
    suggestions,
    proposalLabel: proposal
      ? (storyPackage.manifest.fallbackFamilies.find((family) => family.id === proposal.familyId)?.meaning ?? null)
      : null,
    openChat,
    openInvite,
    skipInvite,
    close,
    startTalking,
    stopTalking,
    confirmTranscript,
    startTyping,
    sendTyped,
    cancelInput,
    askHelp,
    acceptProposal,
    chooseSuggestion,
    keepTalking,
    stopSpeaking,
    // 반 수업이 아닐 때만 보여 준다(반 수업은 늘 선생님 입력).
    canMarkGuardianProxy: !lessonId,
    guardianProxy,
    setGuardianProxy,
  };
}

export type UseDialogue = ReturnType<typeof useDialogue>;
export type { CompanionReplyKind };

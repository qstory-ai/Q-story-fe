import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  playResponseAudio,
  primeResponseAudio,
  type BufferedResponseAudio,
} from '@/features/route-question';
import { useAudioRecorderAdapter } from '@/features/record-question';
import { reportClientError } from '@/entities/analytics';
import {
  CompanionChatError,
  sendCompanionChatMessage,
  transcribeCompanionChatAudio,
  type CompanionReplyKind,
} from '@/entities/companion-chat';
import { STT_UNAVAILABLE_CHILD_COPY, isSttUnavailableCode } from '@/entities/speech-pipeline';

import { GRETEL_COMPANION } from '../lib/companion-character';
import { buildDialogueScene, wrapUpFor, type WrapUpSignal } from '../lib/dialogue-context';
import type { OneStoryRuntime } from './use-one-story-runtime';

/** CHAT = 아이가 스스로 연 그레텔 대화, INVITE = 이야기 속 질문 초대에서 이어지는 대화. */
export type DialogueMode = 'CHAT' | 'INVITE';

export type DialogueTurn = {
  id: string;
  role: 'CHILD' | 'CHARACTER';
  text: string;
  /** 그레텔 말 중에서 도움 대사·초대 대사처럼 미리 정해 둔 말인지(대화 기록에서 구분해 보여 준다). */
  fixed?: boolean;
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

/** 말이 끝났다고 보는 기준 - 말소리가 한 번 들린 뒤 이만큼 조용하면 녹음을 끝낸다. */
const SPEECH_DB = -42;
const SILENCE_DB = -50;
const SILENCE_AFTER_SPEECH_MS = 1_400;
const NO_SPEECH_TIMEOUT_MS = 8_000;
const MAX_RECORDING_MS = 20_000;
const MAX_TEXT = 160;

type Proposal = { familyId: string; childMeaning: string };

type StepMetadata = Record<string, string | number | boolean>;

export function useDialogue({
  runtime,
  conversationId,
  tutorStudentId,
  lessonId,
}: {
  runtime: OneStoryRuntime;
  conversationId: string;
  tutorStudentId?: string;
  lessonId?: string;
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
  } = runtime;
  const character = GRETEL_COMPANION;
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

  const childTurnCountRef = useRef(0);
  const openedAtRef = useRef(0);
  const entryModeRef = useRef<'SPONTANEOUS' | 'INVITE' | 'HELP'>('SPONTANEOUS');
  const lastChildMeaningRef = useRef('');
  const lastReplyRef = useRef('');
  const inputModeRef = useRef<'VOICE' | 'TEXT'>('TEXT');
  // 요청마다 번호를 붙여, 닫았거나 새 말을 시작한 뒤에 도착한 답·전사는 버린다.
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const audioAbortRef = useRef<AbortController | null>(null);

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

  const stopSpeaking = useCallback(() => {
    audioAbortRef.current?.abort();
    audioAbortRef.current = null;
    void runtime.stopDialogueSpeech();
  }, [runtime]);

  const cancelPending = useCallback(() => {
    requestSeqRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const addTurn = useCallback((turn: Omit<DialogueTurn, 'id'>) => {
    setTurns((previous) => [
      ...previous,
      { ...turn, id: `${Date.now()}-${previous.length}` },
    ]);
  }, []);

  /** 그레텔의 고정 대사를 기록에 남기고 그레텔 목소리로 말한다(미리 녹음한 음성이 있으면 그것). */
  const sayFixedLine = useCallback(
    async (lineId: string, text: string) => {
      const seq = requestSeqRef.current;
      addTurn({ role: 'CHARACTER', text, fixed: true });
      setPhase('speaking');
      try {
        await runtime.speakDialogueLine(lineId, text, character.speakerId);
      } catch {
        // 음성이 실패해도 글은 이미 패널에 있다.
      }
      if (seq === requestSeqRef.current) setPhase('ready');
    },
    [addTurn, character.speakerId, runtime],
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
    resetSessionState();
    resetSessionRefs('SPONTANEOUS');
    setMode('CHAT');
    setAnchorId(null);
    setTurns([
      { id: 'greeting', role: 'CHARACTER', text: '응, 나 여기 있어. 무슨 이야기 하고 싶어?', fixed: true },
    ]);
    setOpen(true);
    await runtime.pauseForDialogue();
    logStep('OPEN');
  }, [logStep, open, resetSessionRefs, runtime]);

  // 질문 초대 대사가 끝나면(awaiting-question) 같은 패널을 질문 초대 모드로 연다.
  // 초대 대사는 이미 낭독으로 들었으므로 다시 말하지 않고 첫 말풍선으로만 둔다.
  // 상태는 렌더 중에 맞추고(React의 "prop이 바뀔 때 state 조정" 방식), ref·로그·소리 정리는 effect에서 한다.
  const invitedAnchorId = runtimeState.status === 'awaiting-question' ? runtimeState.anchorId : null;
  const [seenInviteAnchorId, setSeenInviteAnchorId] = useState<string | null>(null);
  if (invitedAnchorId !== seenInviteAnchorId) {
    setSeenInviteAnchorId(invitedAnchorId);
    if (invitedAnchorId) {
      resetSessionState();
      setMode('INVITE');
      setAnchorId(invitedAnchorId);
      setTurns([{ id: `invite-${invitedAnchorId}`, role: 'CHARACTER', text: activeQuestionPrompt, fixed: true }]);
      setOpen(true);
    } else if (mode === 'INVITE' && open) {
      // 이야기가 질문 초대를 벗어나면(행동 확인, 처음부터 다시 등) 초대 패널은 닫는다.
      setOpen(false);
    }
  }
  useEffect(() => {
    if (invitedAnchorId) {
      resetSessionRefs('INVITE');
      const payload: StepMetadata = { entry_mode: 'INVITE', turn_kind: 'OPEN', anchor_id: invitedAnchorId };
      if (sceneId) payload.scene_id = sceneId;
      void trackStoryEvent('dialogue_step', payload);
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
    async (reason: 'CONTINUE' | 'CLOSED_BY_REPLY' | 'CHILD_ENDED' = 'CONTINUE') => {
      cancelPending();
      stopSpeaking();
      if (recorder.isRecording) await recorder.stopRecording();
      logStep('CLOSE', { reply_kind: reason, turn_number: childTurnCountRef.current });
      if (mode === 'INVITE' && anchorId) {
        if (childTurnCountRef.current > 0) {
          runtime.recordDialogueOutcome(anchorId, lastChildMeaningRef.current, lastReplyRef.current);
        }
        // B처럼 행동 없이 대화만 하는 지점은 "어떻게 했는지 이어서 볼까?"로 이야기에 돌아간다.
        const continueLine = inviteHelp?.continueLine;
        if (continueLine && childTurnCountRef.current > 0) {
          await sayFixedLine(`dialogue-${anchorId}-continue`, continueLine);
        }
        setOpen(false);
        await runtime.continueStory();
        return;
      }
      setOpen(false);
      await runtime.resumeAfterDialogue();
    },
    [anchorId, cancelPending, inviteHelp?.continueLine, logStep, mode, recorder, runtime, sayFixedLine, stopSpeaking],
  );

  // ── 그레텔에게 보내기 ─────────────────────────────────────

  const send = useCallback(
    async (rawText: string, inputMode: 'VOICE' | 'TEXT') => {
      const text = rawText.trim().slice(0, MAX_TEXT);
      if (!text || !sceneId) return;
      cancelPending();
      stopSpeaking();
      const seq = requestSeqRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      const history = turns.map(({ role, text: turnText }) => ({ role, text: turnText }));
      childTurnCountRef.current += 1;
      const turnNumber = childTurnCountRef.current;
      const wrapUp: WrapUpSignal = wrapUpFor(turnNumber, extended);
      addTurn({ role: 'CHILD', text });
      setDraft('');
      setProposal(null);
      setErrorMessage(null);
      setPhase('thinking');
      logStep('CHILD_TURN', { turn_number: turnNumber, help_step: helpStep });

      try {
        const reply = await sendCompanionChatMessage(
          {
            storyId: storyPackage.storyId,
            sceneId,
            conversationId,
            transcript: text,
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
          },
          controller.signal,
        );
        if (seq !== requestSeqRef.current) return;

        const signal = reply.dialogue;
        lastReplyRef.current = reply.responseText;
        if (signal.childMeaning) lastChildMeaningRef.current = signal.childMeaning;
        addTurn({ role: 'CHARACTER', text: reply.responseText });
        logStep('REPLY', { reply_kind: signal.replyKind, turn_number: turnNumber });

        const ending =
          signal.replyKind === 'CLOSE' || signal.childWantsToEnd || wrapUp === 'CLOSE';
        const nextPhase: DialoguePhase = ending
          ? 'ready'
          : signal.proposedActionFamilyId && mode === 'INVITE'
            ? 'proposal'
            : signal.asksForHelp && helpStep < helpSteps.length
              ? 'offer-help'
              : wrapUp === 'SUGGEST_RETURN'
                ? 'suggest-return'
                : 'ready';
        if (nextPhase === 'proposal' && signal.proposedActionFamilyId) {
          setProposal({
            familyId: signal.proposedActionFamilyId,
            childMeaning: signal.childMeaning || text,
          });
        }

        if (reply.audio) {
          setPhase('speaking');
          const audioController = new AbortController();
          audioAbortRef.current = audioController;
          try {
            await playResponseAudio(reply.audio as BufferedResponseAudio, audioController.signal);
          } catch {
            // 음성이 실패해도 글 답은 패널에 있다.
          }
          if (audioController.signal.aborted || seq !== requestSeqRef.current) return;
        }
        if (ending) {
          await close(signal.childWantsToEnd ? 'CHILD_ENDED' : 'CLOSED_BY_REPLY');
          return;
        }
        setPhase(nextPhase);
      } catch (error) {
        if (controller.signal.aborted || seq !== requestSeqRef.current) return;
        childTurnCountRef.current -= 1;
        setErrorMessage(
          error instanceof CompanionChatError ? error.message : '지금은 그레텔이 대답을 준비하지 못했어.',
        );
        setPhase('error');
        logStep('ERROR', { turn_number: turnNumber });
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
      conversationId, executedActions, extended, heardClipId, helpStep, helpSteps.length, lessonId, logStep, mode,
      sceneId, stopSpeaking, storyPackage, turns, tutorStudentId,
    ],
  );

  // ── 말하기 ────────────────────────────────────────────────

  // 조용해짐 감지와 '다 말했어' 버튼이 겹쳐도 녹음은 한 번만 끝낸다.
  const stoppingRef = useRef(false);
  const transcribe = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    const seqAtStop = requestSeqRef.current;
    const recording = await recorder.stopRecording().finally(() => {
      stoppingRef.current = false;
    });
    if (seqAtStop !== requestSeqRef.current) return;
    if (!recording?.uploadBlob || !sceneId) {
      setErrorMessage('잘 안 들렸어. 다시 말해 줄래?');
      setPhase('error');
      return;
    }
    cancelPending();
    const seq = requestSeqRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase('transcribing');
    try {
      const transcript = await transcribeCompanionChatAudio(
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
      if (seq !== requestSeqRef.current) return;
      inputModeRef.current = 'VOICE';
      setDraft(transcript.slice(0, MAX_TEXT));
      setPhase('confirm');
    } catch (error) {
      if (controller.signal.aborted || seq !== requestSeqRef.current) return;
      if (error instanceof CompanionChatError && isSttUnavailableCode(error.code)) {
        // 음성 인식이 막혔다 - 안내 문구와 함께 글로 쓰는 입력으로 바로 넘긴다.
        setDraft('');
        inputModeRef.current = 'TEXT';
        setErrorMessage(STT_UNAVAILABLE_CHILD_COPY);
        setPhase('typing');
        return;
      }
      setErrorMessage(
        error instanceof CompanionChatError ? error.message : '이번에는 말소리를 알아듣지 못했어.',
      );
      setPhase('error');
    }
  }, [cancelPending, conversationAttribution.childId, conversationId, lessonId, recorder, sceneId, storyPackage.storyId, tutorStudentId]);

  /** 말하기 - 그레텔이 말하는 중이면 끊고 바로 듣는다. 말이 끝나면(조용해지면) 저절로 멈춘다. */
  const startTalking = useCallback(async () => {
    primeResponseAudio();
    cancelPending();
    stopSpeaking();
    setErrorMessage(null);
    if (recorder.permissionState !== 'granted') {
      const granted = await recorder.requestPermission();
      if (!granted) {
        setErrorMessage(recorder.error ?? '마이크를 쓸 수 없어. 글로 써 줄래?');
        setPhase('error');
        return;
      }
    }
    try {
      await recorder.startRecording();
      setPhase('recording');
    } catch {
      setErrorMessage(recorder.error ?? '녹음을 시작하지 못했어. 글로 써 줄래?');
      setPhase('error');
    }
  }, [cancelPending, recorder, stopSpeaking]);

  const stopTalking = useCallback(() => {
    if (recorder.isRecording) void transcribe();
  }, [recorder.isRecording, transcribe]);

  // 말소리가 들린 뒤 조용해지면, 또는 오래 말이 없거나 너무 길면 녹음을 끝낸다.
  const heardSpeechRef = useRef(false);
  const silentSinceRef = useRef<number | null>(null);
  useEffect(() => {
    if (!recorder.isRecording) {
      heardSpeechRef.current = false;
      silentSinceRef.current = null;
      return;
    }
    const db = recorder.meteringDb ?? -160;
    const now = Date.now();
    if (db > SPEECH_DB) {
      heardSpeechRef.current = true;
      silentSinceRef.current = null;
    } else if (db < SILENCE_DB) {
      silentSinceRef.current ??= now;
    }
    const silentFor = silentSinceRef.current ? now - silentSinceRef.current : 0;
    const shouldStop =
      (heardSpeechRef.current && silentFor >= SILENCE_AFTER_SPEECH_MS) ||
      (!heardSpeechRef.current && recorder.durationMillis >= NO_SPEECH_TIMEOUT_MS) ||
      recorder.durationMillis >= MAX_RECORDING_MS;
    if (shouldStop) void transcribe();
  }, [recorder.durationMillis, recorder.isRecording, recorder.meteringDb, transcribe]);

  const confirmTranscript = useCallback(() => {
    void send(draft, 'VOICE');
  }, [draft, send]);

  // ── 글로 쓰기 ─────────────────────────────────────────────

  const startTyping = useCallback(() => {
    cancelPending();
    stopSpeaking();
    if (recorder.isRecording) void recorder.stopRecording();
    setErrorMessage(null);
    if (phase !== 'confirm') setDraft('');
    inputModeRef.current = 'TEXT';
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

  /** 아이가 원할 때만 도움 대사를 한 단계씩 들려준다(시간이 지났다고 저절로 주지 않는다). */
  const askHelp = useCallback(async () => {
    if (!anchorId || helpStep >= helpSteps.length) return;
    cancelPending();
    stopSpeaking();
    const step = helpStep + 1;
    setHelpStep(step);
    if (childTurnCountRef.current === 0) entryModeRef.current = 'HELP';
    logStep('HELP', { help_step: step });
    await sayFixedLine(`dialogue-${anchorId}-help-${step}`, helpSteps[step - 1]);
  }, [anchorId, cancelPending, helpStep, helpSteps, logStep, sayFixedLine, stopSpeaking]);

  /** 마지막 도움 단계에서 보여 주는 예시(C) - 고르면 바로 그 행동으로 이어 간다("예시 후 선택"). */
  const suggestions = helpStep >= helpSteps.length && helpSteps.length > 0 ? (inviteHelp?.suggestions ?? []) : [];

  // ── 행동 확인 ─────────────────────────────────────────────

  const runAction = useCallback(
    async (familyId: string, childMeaning: string, viaSuggestion: boolean) => {
      cancelPending();
      stopSpeaking();
      if (recorder.isRecording) await recorder.stopRecording();
      logStep('CONFIRM', { family_id: familyId, via_suggestion: viaSuggestion, help_step: helpStep });
      setOpen(false);
      await runtime.confirmDialogueAction(familyId, childMeaning);
    },
    [cancelPending, helpStep, logStep, recorder, runtime, stopSpeaking],
  );

  const acceptProposal = useCallback(() => {
    if (proposal) void runAction(proposal.familyId, proposal.childMeaning, false);
  }, [proposal, runAction]);

  const chooseSuggestion = useCallback(
    (familyId: string, label: string) => {
      void runAction(familyId, label, true);
    },
    [runAction],
  );

  /** 행동 제안·복귀 제안·도움 제안을 미루고 대화를 이어 간다. */
  const keepTalking = useCallback(() => {
    if (phase === 'suggest-return') setExtended(true);
    logStep('KEEP_TALKING', { reply_kind: phase });
    setProposal(null);
    setPhase('ready');
  }, [logStep, phase]);

  // 이야기 화면을 떠나면 진행 중인 요청·음성을 멈춘다.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      audioAbortRef.current?.abort();
    },
    [],
  );

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
    canAskHelp: mode === 'INVITE' && helpStep < helpSteps.length,
    helpStep,
    suggestions,
    proposalLabel: proposal
      ? (storyPackage.manifest.fallbackFamilies.find((family) => family.id === proposal.familyId)?.meaning ?? null)
      : null,
    openChat,
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
  };
}

export type UseDialogue = ReturnType<typeof useDialogue>;
export type { CompanionReplyKind };

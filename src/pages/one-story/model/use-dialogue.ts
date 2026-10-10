import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  playResponseAudio,
  primeResponseAudio,
  type BufferedResponseAudio,
} from '@/features/route-question';
import {
  LISTEN_NOW_COPY,
  NO_SPEECH_REPROMPT_COPY,
  primeRecorderAudio,
  useAudioRecorderAdapter,
  useSpeechAutoStop,
} from '@/features/record-question';
import { reportClientError } from '@/entities/analytics';
import {
  CompanionChatError,
  sendCompanionChatMessage,
  transcribeCompanionChatAudio,
  type CompanionReplyKind,
} from '@/entities/companion-chat';
import { STT_UNAVAILABLE_CHILD_COPY, isSttUnavailableCode } from '@/entities/speech-pipeline';
import type { PlayTurnInput } from '@/entities/play-session';

import { GRETEL_COMPANION } from '../lib/companion-character';
import { buildDialogueScene, wrapUpFor, type WrapUpSignal } from '../lib/dialogue-context';
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
  }, [character.speakerId, logStep, logTurn, open, resetSessionRefs, runtime]);

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
    [anchorId, cancelPending, inviteHelp?.continueLine, logStep, logTurn, mode, recorder, runtime, sayFixedLine, stopSpeaking],
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
      // 받아 적은 말엔 물음표가 없다 - 묻는 말이면 "?"를 붙여 말풍선에 보이고 그대로 보낸다(글로 쓴 말은 손대지 않는다).
      const childText = inputMode === 'VOICE' ? punctuateChildQuestion(text) : text;
      childTurnCountRef.current += 1;
      const turnNumber = childTurnCountRef.current;
      const wrapUp: WrapUpSignal = wrapUpFor(turnNumber, extended);
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
        const reply = await sendCompanionChatMessage(
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
          },
          controller.signal,
        );
        if (seq !== requestSeqRef.current) return;

        const signal = reply.dialogue;
        lastReplyRef.current = reply.responseText;
        if (signal.childMeaning) lastChildMeaningRef.current = signal.childMeaning;
        addTurn({ role: 'CHARACTER', text: reply.responseText });
        const latencyMs = Date.now() - sentAt;
        logStep('REPLY', { reply_kind: signal.replyKind, turn_number: turnNumber, latency_ms: latencyMs });
        const replyTurn = {
          role: 'CHARACTER' as const,
          latencyMs,
          text: reply.responseText,
          characterSpeakerId: character.speakerId,
          replyKind: signal.replyKind,
          proposedFamilyId: mode === 'INVITE' ? signal.proposedActionFamilyId : null,
        };

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
          let played = false;
          try {
            played = await playResponseAudio(reply.audio as BufferedResponseAudio, audioController.signal);
          } catch {
            // 음성이 실패해도 글 답은 패널에 있다.
          }
          logTurn({ ...replyTurn, replyAudioPlayed: played && !audioController.signal.aborted });
          if (audioController.signal.aborted || seq !== requestSeqRef.current) return;
        } else {
          logTurn({ ...replyTurn, replyAudioPlayed: false });
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
      logStep, logTurn, mode, sceneId, stopSpeaking, storyPackage, turns, tutorStudentId,
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
    const recording = await recorder.stopRecording().finally(() => {
      stoppingRef.current = false;
    });
    if (seqAtStop !== requestSeqRef.current || listenSeqAtStop !== listenSeqRef.current) return;
    if (!recording?.uploadBlob || !sceneId) {
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
        error instanceof CompanionChatError ? error.message : '이번에는 말소리를 알아듣지 못했어.',
      );
      setPhase('error');
    }
  }, [cancelPending, conversationAttribution.childId, conversationId, lessonId, logTurn, recorder, sceneId, storyPackage.storyId, tutorStudentId]);

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
    try {
      await recorder.startRecording();
      // 마이크가 켜지는 사이 패널이 닫혔거나 가려졌거나 다른 입력이 시작됐으면 바로 끈다.
      if (!stillWanted()) {
        void recorder.stopRecording();
        return;
      }
      setPhase('recording');
    } catch {
      if (!stillWanted()) return;
      setErrorMessage(recorder.error ?? '녹음을 시작하지 못했어. 글로 써 줄래?');
      setPhase('error');
    }
  }, [cancelPending, recorder, stopSpeaking]);

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
  }, [activeQuestionPrompt, invitedAnchorId, lessonId, open, resetSessionRefs, sceneId, startTalking, trackStoryEvent]);

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
    await sayFixedLine(`dialogue-${anchorId}-help-${step}`, helpSteps[step - 1], step);
  }, [addTurn, anchorId, cancelPending, helpStep, helpSteps, logStep, sayFixedLine, stopSpeaking]);

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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import {
  createInitialRuntimeState,
  transitionStoryRuntime,
  type QuestionInputMode,
  type QuestionAnchorId,
  type RouteOption,
  type RoutePlan,
  type StoryRuntimeEvent,
  type StoryRuntimeState,
} from '@/entities/story-runtime';
import {
  getCompletionSurveyUrl,
  buildExitDiagnostics,
  sanitizeQuestionText,
  buildParentReport,
  hasExperiencedStoryAgency,
  clearLocalStoryProgress,
  loadLocalStoryProgress,
  saveLocalStoryProgress,
  createVoiceResearchConsent,
  storeVoiceResearchSample,
  type QuestionOutcome,
  type LocalStoryProgress,
  type VoiceResearchConsent,
} from '@/entities/analytics';
import {
  buildCaptionTrack,
  captionCueAtProgress,
  estimateNarrationDurationSeconds,
  audioReadyWithin,
  personalizeStoryText,
} from '@/entities/narration';
import type { TranscriptionSuccess } from '@/entities/speech-pipeline';
import {
  useStoryNarration,
  preloadFixedNarration,
} from '@/features/narrate-story';
import {
  useAudioRecorderAdapter,
  type RecordingResult,
} from '@/features/record-question';
import {
  playResponseAudio,
  primeResponseAudio,
  getQuestionNarration,
  preloadQuestionNarration,
  getResponseNarration,
  type ResponseAudio,
} from '@/features/route-question';

import {
  EXIT_REASONS,
  EXIT_REASON_CODES,
  FIXED_AUDIO_FAILURE_RECOVERY_MS,
  LANDING_URL,
  QUESTION_AUDIO_HEAD_START_MS,
  RESPONSE_AUDIO_PREPARE_MS,
  TOTAL_SCENES,
  speechPipeline,
  storyManifest,
  storyPackage,
  storyPresentation,
  trackStoryEvent,
} from '../lib/constants';
import {
  getBranchFamily,
  getRuntimeClip,
  getSceneIndex,
  getVisualAssetId,
  questionFailureCopy,
  questionPrompt,
} from '../lib/runtime-view';

export function useOneStoryRuntime() {
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;
  const isShort = height < 720;
  const recorder = useAudioRecorderAdapter();
  const {
    speak: speakNarration,
    stop: stopNarration,
    pause: pauseNarration,
    resume: resumeNarration,
    state: narrationState,
  } = useStoryNarration(storyPackage.audioAssets);
  const initialState = useMemo(
    () => createInitialRuntimeState(storyManifest),
    [],
  );
  const [runtimeState, setRuntimeState] =
    useState<StoryRuntimeState>(initialState);
  const runtimeRef = useRef<StoryRuntimeState>(initialState);
  const storyStartedAtRef = useRef<number | null>(null);
  const trackedScenesRef = useRef(new Set<string>());
  const trackedQuestionInvitesRef = useRef(new Set<string>());
  const trackedFailuresRef = useRef(new Set<string>());
  const completionTrackedRef = useRef(false);
  const questionAttemptCountRef = useRef(0);
  const sttAttemptCountRef = useRef(0);
  const questionInputSwitchedRef = useRef(false);
  const transcriptCorrectedRef = useRef(false);
  const pendingSttMsRef = useRef<number | null>(null);
  const questionRouteStartedAtRef = useRef<number | null>(null);
  const firstResponseAudioMsRef = useRef<number | null>(null);
  const trackedPlaybackResultsRef = useRef(new Set<string>());
  const activeNarrationIdRef = useRef<string | null>(null);
  const processingAbortRef = useRef<AbortController | null>(null);
  const voiceResearchConsentRef = useRef<VoiceResearchConsent | null>(null);
  const pendingVoiceResearchSampleRef = useRef<{
    recording: RecordingResult;
    sttDraft: string;
  } | null>(null);
  const [childNameInput, setChildNameInput] = useState('');
  const [childName, setChildName] = useState('');
  const [voiceResearchConsentChecked, setVoiceResearchConsentChecked] =
    useState(false);
  const [parentMessage, setParentMessage] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [pendingTranscription, setPendingTranscription] =
    useState<TranscriptionSuccess | null>(null);
  const [isRoutingQuestion, setIsRoutingQuestion] = useState(false);
  const [pendingResponseAudio, setPendingResponseAudio] =
    useState<ResponseAudio | null>(null);
  const [questionMode, setQuestionMode] =
    useState<QuestionInputMode>('voice');
  const [typedQuestion, setTypedQuestion] = useState('');
  const [activeBranchVisualId, setActiveBranchVisualId] =
    useState<string | null>(null);
  const [branchCaption, setBranchCaption] = useState<{
    text: string;
    speakerId: string;
    progress: number | null;
  } | null>(null);
  const [captionVisible, setCaptionVisible] = useState(true);
  const [questionInviteSpeaking, setQuestionInviteSpeaking] = useState(false);
  const [narrationAttempt, setNarrationAttempt] = useState(0);
  const [questionOutcomes, setQuestionOutcomes] = useState<QuestionOutcome[]>(
    [],
  );
  const [storyDurationSeconds, setStoryDurationSeconds] = useState<
    number | null
  >(null);
  const [parentReportVisible, setParentReportVisible] = useState(false);
  const [resumeCandidate, setResumeCandidate] =
    useState<LocalStoryProgress | null>(() => loadLocalStoryProgress());
  const [homeMenuVisible, setHomeMenuVisible] = useState(false);
  const [exitReasonVisible, setExitReasonVisible] = useState(false);
  const parentReport = useMemo(
    () =>
      buildParentReport(storyPackage.reportCopy, questionOutcomes, {
        durationSeconds: storyDurationSeconds,
        branchAssetId: storyPackage.branchIllustrationAssetId,
        branchSummary: storyPackage.branchReportSummary,
      }),
    [questionOutcomes, storyDurationSeconds],
  );

  const elapsedStorySeconds = useCallback(() => {
    if (storyStartedAtRef.current === null) {
      return storyDurationSeconds ?? 0;
    }
    return Math.max(
      0,
      Math.round((Date.now() - storyStartedAtRef.current) / 1000),
    );
  }, [storyDurationSeconds]);

  const persistCurrentProgress = useCallback(() => {
    return saveLocalStoryProgress({
      state: runtimeRef.current,
      childName,
      elapsedSeconds: elapsedStorySeconds(),
      questionOutcomes,
    });
  }, [childName, elapsedStorySeconds, questionOutcomes]);

  useEffect(() => {
    if (runtimeState.status !== 'idle') {
      persistCurrentProgress();
    }
  }, [persistCurrentProgress, runtimeState]);

  useEffect(() => {
    if (runtimeState.status !== 'playing-fixed') return;
    if (trackedScenesRef.current.has(runtimeState.sceneId)) return;
    trackedScenesRef.current.add(runtimeState.sceneId);
    void trackStoryEvent('scene_reached', { scene_id: runtimeState.sceneId });
  }, [runtimeState]);

  useEffect(() => {
    if (runtimeState.status !== 'awaiting-question') return;
    const inviteKey = `${runtimeState.anchorId}:${runtimeState.questionRound}`;
    if (trackedQuestionInvitesRef.current.has(inviteKey)) return;
    trackedQuestionInvitesRef.current.add(inviteKey);
    void trackStoryEvent('question_invite_shown', {
      anchor_id: runtimeState.anchorId,
      scene_id: runtimeState.sceneId,
    });
  }, [runtimeState]);

  useEffect(() => {
    if (runtimeState.status !== 'failed-recoverable') return;
    const failureKey = [
      runtimeState.anchorId ?? 'none',
      runtimeState.questionRound ?? 0,
      runtimeState.failure.stage,
      runtimeState.failure.code,
    ].join(':');
    if (trackedFailuresRef.current.has(failureKey)) return;
    trackedFailuresRef.current.add(failureKey);
    void trackStoryEvent('question_result', {
      ...(runtimeState.anchorId ? { anchor_id: runtimeState.anchorId } : {}),
      result: 'failed',
      failure_stage: runtimeState.failure.stage,
      failure_code: runtimeState.failure.code,
      retryable: runtimeState.failure.retryable,
      attempt_count: Math.max(1, questionAttemptCountRef.current),
      stt_attempt_count: sttAttemptCountRef.current,
      transcript_corrected: transcriptCorrectedRef.current,
      switched_input: questionInputSwitchedRef.current,
    });
  }, [runtimeState]);

  const openExternal = useCallback(async (url: string) => {
    window.location.assign(url);
  }, []);

  const rememberQuestionOutcome = useCallback(
    (
      anchorId: QuestionAnchorId,
      plan: RoutePlan,
      selectedOption?: Pick<
        RouteOption,
        'label' | 'meaning' | 'actionFamilyId'
      >,
    ) => {
      if (
        plan.route === 'CLARIFY_ONCE' ||
        plan.route === 'SKIP_CONTINUE'
      ) {
        return;
      }
      const outcome: QuestionOutcome = {
        anchorId,
        childRelevantMeaning: plan.childRelevantMeaning,
        route: plan.route,
        responseText: plan.text,
        actionFamilyId:
          selectedOption?.actionFamilyId ?? plan.actionFamilyId ?? null,
        selectedOption,
      };
      setQuestionOutcomes((current) => [
        ...current.filter((item) => item.anchorId !== anchorId),
        outcome,
      ]);
    },
    [],
  );

  const commitEvent = useCallback((event: StoryRuntimeEvent) => {
    const previousState = runtimeRef.current;
    const transition = transitionStoryRuntime(
      storyManifest,
      previousState,
      event,
    );
    if (!transition.ok) {
      setParentMessage(
        `이야기 흐름을 이어가지 못했어요. (${transition.failure.code})`,
      );
      return false;
    }
    runtimeRef.current = transition.state;
    setRuntimeState(transition.state);
    if (transition.state.status === 'playing-fixed') {
      setParentMessage(null);
    }
    return true;
  }, []);

  const currentClip = getRuntimeClip(runtimeState);
  const currentPresentation = currentClip
    ? storyPresentation.utteranceByClipId[currentClip.id]
    : null;
  const sceneIndex = getSceneIndex(runtimeState);
  const displayedSceneIndex =
    runtimeState.status === 'idle' && resumeCandidate
      ? getSceneIndex(resumeCandidate.state)
      : sceneIndex;
  const scene = storyPresentation.scenes[sceneIndex];
  const speaker = currentClip
    ? storyManifest.speakers.find(
        (candidate) => candidate.id === currentClip.speakerId,
      )
    : null;
  const questionInviteAnchor =
    runtimeState.status === 'playing-fixed' &&
    currentPresentation?.role.startsWith('QUESTION_INVITE:')
      ? (storyManifest.questionAnchors.find(
          (anchor) => anchor.afterAudioGroupId === runtimeState.audioGroupId,
        ) ?? null)
      : null;
  const activeQuestionAnchor =
    questionInviteAnchor ??
    ('anchorId' in runtimeState
      ? (storyManifest.questionAnchors.find(
          (anchor) => anchor.id === runtimeState.anchorId,
        ) ?? null)
      : null);
  const isQuestionInvitePlayback = questionInviteAnchor !== null;
  const branch = getBranchFamily(runtimeState);
  const isBranchPlaybackState =
    runtimeState.status === 'playing-response' && branch !== null;
  const isPlaybackDockState =
    (runtimeState.status === 'playing-fixed' && !isQuestionInvitePlayback) ||
    isBranchPlaybackState;
  const isCompactPlayback = width <= 430 && isPlaybackDockState;
  const spokenText = currentClip
    ? personalizeStoryText(currentClip.transcript, childName)
    : '';
  const captionClip = narrationState.captionRequestId
    ? (storyManifest.audioGroups
        .flatMap((group) => group.clips)
        .find((clip) => clip.id === narrationState.captionRequestId) ?? null)
    : null;
  const captionSpeaker = captionClip
    ? storyManifest.speakers.find(
        (candidate) => candidate.id === captionClip.speakerId,
      )
    : null;
  const captionText = captionClip
    ? personalizeStoryText(captionClip.transcript, childName)
    : '';
  const activeCaptionTrack = useMemo(
    () => buildCaptionTrack(captionText),
    [captionText],
  );
  const displayedSubtitle = captionCueAtProgress(
    activeCaptionTrack,
    narrationState.progress,
  );
  const branchCaptionSpeaker = branchCaption
    ? storyManifest.speakers.find(
        (candidate) => candidate.id === branchCaption.speakerId,
      )
    : null;
  const activeBranchCaptionTrack = useMemo(
    () => buildCaptionTrack(branchCaption?.text ?? ''),
    [branchCaption?.text],
  );
  const displayedBranchSubtitle = captionCueAtProgress(
    activeBranchCaptionTrack,
    branchCaption?.progress ?? narrationState.progress,
  );
  const plannedBranchFamilyId =
    runtimeState.status !== 'playing-response'
      ? null
      : runtimeState.plan.kind === 'route'
        ? runtimeState.plan.actionFamilyId
        : runtimeState.plan.kind === 'story-change'
          ? runtimeState.plan.fallbackFamilyId
          : runtimeState.plan.kind === 'fallback'
            ? runtimeState.plan.familyId
            : null;
  const plannedBranchAssetId = storyPackage.branchIllustrationAssetId(
    plannedBranchFamilyId,
  );
  const visualAssetId = getVisualAssetId({
    state: runtimeState,
    currentVisualId: currentPresentation?.visualId ?? null,
    branchVisualId: activeBranchVisualId ?? plannedBranchAssetId,
  });
  const illustration = storyPackage.illustrationForAssetId(visualAssetId);

  useEffect(() => {
    if (
      runtimeState.status !== 'playing-fixed' ||
      !currentClip ||
      activeNarrationIdRef.current === currentClip.id
    ) {
      return;
    }
    activeNarrationIdRef.current = currentClip.id;
    setActiveBranchVisualId(null);
    const controller = new AbortController();
    let cancelled = false;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    const playCurrentClip = async () => {
      if (questionInviteAnchor) {
        setQuestionInviteSpeaking(true);
        const remoteAudio = await audioReadyWithin(
          getQuestionNarration({
            storyId: storyManifest.storyId,
            anchor: questionInviteAnchor,
            text: spokenText,
          }),
          QUESTION_AUDIO_HEAD_START_MS,
        );
        if (
          remoteAudio &&
          (await playResponseAudio(remoteAudio, controller.signal))
        ) {
          return;
        }
        await speakNarration({
          id: currentClip.id,
          text: spokenText,
          speakerId: currentClip.speakerId,
          language: 'ko-KR',
        });
        return;
      }
      await speakNarration({
        id: currentClip.id,
        text: spokenText,
        speakerId: currentClip.speakerId,
        language: 'ko-KR',
      });
    };
    playCurrentClip()
      .then(() => {
        if (!cancelled && runtimeRef.current.status === 'playing-fixed') {
          activeNarrationIdRef.current = null;
          setQuestionInviteSpeaking(false);
          commitEvent({ type: 'AUDIO_ENDED', clipId: currentClip.id });
        }
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        activeNarrationIdRef.current = null;
        setQuestionInviteSpeaking(false);
        void trackStoryEvent('playback_issue', {
          issue_type: 'fixed_audio_failed',
          scene_id: runtimeState.sceneId,
          clip_id: currentClip.id,
          audio_state: 'failed',
          audio_source: 'fixed',
          runtime_status: runtimeState.status,
          failure_code: 'FIXED_AUDIO_PLAYBACK_FAILED',
          retryable: true,
        });
        setParentMessage(
          '낭독 음성은 재생하지 못했지만 글로 확인했어요. 잠시 뒤 이야기를 계속할게요.',
        );
        recoveryTimer = setTimeout(() => {
          const latestClip = getRuntimeClip(runtimeRef.current);
          if (
            !cancelled &&
            runtimeRef.current.status === 'playing-fixed' &&
            latestClip?.id === currentClip.id
          ) {
            commitEvent({ type: 'AUDIO_ENDED', clipId: currentClip.id });
          }
        }, FIXED_AUDIO_FAILURE_RECOVERY_MS);
      });
    return () => {
      cancelled = true;
      if (recoveryTimer) {
        clearTimeout(recoveryTimer);
      }
      controller.abort();
      setQuestionInviteSpeaking(false);
    };
  }, [
    commitEvent,
    currentClip,
    questionInviteAnchor,
    narrationAttempt,
    runtimeState,
    speakNarration,
    spokenText,
  ]);

  useEffect(() => {
    const audioIds = storyManifest.scenes
      .slice(sceneIndex, Math.min(sceneIndex + 2, TOTAL_SCENES))
      .flatMap((preloadScene) =>
        preloadScene.audioGroupIds.flatMap(
          (groupId) =>
            storyManifest.audioGroups.find(
              (group) => group.id === groupId,
            )?.clips.map((clip) => clip.id) ?? [],
        ),
      );
    preloadFixedNarration(audioIds, storyPackage.audioAssets);
  }, [sceneIndex]);

  useEffect(() => {
    return () => {
      processingAbortRef.current?.abort();
      void stopNarration();
    };
  }, [stopNarration]);

  useEffect(() => {
    if (
      runtimeState.status !== 'complete' ||
      storyDurationSeconds !== null ||
      storyStartedAtRef.current === null
    ) {
      return;
    }
    const durationSeconds = Math.max(
      1,
      Math.round((Date.now() - storyStartedAtRef.current) / 1000),
    );
    setStoryDurationSeconds(durationSeconds);
    if (!completionTrackedRef.current) {
      completionTrackedRef.current = true;
      void trackStoryEvent('story_completed', {
        duration_seconds: durationSeconds,
        question_count: questionOutcomes.length,
        changed_scene_count: parentReport.changedSceneCount,
      });
    }
  }, [parentReport.changedSceneCount, questionOutcomes.length, runtimeState.status, storyDurationSeconds]);

  const startStory = useCallback(() => {
    primeResponseAudio();
    const normalizedName = childNameInput.trim().slice(0, 10);
    voiceResearchConsentRef.current = voiceResearchConsentChecked
      ? createVoiceResearchConsent()
      : null;
    pendingVoiceResearchSampleRef.current = null;
    clearLocalStoryProgress();
    setResumeCandidate(null);
    storyStartedAtRef.current = Date.now();
    setStoryDurationSeconds(null);
    setChildName(normalizedName);
    setParentMessage(null);
    setTypedQuestion('');
    setActiveBranchVisualId(null);
    setBranchCaption(null);
    trackedScenesRef.current.clear();
    trackedFailuresRef.current.clear();
    trackedPlaybackResultsRef.current.clear();
    completionTrackedRef.current = false;
    questionAttemptCountRef.current = 0;
    sttAttemptCountRef.current = 0;
    questionInputSwitchedRef.current = false;
    transcriptCorrectedRef.current = false;
    pendingSttMsRef.current = null;
    recorder.resetRecording();
    activeNarrationIdRef.current = null;
    storyManifest.questionAnchors.forEach((anchor) => {
      void preloadQuestionNarration({
        storyId: storyManifest.storyId,
        anchor,
        text: personalizeStoryText(anchor.prompt, normalizedName),
      });
    });
    if (commitEvent({ type: 'START' })) {
      void trackStoryEvent('story_started', { resume: false });
    }
  }, [childNameInput, commitEvent, recorder, voiceResearchConsentChecked]);

  const discardActiveQuestionAttempt = useCallback(async () => {
    processingAbortRef.current?.abort();
    processingAbortRef.current = null;
    if (recorder.isRecording) {
      await recorder.stopRecording();
    }
    recorder.resetRecording();
    setPendingTranscription(null);
    setIsRoutingQuestion(false);
    setPendingResponseAudio(null);
    setLastTranscript(null);
    setBranchCaption(null);
    pendingVoiceResearchSampleRef.current = null;
  }, [recorder]);

  const continueStory = useCallback(async () => {
    const questionState = runtimeRef.current;
    const skippedQuestion =
      questionState.status === 'awaiting-question' ||
      questionState.status === 'awaiting-clarification'
        ? {
            anchor_id: questionState.anchorId,
            scene_id: questionState.sceneId,
            skip_reason:
              questionState.status === 'awaiting-clarification'
                ? 'clarification_continue'
                : 'continue_listening',
          }
        : null;
    await discardActiveQuestionAttempt();
    await stopNarration();
    setParentMessage(null);
    setTypedQuestion('');
    setActiveBranchVisualId(null);
    setBranchCaption(null);
    activeNarrationIdRef.current = null;
    if (commitEvent({ type: 'CONTINUE_SELECTED' }) && skippedQuestion) {
      void trackStoryEvent('question_skipped', skippedQuestion);
    }
  }, [commitEvent, discardActiveQuestionAttempt, stopNarration]);

  const beginQuestion = useCallback(
    async () => {
      primeResponseAudio();
      setParentMessage(null);
      await stopNarration();
      await discardActiveQuestionAttempt();
      const granted =
        recorder.permissionState === 'granted'
          ? true
          : await recorder.requestPermission();
      if (!granted) {
        setParentMessage(
          recorder.error ??
            '마이크를 사용할 수 없어요. 글로 질문하거나 기기 설정을 확인해 주세요.',
        );
        return;
      }
      const previousQuestionState = runtimeRef.current;
      const isFreshQuestion =
        previousQuestionState.status === 'awaiting-question' ||
        previousQuestionState.status === 'awaiting-clarification';
      if (isFreshQuestion) {
        questionAttemptCountRef.current = 0;
        sttAttemptCountRef.current = 0;
        questionInputSwitchedRef.current = false;
        transcriptCorrectedRef.current = false;
        pendingSttMsRef.current = null;
        questionRouteStartedAtRef.current = null;
        firstResponseAudioMsRef.current = null;
      } else if (
        'inputMode' in previousQuestionState &&
        previousQuestionState.inputMode !== 'voice'
      ) {
        questionInputSwitchedRef.current = true;
      }
      questionAttemptCountRef.current += 1;
      setQuestionMode('voice');
      const questionState = runtimeRef.current;
      if (
        !commitEvent({
          type: 'ASK_SELECTED',
        })
      ) {
        return;
      }
      if (
        isFreshQuestion &&
        'anchorId' in questionState &&
        questionState.anchorId
      ) {
        void trackStoryEvent('question_started', {
          anchor_id: questionState.anchorId,
          input_mode: 'voice',
        });
      }
      try {
        await recorder.startRecording();
        commitEvent({ type: 'RECORDING_STARTED' });
      } catch (error) {
        commitEvent({
          type: 'FAILURE',
          failure: {
            code: 'RECORDING_START_FAILED',
            stage: 'recording',
            retryable: true,
            safeDetail:
              error instanceof Error ? error.message : 'unknown',
          },
        });
      }
    },
    [commitEvent, discardActiveQuestionAttempt, recorder, stopNarration],
  );

  const beginTypedQuestion = useCallback(async () => {
    setParentMessage(null);
    await stopNarration();
    await discardActiveQuestionAttempt();
    const previousQuestionState = runtimeRef.current;
    const isFreshQuestion =
      previousQuestionState.status === 'awaiting-question' ||
      previousQuestionState.status === 'awaiting-clarification';
    if (isFreshQuestion) {
      questionAttemptCountRef.current = 0;
      sttAttemptCountRef.current = 0;
      questionInputSwitchedRef.current = false;
      transcriptCorrectedRef.current = false;
      pendingSttMsRef.current = null;
      questionRouteStartedAtRef.current = null;
      firstResponseAudioMsRef.current = null;
    } else if (
      'inputMode' in previousQuestionState &&
      previousQuestionState.inputMode !== 'text'
    ) {
      questionInputSwitchedRef.current = true;
    }
    questionAttemptCountRef.current += 1;
    setQuestionMode('text');
    const questionState = runtimeRef.current;
    if (
      commitEvent({ type: 'TYPE_SELECTED' }) &&
      isFreshQuestion &&
      'anchorId' in questionState &&
      questionState.anchorId
    ) {
      void trackStoryEvent('question_started', {
        anchor_id: questionState.anchorId,
        input_mode: 'text',
      });
    }
  }, [commitEvent, discardActiveQuestionAttempt, stopNarration]);

  const processTypedQuestion = useCallback(async () => {
    const transcript = typedQuestion.trim().slice(0, 240);
    if (!transcript) {
      setParentMessage('궁금한 것을 한 글자 이상 적어 주세요.');
      return;
    }
    setParentMessage(null);
    setLastTranscript(null);
    setPendingTranscription(null);
    pendingSttMsRef.current = null;
    if (!commitEvent({ type: 'TEXT_SUBMITTED', transcript })) {
      return;
    }
    const state = runtimeRef.current;
    if (state.status !== 'processing-question') {
      return;
    }
    setPendingTranscription({
      ok: true,
      speech: {
        status: 'speech',
        transcript,
        locale: 'ko',
        normalizedMimeType: 'text/plain',
      },
    });
  }, [commitEvent, typedQuestion]);

  const transcribeRecording = useCallback(async (
    recording: RecordingResult,
  ) => {
    setParentMessage(null);
    setLastTranscript(null);
    setPendingTranscription(null);
    const {
      uploadBlob,
      ...recordingArtifact
    } = recording;
    if (
      !commitEvent({
        type: 'RECORDING_STOPPED',
        recording: recordingArtifact,
      })
    ) {
      return;
    }
    const state = runtimeRef.current;
    if (state.status !== 'processing-question') {
      return;
    }
    const controller = new AbortController();
    sttAttemptCountRef.current += 1;
    processingAbortRef.current?.abort();
    processingAbortRef.current = controller;
    try {
      const result = await speechPipeline.transcribe(
        {
          recording: recordingArtifact,
          recordingData: uploadBlob,
          storyId: storyManifest.storyId,
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
        },
        controller.signal,
      );
      if (result.ok) {
        pendingSttMsRef.current = result.diagnostics?.sttMs ?? null;
        pendingVoiceResearchSampleRef.current = voiceResearchConsentRef.current
          ? {
              recording,
              sttDraft: result.speech.transcript,
            }
          : null;
        setPendingTranscription(result);
      } else {
        pendingVoiceResearchSampleRef.current = null;
        setParentMessage(questionFailureCopy(result.failure).help);
        commitEvent({ type: 'FAILURE', failure: result.failure });
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      commitEvent({
        type: 'FAILURE',
        failure: {
          code: 'SPEECH_PIPELINE_ABORTED',
          stage: 'stt',
          retryable: true,
          safeDetail: error instanceof Error ? error.message : 'unknown',
        },
      });
    } finally {
      if (processingAbortRef.current === controller) {
        processingAbortRef.current = null;
      }
    }
  }, [commitEvent]);

  const finishQuestion = useCallback(async () => {
    const recording = await recorder.stopRecording();
    if (!recording) {
      commitEvent({
        type: 'FAILURE',
        failure: {
          code: 'RECORDING_FILE_MISSING',
          stage: 'recording',
          retryable: true,
        },
      });
      return;
    }
    await transcribeRecording(recording);
  }, [commitEvent, recorder, transcribeRecording]);

  useEffect(() => {
    if (
      runtimeState.status !== 'recording-question' ||
      runtimeState.inputMode !== 'voice' ||
      !recorder.isRecording
    ) {
      return;
    }
    const timer = setTimeout(() => {
      void finishQuestion();
    }, 30_000);
    return () => clearTimeout(timer);
  }, [finishQuestion, recorder.isRecording, runtimeState]);

  const confirmTranscript = useCallback(async () => {
    if (!pendingTranscription || isRoutingQuestion) {
      return;
    }
    const confirmedSpeech = pendingTranscription.speech;
    const pendingVoiceResearchSample = pendingVoiceResearchSampleRef.current;
    pendingVoiceResearchSampleRef.current = null;
    setLastTranscript(confirmedSpeech.transcript);
    if (
      !commitEvent({
        type: 'SPEECH_RESOLVED',
        result: confirmedSpeech,
      })
    ) {
      return;
    }
    setPendingTranscription(null);
    setIsRoutingQuestion(true);
    const state = runtimeRef.current;
    if (state.status !== 'processing-question') {
      setIsRoutingQuestion(false);
      return;
    }
    const controller = new AbortController();
    processingAbortRef.current?.abort();
    processingAbortRef.current = controller;
    const routeStartedAt = Date.now();
    questionRouteStartedAtRef.current = routeStartedAt;
    firstResponseAudioMsRef.current = null;
    try {
      const result = await speechPipeline.route(
        {
          transcript: confirmedSpeech.transcript,
          storyId: storyManifest.storyId,
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
          priorActionFamilyIds: questionOutcomes
            .map(
              (outcome) =>
                outcome.selectedOption?.actionFamilyId ??
                outcome.actionFamilyId ??
                null,
            )
            .filter((familyId): familyId is string => Boolean(familyId)),
          guaranteeAgencyChoice:
            storyManifest.questionAnchors.findIndex(
              (anchor) => anchor.id === state.anchorId,
            ) > 0 && !hasExperiencedStoryAgency(questionOutcomes),
        },
        controller.signal,
      );
      if (!result.ok) {
        if (pendingVoiceResearchSample && voiceResearchConsentRef.current) {
          void storeVoiceResearchSample({
            consent: voiceResearchConsentRef.current,
            recording: pendingVoiceResearchSample.recording,
            storyId: storyManifest.storyId,
            sceneId: state.sceneId,
            anchorId: state.anchorId,
            questionRound: state.questionRound,
            sttDraft: pendingVoiceResearchSample.sttDraft,
            confirmedTranscript: confirmedSpeech.transcript,
          });
        }
        setParentMessage(questionFailureCopy(result.failure).help);
        commitEvent({ type: 'FAILURE', failure: result.failure });
        return;
      }
      const priorActionFamilyIds = questionOutcomes
        .map(
          (outcome) =>
            outcome.selectedOption?.actionFamilyId ??
            outcome.actionFamilyId ??
            null,
        )
        .filter((familyId): familyId is string => Boolean(familyId));
      const plan =
        result.plan.kind === 'route'
          ? storyPackage.repairRoutePlanForHistory(
              state.anchorId,
              result.plan,
              priorActionFamilyIds,
            )
          : result.plan;
      const planWasRepaired = plan !== result.plan;
      const familyId =
        plan.kind === 'route'
          ? plan.actionFamilyId ?? plan.fallbackFamilyId
          : plan.kind === 'story-change'
            ? plan.fallbackFamilyId
            : plan.kind === 'fallback'
              ? plan.familyId
              : null;
      if (pendingVoiceResearchSample && voiceResearchConsentRef.current) {
        void storeVoiceResearchSample({
          consent: voiceResearchConsentRef.current,
          recording: pendingVoiceResearchSample.recording,
          storyId: storyManifest.storyId,
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
          sttDraft: pendingVoiceResearchSample.sttDraft,
          confirmedTranscript: confirmedSpeech.transcript,
          ...(plan.kind === 'route'
            ? {
                routeOutcome: {
                  coverageStatus: plan.coverageStatus,
                  familyId,
                  intentSummary: plan.childRelevantMeaning,
                },
              }
            : {}),
        });
      }
      void trackStoryEvent('question_result', {
        anchor_id: state.anchorId,
        route:
          plan.kind === 'route' ? plan.route : plan.kind,
        result: 'route_accepted',
        latency_ms: Date.now() - routeStartedAt,
        route_ms: result.diagnostics?.responseMs ?? Date.now() - routeStartedAt,
        attempt_count: Math.max(1, questionAttemptCountRef.current),
        stt_attempt_count: sttAttemptCountRef.current,
        ...(pendingSttMsRef.current !== null
          ? { stt_ms: pendingSttMsRef.current }
          : {}),
        ...(sttAttemptCountRef.current > 0
          ? {
              first_pass_accepted:
                sttAttemptCountRef.current === 1 &&
                !transcriptCorrectedRef.current &&
                !questionInputSwitchedRef.current,
            }
          : {}),
        transcript_corrected: transcriptCorrectedRef.current,
        switched_input: questionInputSwitchedRef.current,
        coverage_status:
          plan.kind === 'route'
            ? plan.coverageStatus
            : 'uncovered',
        question_text: sanitizeQuestionText(
          confirmedSpeech.transcript,
          childName,
        ),
        question_intent: sanitizeQuestionText(
          plan.kind === 'route'
            ? plan.childRelevantMeaning
            : confirmedSpeech.transcript,
          childName,
        ),
        uncovered_intent:
          plan.kind !== 'route' || plan.coverageStatus === 'uncovered',
        ...(familyId ? { family_id: familyId } : {}),
        ...(plan.kind === 'route'
          ? {
              model_id: plan.versions.modelId,
              prompt_version: plan.versions.promptVersion,
            }
          : {}),
      });
      if (plan.kind === 'route' && plan.route !== 'THREE_PATHS') {
        rememberQuestionOutcome(state.anchorId, plan);
      }
      const anchor = storyManifest.questionAnchors.find(
        (candidate) => candidate.id === state.anchorId,
      );
      const responseText = personalizeStoryText(plan.text, childName);
      const preparedAudio =
        (!planWasRepaired ? result.audio : null) ??
        (anchor
          ? await audioReadyWithin(
              getResponseNarration(
                {
                  storyId: storyManifest.storyId,
                  anchor,
                  text: responseText,
                },
                controller.signal,
              ),
              RESPONSE_AUDIO_PREPARE_MS,
            )
          : null);
      if (controller.signal.aborted) {
        return;
      }
      setPendingResponseAudio(preparedAudio);
      commitEvent({ type: 'RESPONSE_READY', plan });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      commitEvent({
        type: 'FAILURE',
        failure: {
          code: 'ROUTE_PIPELINE_ABORTED',
          stage: 'response',
          retryable: true,
          safeDetail: error instanceof Error ? error.message : 'unknown',
        },
      });
    } finally {
      if (processingAbortRef.current === controller) {
        processingAbortRef.current = null;
      }
      setIsRoutingQuestion(false);
    }
  }, [
    commitEvent,
    childName,
    isRoutingQuestion,
    pendingTranscription,
    questionOutcomes,
    rememberQuestionOutcome,
  ]);

  const retryAfterTranscript = useCallback(async () => {
    if (questionMode === 'text') {
      await beginTypedQuestion();
      return;
    }
    await beginQuestion();
  }, [beginQuestion, beginTypedQuestion, questionMode]);

  const editTranscriptAsText = useCallback(async () => {
    if (!pendingTranscription) return;
    const pendingVoiceResearchSample = pendingVoiceResearchSampleRef.current;
    transcriptCorrectedRef.current = true;
    setTypedQuestion(pendingTranscription.speech.transcript);
    await beginTypedQuestion();
    pendingVoiceResearchSampleRef.current = pendingVoiceResearchSample;
  }, [beginTypedQuestion, pendingTranscription]);

  const selectRouteOption = useCallback(
    async (optionId: 'OPTION_1' | 'OPTION_2' | 'OPTION_3') => {
      if (runtimeRef.current.status !== 'awaiting-choice') {
        return;
      }
      const choiceState = runtimeRef.current;
      const selectedOption = choiceState.plan.options.find(
        (option) => option.id === optionId,
      );
      await stopNarration();
      setPendingResponseAudio(null);
      setBranchCaption(null);
      activeNarrationIdRef.current = null;
      if (
        commitEvent({ type: 'CHOICE_SELECTED', optionId }) &&
        selectedOption
      ) {
        rememberQuestionOutcome(
          choiceState.anchorId,
          choiceState.plan,
          selectedOption,
        );
        void trackStoryEvent('choice_selected', {
          anchor_id: choiceState.anchorId,
          scene_id: choiceState.sceneId,
          option_id: selectedOption.id,
          family_id: selectedOption.actionFamilyId,
        });
      }
    },
    [commitEvent, rememberQuestionOutcome, stopNarration],
  );

  useEffect(() => {
    if (runtimeState.status !== 'awaiting-choice') {
      return;
    }
    const choiceState = runtimeState;
    const responseId = `choice-${choiceState.anchorId}-${choiceState.questionRound}`;
    if (activeNarrationIdRef.current === responseId) {
      return;
    }
    activeNarrationIdRef.current = responseId;
    const controller = new AbortController();
    let cancelled = false;
    const play = async () => {
      const responseText = personalizeStoryText(
        choiceState.plan.text,
        childName,
      );
      setBranchCaption({
        text: responseText,
        speakerId: choiceState.plan.speakerId,
        progress: pendingResponseAudio ? 0 : null,
      });
      const remoteAudio = pendingResponseAudio;
      const markFirstAudio = () => {
        if (
          firstResponseAudioMsRef.current === null &&
          questionRouteStartedAtRef.current !== null
        ) {
          firstResponseAudioMsRef.current =
            Date.now() - questionRouteStartedAtRef.current;
        }
      };
      const playedRemoteAudio = remoteAudio
        ? await playResponseAudio(
            remoteAudio,
            controller.signal,
            markFirstAudio,
            (progress) => {
              setBranchCaption((current) =>
                current?.text === responseText
                  ? { ...current, progress }
                  : current,
              );
            },
            estimateNarrationDurationSeconds(responseText),
          )
        : false;
      if (!playedRemoteAudio) {
        markFirstAudio();
        setBranchCaption((current) =>
          current?.text === responseText
            ? { ...current, progress: null }
            : current,
        );
        await speakNarration({
          id: responseId,
          text: responseText,
          speakerId: choiceState.plan.speakerId,
          language: 'ko-KR',
        });
      }
    };
    play()
      .then(() => {
        if (!cancelled && !controller.signal.aborted) {
          setPendingResponseAudio(null);
        }
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        void trackStoryEvent('playback_issue', {
          issue_type: 'choice_audio_failed',
          scene_id: choiceState.sceneId,
          anchor_id: choiceState.anchorId,
          clip_id: responseId,
          audio_state: 'failed',
          audio_source: pendingResponseAudio ? 'remote' : 'device',
          runtime_status: choiceState.status,
          failure_code: 'CHOICE_AUDIO_PLAYBACK_FAILED',
          retryable: true,
        });
        activeNarrationIdRef.current = null;
        setParentMessage(
          error instanceof Error
            ? error.message
            : '선택 질문 음성을 재생하지 못했어요.',
        );
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    childName,
    pendingResponseAudio,
    runtimeState,
    speakNarration,
  ]);

  useEffect(() => {
    if (runtimeState.status !== 'playing-response') {
      return;
    }
    const responseState = runtimeState;
    const responseId = `response-${responseState.anchorId}-${responseState.questionRound}`;
    const selectedBridge =
      responseState.plan.kind === 'route' &&
      responseState.plan.originRoute === 'THREE_PATHS' &&
      responseState.plan.actionFamilyId
        ? storyPackage.branchInteractionCopy(responseState.plan.actionFamilyId)
        : null;
    const narrationId = selectedBridge?.audioId ?? responseId;
    if (activeNarrationIdRef.current === responseId) {
      return;
    }
    activeNarrationIdRef.current = responseId;
    const responseBranch = getBranchFamily(responseState);
    const branchVisualAssetId =
      responseState.plan.kind === 'route'
        ? storyPackage.branchIllustrationAssetId(responseState.plan.actionFamilyId)
        : null;
    const controller = new AbortController();
    let cancelled = false;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    const branchPlaybackStartedAt = Date.now();
    const playbackTrackingKey = `${responseState.anchorId}:${responseState.questionRound}`;
    const trackPlaybackResult = (
      result: 'playback_completed' | 'fallback_completed',
      extra: Record<string, string | number | boolean> = {},
    ) => {
      if (trackedPlaybackResultsRef.current.has(playbackTrackingKey)) return;
      trackedPlaybackResultsRef.current.add(playbackTrackingKey);
      void trackStoryEvent('question_result', {
        anchor_id: responseState.anchorId,
        route:
          responseState.plan.kind === 'route'
            ? responseState.plan.route
            : responseState.plan.kind,
        result,
        branch_playback_ms: Date.now() - branchPlaybackStartedAt,
        ...(firstResponseAudioMsRef.current !== null
          ? { first_audio_ms: firstResponseAudioMsRef.current }
          : {}),
        ...(responseBranch ? { family_id: responseBranch.id } : {}),
        attempt_count: Math.max(1, questionAttemptCountRef.current),
        ...extra,
      });
    };
    const play = async () => {
      const responseText = personalizeStoryText(
        responseState.plan.text,
        childName,
      );
      setBranchCaption({
        text: responseText,
        speakerId:
          responseState.plan.kind === 'route'
            ? responseState.plan.speakerId
            : storyPackage.narratorSpeakerId,
        progress: pendingResponseAudio ? 0 : null,
      });
      if (branchVisualAssetId) {
        // Show the reviewed default image right away and start audio at
        // the same time — image loading must never block TTS or state.
        setActiveBranchVisualId(branchVisualAssetId);
      }
      const remoteAudio = pendingResponseAudio;
      const markFirstAudio = () => {
        if (
          firstResponseAudioMsRef.current === null &&
          questionRouteStartedAtRef.current !== null
        ) {
          firstResponseAudioMsRef.current =
            Date.now() - questionRouteStartedAtRef.current;
        }
      };
      const playedRemoteAudio = remoteAudio
        ? await playResponseAudio(
            remoteAudio,
            controller.signal,
            markFirstAudio,
            (progress) => {
              setBranchCaption((current) =>
                current?.text === responseText
                  ? { ...current, progress }
                  : current,
              );
            },
            estimateNarrationDurationSeconds(responseText),
          )
        : false;
      if (!playedRemoteAudio) {
        markFirstAudio();
        setBranchCaption((current) =>
          current?.text === responseText
            ? { ...current, progress: null }
            : current,
        );
        await speakNarration({
          id: narrationId,
          text: responseText,
          speakerId:
            responseState.plan.kind === 'route'
              ? responseState.plan.speakerId
              : storyPackage.narratorSpeakerId,
          language: 'ko-KR',
        });
      }
      if (!responseBranch) {
        return;
      }
      for (const [segmentIndex, segment] of responseBranch.segments.entries()) {
        if (controller.signal.aborted) {
          return;
        }
        if (segment.kind === 'visual') {
          setActiveBranchVisualId(segment.id);
        }
        if (segment.kind === 'utterance') {
          setBranchCaption({
            text: personalizeStoryText(segment.text, childName),
            speakerId: storyPackage.speakerIdForTag(segment.speaker),
            progress: null,
          });
          await speakNarration({
            id: `FB-${responseBranch.id}-CLIP-${String(segmentIndex + 1).padStart(3, '0')}`,
            text: personalizeStoryText(segment.text, childName),
            speakerId: storyPackage.speakerIdForTag(segment.speaker),
            language: 'ko-KR',
          });
        }
      }
    };
    play()
      .then(() => {
        if (
          !cancelled &&
          !controller.signal.aborted &&
          runtimeRef.current.status === 'playing-response'
        ) {
          trackPlaybackResult(
            responseState.plan.kind === 'fallback'
              ? 'fallback_completed'
              : 'playback_completed',
          );
          activeNarrationIdRef.current = null;
          setPendingResponseAudio(null);
          setActiveBranchVisualId(null);
          setBranchCaption(null);
          commitEvent({ type: 'RESPONSE_AUDIO_ENDED' });
        }
      })
      .catch((error: unknown) => {
        if (
          cancelled ||
          controller.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        const failedClipId = activeNarrationIdRef.current ?? narrationId;
        void trackStoryEvent('playback_issue', {
          issue_type: 'response_audio_failed',
          scene_id: responseState.sceneId,
          anchor_id: responseState.anchorId,
          ...(responseBranch ? { family_id: responseBranch.id } : {}),
          clip_id: failedClipId,
          audio_state: 'failed',
          audio_source: pendingResponseAudio ? 'remote' : 'device',
          runtime_status: responseState.status,
          failure_code: 'RESPONSE_AUDIO_PLAYBACK_FAILED',
          retryable: true,
        });
        activeNarrationIdRef.current = null;
        setParentMessage(
          '답변 음성은 재생하지 못했지만 글로 확인했어요. 잠시 뒤 이야기를 계속할게요.',
        );
        recoveryTimer = setTimeout(() => {
          if (
            !cancelled &&
            runtimeRef.current.status === 'playing-response' &&
            runtimeRef.current.anchorId === responseState.anchorId &&
            runtimeRef.current.questionRound === responseState.questionRound
          ) {
            trackPlaybackResult('fallback_completed', {
              failure_code: 'RESPONSE_AUDIO_PLAYBACK_FAILED',
              retryable: true,
            });
            setPendingResponseAudio(null);
            setActiveBranchVisualId(null);
            setBranchCaption(null);
            commitEvent({ type: 'RESPONSE_AUDIO_ENDED' });
          }
        }, 2_500);
      });
    return () => {
      cancelled = true;
      if (recoveryTimer) {
        clearTimeout(recoveryTimer);
      }
      controller.abort();
    };
  }, [
    childName,
    commitEvent,
    narrationAttempt,
    pendingResponseAudio,
    runtimeState,
    speakNarration,
  ]);

  const replayCurrent = useCallback(async () => {
    if (!currentClip && !isBranchPlaybackState) {
      return;
    }
    activeNarrationIdRef.current = null;
    await stopNarration();
    setNarrationAttempt((attempt) => attempt + 1);
  }, [currentClip, isBranchPlaybackState, stopNarration]);

  const toggleNarration = useCallback(async () => {
    setParentMessage(null);
    const changed = narrationState.isPaused
      ? await resumeNarration()
      : await pauseNarration();
    if (!changed) {
      setParentMessage('현재 문장이 준비되면 다시 눌러 주세요.');
    }
  }, [
    narrationState.isPaused,
    pauseNarration,
    resumeNarration,
  ]);

  const skipCurrentScene = useCallback(async () => {
    if (runtimeRef.current.status === 'playing-response') {
      await stopNarration();
      activeNarrationIdRef.current = null;
      setPendingResponseAudio(null);
      setActiveBranchVisualId(null);
      setBranchCaption(null);
      setParentMessage(null);
      commitEvent({ type: 'RESPONSE_AUDIO_ENDED' });
      return;
    }
    if (runtimeRef.current.status !== 'playing-fixed') {
      return;
    }
    const fixedState = runtimeRef.current;
    const skippedAnchor = storyManifest.questionAnchors.find(
      (anchor) => anchor.sceneId === fixedState.sceneId,
    );
    const inviteWasShown = skippedAnchor
      ? [...trackedQuestionInvitesRef.current].some((key) =>
          key.startsWith(`${skippedAnchor.id}:`),
        )
      : false;
    const questionWasAnswered = skippedAnchor
      ? questionOutcomes.some(
          (outcome) => outcome.anchorId === skippedAnchor.id,
        )
      : false;
    await stopNarration();
    activeNarrationIdRef.current = null;
    setParentMessage(null);
    if (
      commitEvent({ type: 'SKIP_SCENE_SELECTED' }) &&
      skippedAnchor &&
      !inviteWasShown &&
      !questionWasAnswered
    ) {
      void trackStoryEvent('question_skipped', {
        anchor_id: skippedAnchor.id,
        scene_id: fixedState.sceneId,
        skip_reason: 'scene_advanced_before_invite',
      });
    }
  }, [commitEvent, questionOutcomes, stopNarration]);

  const restartStory = useCallback(async () => {
    processingAbortRef.current?.abort();
    await stopNarration();
    recorder.resetRecording();
    const reset = createInitialRuntimeState(storyManifest);
    runtimeRef.current = reset;
    setRuntimeState(reset);
    activeNarrationIdRef.current = null;
    setParentMessage(null);
    setLastTranscript(null);
    setPendingTranscription(null);
    setIsRoutingQuestion(false);
    setPendingResponseAudio(null);
    voiceResearchConsentRef.current = null;
    pendingVoiceResearchSampleRef.current = null;
    setVoiceResearchConsentChecked(false);
    setActiveBranchVisualId(null);
    setBranchCaption(null);
    setTypedQuestion('');
    setQuestionOutcomes([]);
    trackedPlaybackResultsRef.current.clear();
    trackedQuestionInvitesRef.current.clear();
    questionAttemptCountRef.current = 0;
    sttAttemptCountRef.current = 0;
    questionInputSwitchedRef.current = false;
    transcriptCorrectedRef.current = false;
    pendingSttMsRef.current = null;
    questionRouteStartedAtRef.current = null;
    firstResponseAudioMsRef.current = null;
    storyStartedAtRef.current = null;
    setStoryDurationSeconds(null);
    setParentReportVisible(false);
    setHomeMenuVisible(false);
    setExitReasonVisible(false);
    setResumeCandidate(null);
    clearLocalStoryProgress();
  }, [recorder, stopNarration]);

  const resumeStory = useCallback(async () => {
    if (!resumeCandidate) {
      return;
    }
    await stopNarration();
    runtimeRef.current = resumeCandidate.state;
    setRuntimeState(resumeCandidate.state);
    setChildName(resumeCandidate.childName);
    setChildNameInput(resumeCandidate.childName);
    setQuestionOutcomes(resumeCandidate.questionOutcomes);
    storyStartedAtRef.current =
      Date.now() - resumeCandidate.elapsedSeconds * 1000;
    setStoryDurationSeconds(
      resumeCandidate.state.status === 'complete'
        ? resumeCandidate.elapsedSeconds
        : null,
    );
    setParentReportVisible(false);
    setResumeCandidate(null);
    activeNarrationIdRef.current = null;
    void trackStoryEvent('story_started', { resume: true });
  }, [resumeCandidate, stopNarration]);

  const dismissResumeAndRestart = useCallback(() => {
    clearLocalStoryProgress();
    setResumeCandidate(null);
  }, []);

  const openHomeMenu = useCallback(async () => {
    if (runtimeRef.current.status === 'complete') {
      clearLocalStoryProgress();
      await restartStory();
      return;
    }
    if (narrationState.isSpeaking && !narrationState.isPaused) {
      await pauseNarration();
    }
    persistCurrentProgress();
    setExitReasonVisible(false);
    setHomeMenuVisible(true);
  }, [
    narrationState.isPaused,
    narrationState.isSpeaking,
    pauseNarration,
    persistCurrentProgress,
    restartStory,
  ]);

  const continueFromHomeMenu = useCallback(async () => {
    setHomeMenuVisible(false);
    setExitReasonVisible(false);
    if (narrationState.isPaused) {
      await resumeNarration();
    }
  }, [narrationState.isPaused, resumeNarration]);

  const leaveTemporarily = useCallback(async () => {
    persistCurrentProgress();
    processingAbortRef.current?.abort();
    await stopNarration();
    setHomeMenuVisible(false);
    await openExternal(LANDING_URL);
  }, [openExternal, persistCurrentProgress, stopNarration]);

  const finishExperience = useCallback(async () => {
    processingAbortRef.current?.abort();
    await stopNarration();
    clearLocalStoryProgress();
    await openExternal(LANDING_URL);
  }, [openExternal, stopNarration]);

  const finishToday = useCallback(
    async (reason: (typeof EXIT_REASONS)[number]) => {
      const latestState = runtimeRef.current;
      const diagnosticClipId =
        getRuntimeClip(latestState)?.id ??
        activeNarrationIdRef.current ??
        narrationState.captionRequestId;
      const diagnostics = buildExitDiagnostics({
        state: latestState,
        questionOutcomes,
        clipId: diagnosticClipId,
        narration: {
          isSpeaking: narrationState.isSpeaking,
          isPaused: narrationState.isPaused,
          source: narrationState.source,
        },
      });
      try {
        globalThis.localStorage?.setItem(
          'qstory.hg.last-explicit-exit.v1',
          JSON.stringify({ reason, at: new Date().toISOString() }),
        );
      } catch {
        // Exit feedback storage must never trap the family in the player.
      }
      await trackStoryEvent('explicit_exit', {
        reason_code: EXIT_REASON_CODES[reason],
        ...diagnostics,
      });
      clearLocalStoryProgress();
      await restartStory();
    },
    [
      narrationState.captionRequestId,
      narrationState.isPaused,
      narrationState.isSpeaking,
      narrationState.source,
      questionOutcomes,
      restartStory,
    ],
  );

  const openParentReport = useCallback(() => {
    setParentReportVisible(true);
    void trackStoryEvent('parent_report_opened');
  }, []);

  const closeParentReport = useCallback(() => {
    setParentReportVisible(false);
  }, []);

  const openCompletionSurvey = useCallback(async () => {
    await trackStoryEvent('survey_opened');
    await openExternal(getCompletionSurveyUrl());
  }, [openExternal]);

  const meterPercent =
    typeof recorder.meteringDb === 'number'
      ? Math.max(8, Math.min(100, ((recorder.meteringDb + 60) / 48) * 100))
      : 8;
  const activeQuestionPrompt =
    runtimeState.status === 'awaiting-clarification'
      ? questionPrompt(runtimeState, childName)
      : activeQuestionAnchor
        ? personalizeStoryText(activeQuestionAnchor.prompt, childName)
        : questionPrompt(runtimeState, childName);
  const activeQuestionOrdinal = activeQuestionAnchor
    ? storyManifest.questionAnchors.findIndex(
        (anchor) => anchor.id === activeQuestionAnchor.id,
      ) + 1
    : 1;
  const plan =
    runtimeState.status === 'playing-response' ? runtimeState.plan : null;
  const isStoryChange =
    plan?.kind === 'story-change' ||
    (plan?.kind === 'route' &&
      ['DIRECT_ACTION', 'SCENE_REPLACE', 'DETOUR_REJOIN'].includes(
        plan.route,
      ));
  const isSafetyRedirect =
    plan?.kind === 'route' && plan.route === 'GENTLE_REDIRECT';
  const isParentReport =
    runtimeState.status === 'complete' && parentReportVisible;
  const failedQuestionCopy =
    runtimeState.status === 'failed-recoverable'
      ? questionFailureCopy(runtimeState.failure)
      : null;

  return {
    // layout
    isWide,
    isShort,
    isCompactPlayback,
    isPlaybackDockState,
    isParentReport,
    // runtime + derived view state
    runtimeState,
    scene,
    speaker,
    sceneIndex,
    displayedSceneIndex,
    totalScenes: TOTAL_SCENES,
    scenes: storyPresentation.scenes,
    illustration,
    currentClip,
    isQuestionInvitePlayback,
    isBranchPlaybackState,
    questionInviteSpeaking,
    captionVisible,
    setCaptionVisible,
    captionSpeaker,
    displayedSubtitle,
    branchCaptionSpeaker,
    displayedBranchSubtitle,
    narrationState,
    meterPercent,
    activeQuestionPrompt,
    activeQuestionOrdinal,
    plan,
    isStoryChange,
    isSafetyRedirect,
    failedQuestionCopy,
    lastTranscript,
    // input state
    childNameInput,
    setChildNameInput,
    childName,
    voiceResearchConsentChecked,
    setVoiceResearchConsentChecked,
    questionMode,
    typedQuestion,
    setTypedQuestion,
    recorder,
    pendingTranscription,
    isRoutingQuestion,
    parentMessage,
    // choice / response
    parentReport,
    resumeCandidate,
    homeMenuVisible,
    exitReasonVisible,
    setExitReasonVisible,
    exitReasons: EXIT_REASONS,
    // handlers
    startStory,
    continueStory,
    beginQuestion,
    beginTypedQuestion,
    processTypedQuestion,
    finishQuestion,
    confirmTranscript,
    retryAfterTranscript,
    editTranscriptAsText,
    selectRouteOption,
    replayCurrent,
    toggleNarration,
    skipCurrentScene,
    restartStory,
    resumeStory,
    dismissResumeAndRestart,
    openHomeMenu,
    continueFromHomeMenu,
    leaveTemporarily,
    finishExperience,
    finishToday,
    openParentReport,
    closeParentReport,
    openCompletionSurvey,
    getSceneIndex,
  };
}

export type OneStoryRuntime = ReturnType<typeof useOneStoryRuntime>;

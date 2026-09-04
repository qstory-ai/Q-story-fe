import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

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
  buildExitDiagnostics,
  sanitizeQuestionText,
  buildParentReport,
  hasExperiencedStoryAgency,
  clearLocalStoryProgress,
  loadLocalStoryProgress,
  saveLocalStoryProgress,
  createVoiceResearchConsent,
  storeVoiceResearchSample,
  trackBetaEvent,
  type BetaEventName,
  type QuestionOutcome,
  type LocalStoryProgress,
  type VoiceResearchConsent,
} from '@/entities/analytics';
import {
  audioReadyWithin,
  personalizeStoryText,
} from '@/entities/narration';
import {
  createConfiguredSpeechPipeline,
  type TranscriptionSuccess,
} from '@/entities/speech-pipeline';
import type { StoryRuntimePackage } from '@/entities/story';
import { useAuth } from '@/entities/auth';
import { useChildren } from '@/entities/child';
import { recordStoryCompletion } from '@/entities/story-completion';
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
} from '../lib/constants';
import {
  getBranchFamily,
  getRuntimeClip,
  getSceneIndex as getSceneIndexForPackage,
  questionFailureCopy,
  questionPrompt,
  runtimeTransitionFailureCopy,
} from '../lib/runtime-view';
import { preloadImages } from '../lib/preload-images';
import { playResponseWithFallback } from '../lib/play-clip-with-fallback';
import { useOneStoryDerivedView } from './use-one-story-derived-view';
import { useLiveBranchPolling } from './use-live-branch-polling';

export function useOneStoryRuntime(initialStoryPackage: StoryRuntimePackage, tutorStudentId?: string) {
  // 실시간 새 분기 생성이 READY가 되면(폴링 effect 아래 참고) GET /v1/stories/{storyId}/content를
  // 재조회해 이 값을 교체한다 - storyPackage를 부모로부터 받은 그대로 쓰지 않고 로컬 상태로 감싸는
  // 이유는 이것 하나뿐이다. 그 갱신 전까지는 항상 부모가 최초에 넘긴 패키지와 동일하다.
  const [storyPackage, setStoryPackage] = useState(initialStoryPackage);
  const storyManifest = storyPackage.manifest;
  const storyPresentation = storyPackage.presentation;
  const TOTAL_SCENES = storyPresentation.scenes.length;
  const speechPipeline = useMemo(
    () => createConfiguredSpeechPipeline(storyPackage),
    [storyPackage],
  );
  const trackStoryEvent = useCallback(
    (eventName: BetaEventName, metadata: Record<string, string | number | boolean> = {}) =>
      trackBetaEvent(eventName, {
        story_version: storyManifest.contentVersion,
        ...metadata,
      }),
    [storyManifest.contentVersion],
  );
  const getSceneIndex = useCallback(
    (state: Parameters<typeof getSceneIndexForPackage>[0]) =>
      getSceneIndexForPackage(state, storyPackage),
    [storyPackage],
  );

  const navigate = useNavigate();
  const { width, height } = useWindowDimensions();
  const isWide = width >= 900;
  const isShort = height < 720;
  const recorder = useAudioRecorderAdapter();
  const { state: authState } = useAuth();
  const { selectedChild } = useChildren();
  const {
    speak: speakNarration,
    stop: stopNarration,
    pause: pauseNarration,
    resume: resumeNarration,
    state: narrationState,
  } = useStoryNarration(storyPackage.audioAssets, storyManifest.storyId);
  const initialState = useMemo(
    () => createInitialRuntimeState(storyManifest),
    [storyManifest],
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
  // "processing-question" 내부의 화면 로컬 단계 구분 - isRoutingQuestion 하나만으로는
  // "라우팅 LLM 호출을 기다리는 중"과 "응답 TTS를 기다리는 중"을 구분할 수 없어서, 로딩
  // 화면이 약 10초에 달하는 대기 시간 전체를 하나의 단조로운 화면으로 보여주고 있었다.
  // pendingTranscription과 같은 관례를 따른다: 새로운 runtime state가 아니라 UI 전용 구분이다.
  const [isPreparingResponseAudio, setIsPreparingResponseAudio] = useState(false);
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
  const [completionSurveyVisible, setCompletionSurveyVisible] = useState(false);
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
    [questionOutcomes, storyDurationSeconds, storyPackage],
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
      storyId: storyPackage.storyId,
      childName,
      elapsedSeconds: elapsedStorySeconds(),
      questionOutcomes,
    });
  }, [childName, elapsedStorySeconds, questionOutcomes, storyPackage.storyId]);

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
  }, [runtimeState, trackStoryEvent]);

  useEffect(() => {
    if (runtimeState.status !== 'awaiting-question') return;
    const inviteKey = `${runtimeState.anchorId}:${runtimeState.questionRound}`;
    if (trackedQuestionInvitesRef.current.has(inviteKey)) return;
    trackedQuestionInvitesRef.current.add(inviteKey);
    void trackStoryEvent('question_invite_shown', {
      anchor_id: runtimeState.anchorId,
      scene_id: runtimeState.sceneId,
    });
  }, [runtimeState, trackStoryEvent]);

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
  }, [runtimeState, trackStoryEvent]);

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
      // 코드는 노출하지 않는다 - 사용자에게는 STALE_REVISION 같은 기술 문구 대신 상황별 카피만
      // 보여주고, 코드는 위 analytics 이벤트로만 전송된다.
      setParentMessage(runtimeTransitionFailureCopy(transition.failure.code));
      return false;
    }
    runtimeRef.current = transition.state;
    setRuntimeState(transition.state);
    if (transition.state.status === 'playing-fixed') {
      setParentMessage(null);
    }
    return true;
  }, [storyManifest]);

  const {
    currentClip,
    sceneIndex,
    displayedSceneIndex,
    scene,
    speaker,
    questionInviteAnchor,
    activeQuestionAnchor,
    isQuestionInvitePlayback,
    isBranchPlaybackState,
    isPlaybackDockState,
    isCompactPlayback,
    spokenText,
    captionSpeaker,
    displayedSubtitle,
    branchCaptionSpeaker,
    displayedBranchSubtitle,
    illustration,
  } = useOneStoryDerivedView({
    runtimeState,
    storyPackage,
    narrationState,
    childName,
    activeBranchVisualId,
    branchCaption,
    resumeCandidate,
    width,
  });

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
          const latestClip = getRuntimeClip(runtimeRef.current, storyPackage);
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
    storyManifest.storyId,
    storyPackage,
    trackStoryEvent,
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
  }, [
    sceneIndex,
    TOTAL_SCENES,
    storyManifest.audioGroups,
    storyManifest.scenes,
    storyPackage.audioAssets,
  ]);

  // 오디오 프리로드와 같은 "현재+다음 장면" 윈도 - 한 챕터가 재생되는 동안 다음 챕터 삽화가
  // 이미 브라우저 캐시에 들어가 있어야, 챕터가 바뀌는 순간 로딩이 보이지 않는다. 동시 요청 수
  // 제한은 preloadImages 안에 있다.
  useEffect(() => {
    const imageUris = storyManifest.scenes
      .slice(sceneIndex, Math.min(sceneIndex + 2, TOTAL_SCENES))
      .flatMap((preloadScene) =>
        preloadScene.visualStateIds.flatMap((visualStateId) => {
          const masterAssetId = storyManifest.visualStates.find(
            (visualState) => visualState.id === visualStateId,
          )?.masterAssetId;
          if (!masterAssetId) {
            return [];
          }
          return [storyPackage.illustrationForAssetId(masterAssetId).uri];
        }),
      );
    void preloadImages(imageUris);
  }, [
    sceneIndex,
    TOTAL_SCENES,
    storyManifest.scenes,
    storyManifest.visualStates,
    storyPackage,
  ]);

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
      // 로그인한 부모/반 계정에게만 저장 - 익명 데모(/demo)는 계정이 없어 남길 곳이 없다.
      // 리포트 저장 실패는 화면에 드러내지 않는다: 다시 시도할 뚜렷한 방법이 없고, 지금 보고
      // 있는 리포트 자체는 이미 완성된 상태라 아이/부모 경험에 영향을 주지 않는다.
      if (authState.status === 'authenticated') {
        // 선생님 세션(tutorStudentId 있음)은 childId를 붙이지 않는다 - 그 세션의 아이별
        // 필터는 부모 계정 리포트와 별개로 tutor_student_id 축에서 관리된다.
        const childIdForRecord = !tutorStudentId
          && authState.user.role === 'PARENT'
          && selectedChild?.id
          ? selectedChild.id
          : undefined;
        void recordStoryCompletion(authState.token, {
          storyId: storyPackage.storyId,
          durationSeconds,
          outcomes: questionOutcomes,
          tutorStudentId,
          childId: childIdForRecord,
        }).catch(() => {});
      }
    }
  }, [
    authState,
    selectedChild,
    tutorStudentId,
    parentReport.changedSceneCount,
    questionOutcomes,
    runtimeState.status,
    storyDurationSeconds,
    storyPackage.storyId,
    trackStoryEvent,
  ]);

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
  }, [
    childNameInput,
    commitEvent,
    recorder,
    voiceResearchConsentChecked,
    storyManifest.questionAnchors,
    storyManifest.storyId,
    trackStoryEvent,
  ]);

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
      questionState.status === 'awaiting-clarification' ||
      questionState.status === 'awaiting-safety-retry'
        ? {
            anchor_id: questionState.anchorId,
            scene_id: questionState.sceneId,
            skip_reason:
              questionState.status === 'awaiting-clarification'
                ? 'clarification_continue'
                : questionState.status === 'awaiting-safety-retry'
                  ? 'safety_retry_continue'
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
  }, [commitEvent, discardActiveQuestionAttempt, stopNarration, trackStoryEvent]);

  const resetQuestionAttemptTracking = useCallback(() => {
    questionAttemptCountRef.current = 0;
    sttAttemptCountRef.current = 0;
    questionInputSwitchedRef.current = false;
    transcriptCorrectedRef.current = false;
    pendingSttMsRef.current = null;
    questionRouteStartedAtRef.current = null;
    firstResponseAudioMsRef.current = null;
  }, []);

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
        previousQuestionState.status === 'awaiting-clarification' ||
        previousQuestionState.status === 'awaiting-safety-retry';
      if (isFreshQuestion) {
        resetQuestionAttemptTracking();
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
    [
      commitEvent,
      discardActiveQuestionAttempt,
      recorder,
      resetQuestionAttemptTracking,
      stopNarration,
      trackStoryEvent,
    ],
  );

  const beginTypedQuestion = useCallback(async () => {
    setParentMessage(null);
    await stopNarration();
    await discardActiveQuestionAttempt();
    const previousQuestionState = runtimeRef.current;
    const isFreshQuestion =
      previousQuestionState.status === 'awaiting-question' ||
      previousQuestionState.status === 'awaiting-clarification' ||
      previousQuestionState.status === 'awaiting-safety-retry';
    if (isFreshQuestion) {
      resetQuestionAttemptTracking();
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
  }, [
    commitEvent,
    discardActiveQuestionAttempt,
    resetQuestionAttemptTracking,
    stopNarration,
    trackStoryEvent,
  ]);

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
  }, [commitEvent, speechPipeline, storyManifest.storyId]);

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
    const priorActionFamilyIds = questionOutcomes
      .map(
        (outcome) =>
          outcome.selectedOption?.actionFamilyId ??
          outcome.actionFamilyId ??
          null,
      )
      .filter((familyId): familyId is string => Boolean(familyId));
    try {
      const result = await speechPipeline.route(
        {
          transcript: confirmedSpeech.transcript,
          storyId: storyManifest.storyId,
          sceneId: state.sceneId,
          anchorId: state.anchorId,
          questionRound: state.questionRound,
          consecutiveSafetyFailures: state.consecutiveSafetyFailures,
          priorActionFamilyIds,
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
        // 백엔드가 NEW_CHOICES를 원했지만 앵커당 상한에 걸려 ANSWER_RESUME으로 폴백한 경우만
        // true. 대시보드에서 이 flag의 발생 빈도를 세면 MAX_LIVE_FAMILIES_PER_ANCHOR 상향
        // 조정이 필요한지 판단할 수 있다.
        ...(plan.kind === 'route' && plan.liveBranchCapped
          ? { live_branch_capped: true }
          : {}),
      });
      if (plan.kind === 'route' && plan.route !== 'THREE_PATHS') {
        rememberQuestionOutcome(state.anchorId, plan);
      }
      const anchor = storyManifest.questionAnchors.find(
        (candidate) => candidate.id === state.anchorId,
      );
      const responseText = personalizeStoryText(plan.text, childName);
      const audioAlreadyIncluded = !planWasRepaired ? result.audio : null;
      if (!audioAlreadyIncluded && anchor) {
        setIsPreparingResponseAudio(true);
      }
      const preparedAudio =
        audioAlreadyIncluded ??
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
      setIsPreparingResponseAudio(false);
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
      setIsPreparingResponseAudio(false);
    }
  }, [
    commitEvent,
    childName,
    isRoutingQuestion,
    pendingTranscription,
    questionOutcomes,
    rememberQuestionOutcome,
    speechPipeline,
    storyPackage,
    storyManifest.questionAnchors,
    storyManifest.storyId,
    trackStoryEvent,
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

      // Tier 1: 선택지의 branchLine은 선택할 때마다 LLM이 새로 작성하므로(
      // OpenRouterClient.generatePlan()의 스키마 참고), awaiting-choice 동안 이미 준비되어
      // 있던 초대 문구(invitation text)와 달리 - 이 오디오는 아직 준비되어 있지 않다.
      // 여기서 내레이션 호출을 한 번 수행하며, 라우팅 응답의 TTS 준비에 이미 쓰이고 있는
      // 동일한 audioReadyWithin 경합(race)을 사용한다.
      if (selectedOption?.branchLine) {
        const anchor = storyManifest.questionAnchors.find(
          (candidate) => candidate.id === choiceState.anchorId,
        );
        if (anchor) {
          setIsPreparingResponseAudio(true);
          const controller = new AbortController();
          const audio = await audioReadyWithin(
            getResponseNarration(
              {
                storyId: storyManifest.storyId,
                anchor,
                text: selectedOption.branchLine,
              },
              controller.signal,
            ),
            RESPONSE_AUDIO_PREPARE_MS,
          );
          setIsPreparingResponseAudio(false);
          if (runtimeRef.current.status === 'awaiting-choice') {
            setPendingResponseAudio(audio);
          }
        }
      }

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
    [
      commitEvent,
      rememberQuestionOutcome,
      stopNarration,
      storyManifest,
      trackStoryEvent,
    ],
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
      await playResponseWithFallback({
        remoteAudio,
        responseText,
        signal: controller.signal,
        markFirstAudio,
        onCaptionProgress: (progress) => {
          setBranchCaption((current) =>
            current?.text === responseText
              ? { ...current, progress }
              : current,
          );
        },
        onFallbackStart: () => {
          setBranchCaption((current) =>
            current?.text === responseText
              ? { ...current, progress: null }
              : current,
          );
        },
        speakNarration,
        speakParams: {
          id: responseId,
          text: responseText,
          speakerId: choiceState.plan.speakerId,
          language: 'ko-KR',
        },
      });
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
    trackStoryEvent,
  ]);

  useLiveBranchPolling({
    runtimeState,
    storyId: storyManifest.storyId,
    commitEvent,
    trackStoryEvent,
    setStoryPackage,
  });

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
    const responseBranch = getBranchFamily(responseState, storyPackage);
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
        // 검수를 마친 기본 이미지를 즉시 보여주는 동시에 오디오도 시작한다 — 이미지
        // 로딩이 TTS나 상태 갱신을 절대 막아서는 안 된다.
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
      await playResponseWithFallback({
        remoteAudio,
        responseText,
        signal: controller.signal,
        markFirstAudio,
        onCaptionProgress: (progress) => {
          setBranchCaption((current) =>
            current?.text === responseText
              ? { ...current, progress }
              : current,
          );
        },
        onFallbackStart: () => {
          setBranchCaption((current) =>
            current?.text === responseText
              ? { ...current, progress: null }
              : current,
          );
        },
        speakNarration,
        speakParams: {
          id: narrationId,
          text: responseText,
          speakerId:
            responseState.plan.kind === 'route'
              ? responseState.plan.speakerId
              : storyPackage.narratorSpeakerId,
          language: 'ko-KR',
        },
      });
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
    storyPackage,
    trackStoryEvent,
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
  }, [
    commitEvent,
    questionOutcomes,
    stopNarration,
    storyManifest.questionAnchors,
    trackStoryEvent,
  ]);

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
    resetQuestionAttemptTracking();
    storyStartedAtRef.current = null;
    setStoryDurationSeconds(null);
    setParentReportVisible(false);
    setHomeMenuVisible(false);
    setExitReasonVisible(false);
    setResumeCandidate(null);
    clearLocalStoryProgress();
  }, [recorder, resetQuestionAttemptTracking, stopNarration, storyManifest]);

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
  }, [resumeCandidate, stopNarration, trackStoryEvent]);

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
    // 익명 데모(/demo)에서는 지우지 않는다 - 로그인/회원가입하면 이 기록으로 계정에
    // 리포트를 저장해 준다(useSyncDemoCompletionOnAuth 참고). 이미 로그인된 상태라면
    // 완료 시점에 서버로 저장이 끝났으니 로컬 사본은 정리한다.
    if (authState.status === 'authenticated') {
      clearLocalStoryProgress();
    }
    navigate('/');
  }, [authState, navigate, stopNarration]);

  const finishToday = useCallback(
    async (reason: (typeof EXIT_REASONS)[number]) => {
      const latestState = runtimeRef.current;
      const diagnosticClipId =
        getRuntimeClip(latestState, storyPackage)?.id ??
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
        // 종료 피드백 저장 실패로 인해 가족이 플레이어 안에 갇히는 일이 있어서는 절대 안 된다.
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
      storyPackage,
      trackStoryEvent,
    ],
  );

  const openParentReport = useCallback(() => {
    setParentReportVisible(true);
    void trackStoryEvent('parent_report_opened');
  }, [trackStoryEvent]);

  const closeParentReport = useCallback(() => {
    setParentReportVisible(false);
  }, []);

  const openCompletionSurvey = useCallback(async () => {
    await trackStoryEvent('survey_opened');
    setCompletionSurveyVisible(true);
  }, [trackStoryEvent]);

  const closeCompletionSurvey = useCallback(() => {
    setCompletionSurveyVisible(false);
  }, []);

  const meterPercent =
    typeof recorder.meteringDb === 'number'
      ? Math.max(8, Math.min(100, ((recorder.meteringDb + 60) / 48) * 100))
      : 8;
  const activeQuestionPrompt =
    runtimeState.status === 'awaiting-clarification' ||
    runtimeState.status === 'awaiting-safety-retry'
      ? questionPrompt(runtimeState, childName, storyPackage)
      : activeQuestionAnchor
        ? personalizeStoryText(activeQuestionAnchor.prompt, childName)
        : questionPrompt(runtimeState, childName, storyPackage);
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
    // 레이아웃
    isWide,
    isShort,
    isCompactPlayback,
    isPlaybackDockState,
    isParentReport,
    storyPackage,
    // runtime 및 파생 view 상태
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
    // 입력 상태
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
    isPreparingResponseAudio,
    parentMessage,
    // 선택지 / 응답
    parentReport,
    resumeCandidate,
    homeMenuVisible,
    exitReasonVisible,
    setExitReasonVisible,
    exitReasons: EXIT_REASONS,
    // 핸들러
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
    completionSurveyVisible,
    closeCompletionSurvey,
    getSceneIndex,
  };
}

export type OneStoryRuntime = ReturnType<typeof useOneStoryRuntime>;

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import {
  createInitialRuntimeState,
  jumpToScene as jumpToSceneTransition,
  transitionStoryRuntime,
  type QuestionInputMode,
  type QuestionAnchorId,
  type RouteOption,
  type RoutePlan,
  type SceneId,
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
  resumableProgressFor,
  saveLocalStoryProgress,
  createVoiceResearchConsent,
  getVoiceResearchAccountConsent,
  storeVoiceResearchSample,
  reportClientError,
  trackBetaEvent,
  type BetaEventName,
  type CompanionChatSummary,
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
  STT_UNAVAILABLE_CHILD_COPY,
  isSttUnavailableCode,
} from '@/entities/speech-pipeline';
import { narrationUtteranceSlug, type StoryRuntimePackage } from '@/entities/story';
import { useAuth } from '@/entities/auth';
import { useChildren } from '@/entities/child';
import { recordStoryCompletion } from '@/entities/story-completion';
import {
  useStoryNarration,
  preloadFixedNarration,
} from '@/features/narrate-story';
import {
  LISTEN_NOW_COPY,
  NO_SPEECH_REPROMPT_COPY,
  primeRecorderAudio,
  useAudioRecorderAdapter,
  useSpeechAutoStop,
  type RecordingResult,
} from '@/features/record-question';
import {
  playResponseAudio,
  primeResponseAudio,
  getQuestionNarration,
  preloadQuestionNarration,
  getResponseNarration,
  prefetchResponseNarration,
  createChoicePrefetcher,
  type ResponseAudio,
} from '@/features/route-question';

import {
  FIXED_AUDIO_FAILURE_RECOVERY_MS,
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
  splitQuestionOutcomesAtScene,
} from '../lib/runtime-view';
import { resolveExit } from '../lib/exit-destination';
import {
  isAwaitingInviteFor,
  questionSkipMetadata,
  type QuestionSkipReason,
} from '../lib/question-skip';
import { preloadImages } from '../lib/preload-images';
import { playResponseWithFallback } from '../lib/play-clip-with-fallback';
import { resolveVoiceResearchEnabled } from './voice-research-enabled';
import { useOneStoryDerivedView } from './use-one-story-derived-view';
import { useLiveBranchPolling } from './use-live-branch-polling';

// Q-34: 선택지 음성 미리 만들기 캐시. 모듈 단위라 409 PREFETCH_DISABLED 후 세션 내내 멈춘다.
const choicePrefetcher = createChoicePrefetcher<ResponseAudio>({
  dispose: (audio) => {
    if (audio.kind === 'pcm-stream') void audio.stream.cancel().catch(() => undefined);
  },
});

export function useOneStoryRuntime(
  initialStoryPackage: StoryRuntimePackage,
  tutorStudentId?: string,
  companionConversationId?: string,
  lessonId?: string,
  /**
   * 어디서 들어왔는지(Q-36). resume = 홈의 "이어서 읽기" - 이어 듣기를 묻지 않고 바로 이어 간다.
   * start = 홈에서 아이를 골라 "이야기 시작하기" - 저장된 진행이 없으면 시작 화면 없이 바로 시작한다.
   */
  entry?: 'resume' | 'start',
) {
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
    (eventName: BetaEventName, metadata: Record<string, string | number | boolean> = {}) => {
      // 재생 실패는 퍼널 이벤트와 별개로 운영 알림(Grafana client-error-spike)에도 보낸다.
      if (eventName === 'playback_issue') {
        reportClientError({
          kind: 'PLAYBACK',
          message: [metadata.issue_type, metadata.audio_source, metadata.failure_code].filter(Boolean).join(' '),
          storyId: storyManifest.storyId,
          sceneId: typeof metadata.scene_id === 'string' ? metadata.scene_id : undefined,
        });
      }
      return trackBetaEvent(eventName, {
        story_version: storyManifest.contentVersion,
        ...metadata,
      });
    },
    [storyManifest.contentVersion, storyManifest.storyId],
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
  // 휴대폰 세로 폭 - 상단 바를 한 줄 압축 레이아웃(로고+회차 캡션 / 아이콘 버튼 / 진행 pill)으로
  // 바꾸고, 재생 컨트롤은 상단이 아니라 엄지가 닿는 하단 도크(PlaybackDock)로 옮기는 기준.
  // isWide(900)와 사이의 태블릿 폭은 기존 데스크톱형 배치를 그대로 쓴다.
  const isNarrow = width < 600;
  const recorder = useAudioRecorderAdapter();
  const { state: authState } = useAuth();
  const { selectedChild } = useChildren();
  // 대화 원장(BE conversation_record) 귀속 - 아이는 완주 기록과 같은 규칙으로 정한다: 선생님
  // 세션은 tutorStudentId만, 부모 세션은 홈에서 고른 아이. 세션 id는 상시대화와 같은 conversationId.
  const conversationAttribution = useMemo(
    () => ({
      sessionId: companionConversationId,
      childId:
        !tutorStudentId && authState.status === 'authenticated' && authState.user.role === 'PARENT'
          ? selectedChild?.id
          : undefined,
      tutorStudentId,
      lessonId,
    }),
    [companionConversationId, tutorStudentId, lessonId, authState, selectedChild?.id],
  );
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
  // 로그인한 보호자의 계정 단위 음성 연구 동의(마이페이지에서 켜고 끈다). 꺼져 있으면 세션 동의를
  // 만들지 않아 원음을 올리지 않는다. 토큰은 업로드에 실어 서버가 동의를 다시 확인하고 녹음을 계정에
  // 연결하게 한다(마이페이지 철회 시 삭제 대상). 비로그인·선생님 세션은 기존처럼 익명으로 저장한다.
  const voiceResearchAccountRef = useRef<{ token: string | null; enabled: boolean; ownerId: string | null }>({
    token: null,
    enabled: false,
    ownerId: null,
  });
  // 홈에서 아이를 선택하고 들어왔으면 그 이름으로 미리 채운다. 데모(/demo)처럼 선택된 아이가
  // 없으면 빈 입력으로 남는다(IdlePanel이 이 경우에만 입력 UI를 보여준다).
  const [childNameInput, setChildNameInput] = useState(() => selectedChild?.name ?? '');
  const [childName, setChildName] = useState('');
  const [parentMessage, setParentMessage] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const [pendingTranscription, setPendingTranscription] =
    useState<TranscriptionSuccess | null>(null);
  const [isRoutingQuestion, setIsRoutingQuestion] = useState(false);
  // "processing-question" 안에서 "라우팅 LLM 대기"와 "응답 TTS 대기"를 구분하는 UI 전용 상태
  // (runtime state가 아니다) - 로딩 화면 문구를 단계별로 바꾸는 데 쓴다.
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
  // record() 응답의 companionChatSummary를 담아 실시간 리포트가 별도 왕복 없이 렌더한다.
  // history 상세 화면은 자체적으로 detail을 다시 조회하므로 이 state를 공유하지 않는다.
  const [companionChatSummary, setCompanionChatSummary] =
    useState<CompanionChatSummary | null>(null);
  const [resumeCandidate, setResumeCandidate] =
    useState<LocalStoryProgress | null>(() =>
      resumableProgressFor(loadLocalStoryProgress(), storyPackage.storyId, selectedChild?.id),
    );
  const [homeMenuVisible, setHomeMenuVisible] = useState(false);
  const parentReport = useMemo(
    () =>
      buildParentReport(storyPackage.reportCopy, questionOutcomes, {
        durationSeconds: storyDurationSeconds,
        branchAssetId: storyPackage.branchIllustrationAssetId,
        branchSummary: storyPackage.branchReportSummary,
        companionChat: companionChatSummary,
      }),
    [companionChatSummary, questionOutcomes, storyDurationSeconds, storyPackage],
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
      // 이어서 읽기가 이 진행을 남긴 아이로 재생·기록되게 한다(Q-36). 데모·선생님 세션은 없다.
      childId: conversationAttribution.childId,
      elapsedSeconds: elapsedStorySeconds(),
      questionOutcomes,
    });
  }, [childName, conversationAttribution.childId, elapsedStorySeconds, questionOutcomes, storyPackage.storyId]);

  useEffect(() => {
    if (runtimeState.status !== 'idle') {
      persistCurrentProgress();
    }
  }, [persistCurrentProgress, runtimeState]);

  const parentToken =
    authState.status === 'authenticated' && authState.user.role === 'PARENT'
      ? authState.token
      : null;
  const parentUserId =
    authState.status === 'authenticated' && authState.user.role === 'PARENT' ? authState.user.id : null;
  useEffect(() => {
    voiceResearchAccountRef.current = { token: parentToken, enabled: false, ownerId: parentUserId };
    if (!parentToken) return;
    let cancelled = false;
    // 기본은 꺼짐 - 보호자가 현재 약관에 명시적으로 동의한 것이 확인될 때만 켜고, 조회에 실패하면 꺼 둔다(서버도 같은 기준으로 거절).
    getVoiceResearchAccountConsent(parentToken)
      .then((consent) => {
        if (!cancelled) {
          voiceResearchAccountRef.current = { token: parentToken, enabled: resolveVoiceResearchEnabled('PARENT', consent), ownerId: parentUserId };
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [parentToken, parentUserId]);

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
    reportClientError({
      kind: 'RUNTIME_FAILURE',
      message: `${runtimeState.failure.stage} ${runtimeState.failure.code}`,
      storyId: storyManifest.storyId,
      sceneId: runtimeState.sceneId,
    });
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
  }, [runtimeState, storyManifest.storyId, trackStoryEvent]);

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

  // 선택지 초대(awaiting-choice)와 응답(playing-response) 재생 effect가 공유한다 - ref/setState만
  // 쓰므로 identity가 고정이라 effect deps를 흔들지 않는다.
  const markFirstResponseAudio = useCallback(() => {
    if (
      firstResponseAudioMsRef.current === null &&
      questionRouteStartedAtRef.current !== null
    ) {
      firstResponseAudioMsRef.current =
        Date.now() - questionRouteStartedAtRef.current;
    }
  }, []);
  const setBranchCaptionProgress = useCallback(
    (text: string, progress: number | null) => {
      setBranchCaption((current) =>
        current?.text === text ? { ...current, progress } : current,
      );
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
      // 로그인한 부모에게만 저장 - 익명 데모(/demo)는 계정이 없어 남길 곳이 없다.
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
          companionConversationId,
          lessonId,
        })
          .then((saved) => {
            if (saved.companionChatSummary) {
              setCompanionChatSummary(saved.companionChatSummary);
            }
          })
          .catch(() => {});
      }
    }
  }, [
    authState,
    selectedChild,
    tutorStudentId,
    companionConversationId,
    lessonId,
    parentReport.changedSceneCount,
    questionOutcomes,
    runtimeState.status,
    storyDurationSeconds,
    storyPackage.storyId,
    trackStoryEvent,
  ]);

  /**
   * Q-34: 가정 세션은 "이야기 시작하기"(이어서 듣기) 탭에서 마이크 권한을 미리 받아 둔다 - 질문 초대가 끝나면
   * 탭 없이 바로 녹음을 시작하려고. 결과는 페이지 안 녹음기끼리 공유된다. 거절·미지원이면 아무 안내 없이
   * 기존 "말하기" 버튼 방식으로 남는다. 반 수업은 버튼으로 시작하므로 미리 묻지 않는다.
   */
  const prepareMicrophoneForAutoListen = useCallback(() => {
    primeRecorderAudio();
    if (lessonId || recorder.permissionState !== 'unknown' || recorder.permissionRequestPending) {
      return;
    }
    void recorder.requestPermission();
  }, [lessonId, recorder]);

  const startStory = useCallback(() => {
    primeResponseAudio();
    prepareMicrophoneForAutoListen();
    const normalizedName = childNameInput.trim().slice(0, 10);
    // 질문 원음은 보호자가 온보딩/마이페이지에서 현재 약관에 동의한 계정만 저장한다(이야기 화면에 별도
    // 동의 UI 없음) - 저장 호출부가 이 ref가 non-null인지로 판단하므로 세션 시작 시 동의된 경우에만 채운다.
    voiceResearchConsentRef.current = voiceResearchAccountRef.current.enabled
      ? createVoiceResearchConsent(voiceResearchAccountRef.current.ownerId)
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
    prepareMicrophoneForAutoListen,
    recorder,
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

  const continueStoryWithReason = useCallback(async (skipReason?: QuestionSkipReason) => {
    const skippedQuestion = questionSkipMetadata(runtimeRef.current, skipReason);
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

  // 버튼 onPress에 바로 넘기므로 인자를 받지 않는다(이벤트 객체가 사유로 들어가지 않게).
  const continueStory = useCallback(() => continueStoryWithReason(), [continueStoryWithReason]);

  /**
   * 질문 초대 대화(그레텔 패널)에서 이야기로 돌아간다 - 이야기가 아직 그 앵커의 초대를 기다릴 때만.
   * 이미 다른 상태로 넘어갔으면(행동 실행·처음부터 다시 등) 아무 것도 하지 않고 false.
   */
  const continueFromInvite = useCallback(
    async (anchorId: string, skipReason?: QuestionSkipReason) => {
      if (!isAwaitingInviteFor(runtimeRef.current, anchorId)) return false;
      await continueStoryWithReason(skipReason);
      return true;
    },
    [continueStoryWithReason],
  );

  const resetQuestionAttemptTracking = useCallback(() => {
    questionAttemptCountRef.current = 0;
    sttAttemptCountRef.current = 0;
    questionInputSwitchedRef.current = false;
    transcriptCorrectedRef.current = false;
    pendingSttMsRef.current = null;
    questionRouteStartedAtRef.current = null;
    firstResponseAudioMsRef.current = null;
  }, []);

  /**
   * 말/글 질문 시도 하나를 추적 ref에 반영하고 입력 모드를 바꾼다. 앵커에서 새로 시작하는
   * 질문이면 추적을 초기화하고, 진행 중 질문에서 입력 방식만 바꾼 거면 switched로 표시한다.
   * 반환값은 새로 시작하는 질문인지(question_started 이벤트 조건).
   */
  const registerQuestionAttempt = useCallback(
    (inputMode: QuestionInputMode) => {
      const previousQuestionState = runtimeRef.current;
      const isFreshQuestion =
        previousQuestionState.status === 'awaiting-question' ||
        previousQuestionState.status === 'awaiting-clarification' ||
        previousQuestionState.status === 'awaiting-safety-retry';
      if (isFreshQuestion) {
        resetQuestionAttemptTracking();
      } else if (
        'inputMode' in previousQuestionState &&
        previousQuestionState.inputMode !== inputMode
      ) {
        questionInputSwitchedRef.current = true;
      }
      questionAttemptCountRef.current += 1;
      setQuestionMode(inputMode);
      return isFreshQuestion;
    },
    [resetQuestionAttemptTracking],
  );

  const beginQuestion = useCallback(
    async () => {
      primeResponseAudio();
      primeRecorderAudio();
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
      const isFreshQuestion = registerQuestionAttempt('voice');
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
      registerQuestionAttempt,
      stopNarration,
      trackStoryEvent,
    ],
  );

  const beginTypedQuestion = useCallback(async () => {
    setParentMessage(null);
    await stopNarration();
    await discardActiveQuestionAttempt();
    const isFreshQuestion = registerQuestionAttempt('text');
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
    registerQuestionAttempt,
    stopNarration,
    trackStoryEvent,
  ]);

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
          ...conversationAttribution,
          inputMode: 'VOICE',
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
      } else if (isSttUnavailableCode(result.failure.code)) {
        // 음성 인식이 막혔다 - 질문 기회를 쓰지 않고 안내와 함께 글 질문 입력으로 바로 넘긴다.
        pendingVoiceResearchSampleRef.current = null;
        await beginTypedQuestion();
        setParentMessage(STT_UNAVAILABLE_CHILD_COPY);
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
  }, [beginTypedQuestion, commitEvent, conversationAttribution, speechPipeline, storyManifest.storyId]);

  // 무음 자동 종료·30초 상한·"다 했어요" 버튼이 겹쳐도 녹음은 한 번만 끝낸다.
  const finishingQuestionRef = useRef(false);
  const finishQuestion = useCallback(async () => {
    if (finishingQuestionRef.current) return;
    finishingQuestionRef.current = true;
    const recording = await recorder.stopRecording().finally(() => {
      finishingQuestionRef.current = false;
    });
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

  const isVoiceRecordingState =
    runtimeState.status === 'recording-question' &&
    runtimeState.inputMode === 'voice';
  // Q-34: 말한 뒤 1.5초 조용하면 저절로 끝내고, 15초 말이 없으면 다시 묻고, 그 뒤 15초도 없으면
  // 질문을 보내지 않고 이야기를 이어 간다. 30초 상한도 여기서 센다. "다 했어요" 버튼은 그대로 둔다.
  const voiceAutoStop = useSpeechAutoStop(recorder, {
    enabled: isVoiceRecordingState,
    onSpeechEnd: () => void finishQuestion(),
    onGiveUp: () => void continueStory(),
  });

  const routeConfirmedSpeech = useCallback(async (
    confirmedSpeech: TranscriptionSuccess['speech'],
  ) => {
    if (isRoutingQuestion) {
      return;
    }
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
          ...conversationAttribution,
          // 글로 쓴 질문은 processTypedQuestion이 text/plain으로 만든다 - 나머지는 STT를 거친 문장.
          inputMode: confirmedSpeech.normalizedMimeType === 'text/plain' ? 'TEXT' : 'VOICE',
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
            // storyManifest.storyId("HG")가 아니라 storyPackage.slug("hansel-gretel") - BE의
            // VoiceResearchValidator가 story_id를 StoryRegistry.getBySlug()로 찾는다.
            storyId: storyPackage.slug,
            sceneId: state.sceneId,
            anchorId: state.anchorId,
            questionRound: state.questionRound,
            sttDraft: pendingVoiceResearchSample.sttDraft,
            confirmedTranscript: confirmedSpeech.transcript,
          }, { token: voiceResearchAccountRef.current.token });
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
          storyId: storyPackage.slug,
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
        }, { token: voiceResearchAccountRef.current.token });
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
    conversationAttribution,
    childName,
    isRoutingQuestion,
    questionOutcomes,
    rememberQuestionOutcome,
    speechPipeline,
    storyPackage,
    storyManifest.questionAnchors,
    storyManifest.storyId,
    trackStoryEvent,
  ]);

  const confirmTranscript = useCallback(async () => {
    if (!pendingTranscription) {
      return;
    }
    await routeConfirmedSpeech(pendingTranscription.speech);
  }, [pendingTranscription, routeConfirmedSpeech]);

  // 글 질문은 이미 아이가 직접 쓴 문장이라 확인 단계 없이 바로 라우팅한다.
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
    pendingVoiceResearchSampleRef.current = null;
    if (!commitEvent({ type: 'TEXT_SUBMITTED', transcript })) {
      return;
    }
    await routeConfirmedSpeech({
      status: 'speech',
      transcript,
      locale: 'ko',
      normalizedMimeType: 'text/plain',
    });
  }, [commitEvent, routeConfirmedSpeech, typedQuestion]);

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

      // 선택지의 branchLine은 LLM이 옵션마다 따로 쓴 대사라(OpenRouterClient.generatePlan() 스키마
      // 참고) 오디오가 미리 준비되어 있지 않다 - 라우팅 응답과 같은 audioReadyWithin 경합으로 준비한다.
      const prefetchedAudio = selectedOption?.branchLine
        ? choicePrefetcher.take(selectedOption.id)
        : null;
      choicePrefetcher.abort();
      if (prefetchedAudio) {
        // 미리 만든 음성이 준비돼 있으면 로딩 패널 없이 바로 이어간다.
        setPendingResponseAudio(prefetchedAudio);
      } else if (selectedOption?.branchLine) {
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

  const choiceStatus = runtimeState.status;
  const choiceKey =
    runtimeState.status === 'awaiting-choice'
      ? `${runtimeState.anchorId}-${runtimeState.questionRound}`
      : null;
  useEffect(() => {
    const current = runtimeRef.current;
    if (choiceStatus !== 'awaiting-choice' || current.status !== 'awaiting-choice') {
      return;
    }
    const anchor = storyManifest.questionAnchors.find(
      (candidate) => candidate.id === current.anchorId,
    );
    if (!anchor) return;
    choicePrefetcher.start(
      current.plan.options.map((option) => ({ id: option.id, text: option.branchLine })),
      (item, signal) =>
        prefetchResponseNarration(
          { storyId: storyManifest.storyId, anchor, text: item.text },
          signal,
        ),
    );
    return () => choicePrefetcher.abort();
  }, [choiceStatus, choiceKey, storyManifest]);

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
      await playResponseWithFallback({
        remoteAudio,
        responseText,
        signal: controller.signal,
        markFirstAudio: markFirstResponseAudio,
        onCaptionProgress: (progress) =>
          setBranchCaptionProgress(responseText, progress),
        onFallbackStart: () => setBranchCaptionProgress(responseText, null),
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
    markFirstResponseAudio,
    pendingResponseAudio,
    runtimeState,
    setBranchCaptionProgress,
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
    const familyBridge =
      responseState.plan.kind === 'route' && responseState.plan.actionFamilyId
        ? storyPackage.branchInteractionCopy(responseState.plan.actionFamilyId)
        : null;
    // 세 갈래에서 고른 분기, 또는 대화에서 뜻을 확인한 분기(말할 문장이 확인 문구 그대로)면
    // 미리 녹음한 확인 문구 음성을 쓴다.
    const selectedBridge =
      familyBridge &&
      responseState.plan.kind === 'route' &&
      (responseState.plan.originRoute === 'THREE_PATHS' || responseState.plan.text === familyBridge.text)
        ? familyBridge
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
      const responseSpeakerId =
        responseState.plan.kind === 'route'
          ? responseState.plan.speakerId
          : storyPackage.narratorSpeakerId;
      setBranchCaption({
        text: responseText,
        speakerId: responseSpeakerId,
        progress: pendingResponseAudio ? 0 : null,
      });
      if (branchVisualAssetId) {
        // 검수를 마친 기본 이미지를 즉시 보여주는 동시에 오디오도 시작한다 — 이미지
        // 로딩이 TTS나 상태 갱신을 절대 막아서는 안 된다.
        setActiveBranchVisualId(branchVisualAssetId);
      }
      const remoteAudio = pendingResponseAudio;
      await playResponseWithFallback({
        remoteAudio,
        responseText,
        signal: controller.signal,
        markFirstAudio: markFirstResponseAudio,
        onCaptionProgress: (progress) =>
          setBranchCaptionProgress(responseText, progress),
        onFallbackStart: () => setBranchCaptionProgress(responseText, null),
        speakNarration,
        speakParams: {
          id: narrationId,
          text: responseText,
          speakerId: responseSpeakerId,
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
          const segmentText = personalizeStoryText(segment.text, childName);
          const segmentSpeakerId = storyPackage.speakerIdForTag(segment.speaker);
          setBranchCaption({
            text: segmentText,
            speakerId: segmentSpeakerId,
            progress: null,
          });
          await speakNarration({
            // story-package.ts가 이 세그먼트의 고정 오디오를 담은 slug(narrationUtteranceSlug)와
            // 같아야 한다 - 다르면 고정 오디오를 못 찾고 매번 즉석 TTS로 폴백한다.
            id: narrationUtteranceSlug(responseBranch.id, segmentIndex),
            text: segmentText,
            speakerId: segmentSpeakerId,
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
    markFirstResponseAudio,
    narrationAttempt,
    pendingResponseAudio,
    runtimeState,
    setBranchCaptionProgress,
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

  /**
   * Q-31 그레텔 대화: 질문 초대에서 아이가 뜻을 확인한 준비된 행동을 실행한다. 확인 문구(acknowledgementText,
   * 미리 녹음됨)를 말한 뒤 분기 장면을 재생하고 정해진 합류 지점으로 이어진다.
   */
  const confirmDialogueAction = useCallback(
    async (familyId: string, childMeaning: string) => {
      const state = runtimeRef.current;
      if (state.status !== 'awaiting-question') return false;
      const anchor = storyManifest.questionAnchors.find((candidate) => candidate.id === state.anchorId);
      const family = storyManifest.fallbackFamilies.find((candidate) => candidate.id === familyId);
      if (!anchor || !family || !anchor.fallbackFamilyIds.includes(family.id)) return false;
      const plan: RoutePlan = {
        kind: 'route',
        route: 'DIRECT_ACTION',
        childRelevantMeaning: childMeaning || family.meaning,
        coverageStatus: 'exact',
        coverageReason: 'dialogue-confirmed',
        text: family.acknowledgementText ?? '좋아, 그렇게 해 보자.',
        speakerId: anchor.promptSpeakerId,
        actionFamilyId: family.id,
        rejoinAt: family.rejoinAnchorId,
        fallbackFamilyId: family.id,
        options: [],
        versions: {
          modelId: 'dialogue',
          promptVersion: 'dialogue',
          storyManifestVersion: storyManifest.contentVersion,
          routePolicyVersion: 'dialogue',
        },
      };
      await stopNarration();
      activeNarrationIdRef.current = null;
      setPendingResponseAudio(null);
      setBranchCaption(null);
      if (!commitEvent({ type: 'ACTION_CONFIRMED', plan })) return false;
      rememberQuestionOutcome(anchor.id, plan);
      void trackStoryEvent('dialogue_step', {
        anchor_id: anchor.id,
        scene_id: anchor.sceneId,
        entry_mode: 'INVITE',
        turn_kind: 'CONFIRM',
        family_id: family.id,
      });
      return true;
    },
    [commitEvent, rememberQuestionOutcome, stopNarration, storyManifest, trackStoryEvent],
  );

  /** 행동 없이 대화만 하고 이야기로 돌아간 질문 초대도 리포트에 남긴다(아이가 실제로 말한 경우만). */
  const recordDialogueOutcome = useCallback(
    (anchorId: string, childMeaning: string, lastReply: string) => {
      const anchor = storyManifest.questionAnchors.find((candidate) => candidate.id === anchorId);
      if (!anchor || !childMeaning) return;
      setQuestionOutcomes((current) => [
        ...current.filter((item) => item.anchorId !== anchor.id),
        {
          anchorId: anchor.id,
          childRelevantMeaning: childMeaning,
          route: 'ANSWER_RESUME',
          responseText: lastReply,
          actionFamilyId: null,
        },
      ]);
    },
    [storyManifest.questionAnchors],
  );

  /** 그레텔 대화를 열면 낭독을 멈추고, 닫으면 멈춘 문장부터 이어 간다. 멈춘 게 없으면 아무것도 안 한다. */
  const dialoguePausedNarrationRef = useRef(false);
  const pauseForDialogue = useCallback(async () => {
    if (narrationState.isSpeaking && !narrationState.isPaused) {
      dialoguePausedNarrationRef.current = await pauseNarration();
    }
  }, [narrationState.isPaused, narrationState.isSpeaking, pauseNarration]);
  const resumeAfterDialogue = useCallback(async () => {
    if (dialoguePausedNarrationRef.current) {
      dialoguePausedNarrationRef.current = false;
      await resumeNarration();
    }
  }, [resumeNarration]);

  /** 그레텔의 고정 대사(도움 단계 등)를 그레텔 목소리로 말한다. */
  const speakDialogueLine = useCallback(
    async (id: string, text: string, speakerId: string) => {
      await speakNarration({ id, text, speakerId, language: 'ko-KR' });
    },
    [speakNarration],
  );

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
    setResumeCandidate(null);
    clearLocalStoryProgress();
  }, [recorder, resetQuestionAttemptTracking, stopNarration, storyManifest]);

  /**
   * 챕터 사이드바에서 지난 장면(또는 현재 장면의 처음)을 눌렀을 때 - restartStory()와 달리
   * idle로 완전히 되돌리지 않고 그 장면의 시작 지점(playing-fixed)으로 곧장 이동한다. 세션
   * 자체(아이 이름/음성 연구 동의/시작 시각)는 유지하되, 질문·분기·재생 관련 임시 추적 상태는
   * restartStory와 같은 항목들을 정리한다.
   *
   * 질문 기록은 되감는 장면부터 그 이후의 것만 버린다(splitQuestionOutcomesAtScene) - 사이드바가
   * 확인 모달에 보여주는 "사라질 기록 n개"도 같은 함수로 센다.
   */
  const jumpToScene = useCallback(
    async (sceneId: SceneId) => {
      processingAbortRef.current?.abort();
      await stopNarration();
      recorder.resetRecording();
      const transition = jumpToSceneTransition(storyManifest, sceneId);
      if (!transition.ok) {
        setParentMessage(runtimeTransitionFailureCopy(transition.failure.code));
        return;
      }
      runtimeRef.current = transition.state;
      setRuntimeState(transition.state);
      activeNarrationIdRef.current = null;
      setParentMessage(null);
      setLastTranscript(null);
      setPendingTranscription(null);
      setIsRoutingQuestion(false);
      setPendingResponseAudio(null);
      setActiveBranchVisualId(null);
      setBranchCaption(null);
      setTypedQuestion('');
      setQuestionOutcomes(
        (current) => splitQuestionOutcomesAtScene(current, storyManifest, sceneId).kept,
      );
      trackedPlaybackResultsRef.current.clear();
      trackedQuestionInvitesRef.current.clear();
      resetQuestionAttemptTracking();
      setStoryDurationSeconds(null);
      setParentReportVisible(false);
      setHomeMenuVisible(false);
        setResumeCandidate(null);
    },
    [recorder, resetQuestionAttemptTracking, stopNarration, storyManifest],
  );

  const resumeStory = useCallback(async () => {
    if (!resumeCandidate) {
      return;
    }
    prepareMicrophoneForAutoListen();
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
  }, [prepareMicrophoneForAutoListen, resumeCandidate, stopNarration, trackStoryEvent]);

  // 홈에서 곧장 들어온 재생은 시작 화면·이어 듣기 질문을 건너뛴다(Q-36). 마운트 때 한 번만.
  const entryHandledRef = useRef(false);
  useEffect(() => {
    if (entryHandledRef.current || !entry) return;
    // 다음 틱에 실행한다 - effect 안에서 곧장 상태를 바꾸지 않고, 개발 모드의 effect 두 번 실행에도 한 번만 돈다.
    const timer = setTimeout(() => {
      entryHandledRef.current = true;
      if (entry === 'resume' && resumeCandidate) {
        void resumeStory();
      } else if (entry === 'start' && !resumeCandidate) {
        startStory();
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [entry, resumeCandidate, resumeStory, startStory]);

  const dismissResumeAndRestart = useCallback(() => {
    clearLocalStoryProgress();
    setResumeCandidate(null);
  }, []);

  const openHomeMenu = useCallback(async () => {
    if (narrationState.isSpeaking && !narrationState.isPaused) {
      await pauseNarration();
    }
    persistCurrentProgress();
    setHomeMenuVisible(true);
  }, [
    narrationState.isPaused,
    narrationState.isSpeaking,
    pauseNarration,
    persistCurrentProgress,
  ]);

  const continueFromHomeMenu = useCallback(async () => {
    setHomeMenuVisible(false);
    if (narrationState.isPaused) {
      await resumeNarration();
    }
  }, [narrationState.isPaused, resumeNarration]);

  // Q-34: 나가기는 한 길 - 도중이면 진행을 저장하고(돌아오면 이어 듣기), 완주 후 로그인 상태면
  // 기록을 정리한 뒤 홈(homePathForAuth)으로 간다. 외부 사이트로는 가지 않는다.
  const leaveStory = useCallback(async () => {
    const plan = resolveExit(authState, runtimeRef.current.status);
    if (plan.saveProgress) persistCurrentProgress();
    const latestState = runtimeRef.current;
    const diagnostics = buildExitDiagnostics({
      state: latestState,
      questionOutcomes,
      clipId:
        getRuntimeClip(latestState, storyPackage)?.id ??
        activeNarrationIdRef.current ??
        narrationState.captionRequestId,
      narration: {
        isSpeaking: narrationState.isSpeaking,
        isPaused: narrationState.isPaused,
        source: narrationState.source,
      },
    });
    // 전송 완료를 기다리지 않는다(fire-and-forget). 사유 설문은 없어 reason_code는 보내지 않는다.
    void trackStoryEvent('explicit_exit', diagnostics);
    processingAbortRef.current?.abort();
    await stopNarration();
    if (plan.clearProgress) clearLocalStoryProgress();
    setHomeMenuVisible(false);
    navigate(plan.path);
  }, [
    authState,
    navigate,
    narrationState.captionRequestId,
    narrationState.isPaused,
    narrationState.isSpeaking,
    narrationState.source,
    persistCurrentProgress,
    questionOutcomes,
    stopNarration,
    storyPackage,
    trackStoryEvent,
  ]);

  // "처음부터 다시"는 기록이 지워지므로 확인 모달을 거친 뒤에만 실행한다.
  const [restartConfirmVisible, setRestartConfirmVisible] = useState(false);
  const requestRestart = useCallback(() => setRestartConfirmVisible(true), []);
  const cancelRestart = useCallback(() => setRestartConfirmVisible(false), []);
  const confirmRestart = useCallback(async () => {
    setRestartConfirmVisible(false);
    await restartStory();
  }, [restartStory]);

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

  const showPlaybackControls =
    isPlaybackDockState && !isParentReport && Boolean(currentClip || isBranchPlaybackState);
  const showPlaybackDock = isNarrow && showPlaybackControls;

  return {
    // 반 수업(lessonId)으로 연 이야기 - 선생님이 반 아이들과 읽으니 "부모님과 함께" 문구를 바꾼다.
    isClassLesson: Boolean(lessonId),
    // 레이아웃
    isWide,
    isShort,
    isNarrow,
    isPlaybackDockState,
    // 재생 컨트롤(일시정지/다시/다음/자막)을 보일지 - TopBar(넓은 화면)와 PlaybackDock(폰)이 같은
    // 조건을 써야 도크 자리를 비워 둔 여백(scrollContentNarrowPlayback)과 실제 도크가 어긋나지 않는다.
    showPlaybackControls,
    showPlaybackDock,
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
    // 녹음 중 아이에게 보이는 한 줄 - 15초 말이 없으면 다시 묻는 문구로 바뀐다(서버 음성 없이 글로만).
    voiceListenPrompt: voiceAutoStop.reprompted
      ? NO_SPEECH_REPROMPT_COPY
      : LISTEN_NOW_COPY,
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
    // 홈에서 이미 골라 놓은 아이 이름 - 있으면 IdlePanel이 이름 입력 대신 확인 문구만 보여준다
    // (null이면 데모 등 선택된 아이가 없는 경로).
    selectedChildName: selectedChild?.name ?? null,
    questionMode,
    typedQuestion,
    conversationAttribution,
    setTypedQuestion,
    recorder,
    pendingTranscription,
    isRoutingQuestion,
    isPreparingResponseAudio,
    parentMessage,
    // 선택지 / 응답
    parentReport,
    // 챕터 사이드바가 "되감으면 사라질 질문 기록이 있는지"를 세는 데 쓴다(확인 모달 게이팅).
    questionOutcomes,
    resumeCandidate,
    homeMenuVisible,
    restartConfirmVisible,
    requestRestart,
    cancelRestart,
    confirmRestart,
    // 핸들러
    startStory,
    continueStory,
    continueFromInvite,
    activeQuestionAnchorId: activeQuestionAnchor?.id ?? null,
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
    confirmDialogueAction,
    trackStoryEvent,
    recordDialogueOutcome,
    pauseForDialogue,
    resumeAfterDialogue,
    speakDialogueLine,
    stopDialogueSpeech: stopNarration,
    skipCurrentScene,
    restartStory,
    jumpToScene,
    resumeStory,
    dismissResumeAndRestart,
    openHomeMenu,
    continueFromHomeMenu,
    leaveStory,
    finishExperience: leaveStory,
    openParentReport,
    closeParentReport,
    openCompletionSurvey,
    completionSurveyVisible,
    closeCompletionSurvey,
    getSceneIndex,
  };
}

export type OneStoryRuntime = ReturnType<typeof useOneStoryRuntime>;

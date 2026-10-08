import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { OneStoryPage } from '@/pages/one-story';
import { describeStoryLoadFailure, loadStoryPackage, type StoryLoadFailure, type StoryRuntimePackage } from '@/entities/story';
import { homePathForAuth, useAuth } from '@/entities/auth';
import { useChildren } from '@/entities/child';
import { parsePlaySetting, playEntrySource } from '@/entities/play-session';
import { recordingConsentStore } from '@/entities/analytics';
import { playerChildSync } from '../model/player-child-sync';
import { entitlementNextStep } from '../model/entitlement-next-step';
import { ActionButton, BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; storyPackage: StoryRuntimePackage }
  | { requestKey: string; status: 'error'; failure: StoryLoadFailure };

/**
 * 범용 story-id 플레이어 라우트("/stories/:storyId/play"). 보호자 홈 히어로·이어서 읽기, 이야기 상세,
 * 리포트 "다시 읽기"에서 들어온다(경로는 features/story-library의 storyPlayPath).
 * App.tsx의 DemoStoryRoute(무료 익명 데모)와는 의도적으로 분리해 둔다 - 데모 경로의 동작을
 * 건드리지 않기 위해서다.
 */
export function StoryPlayerRoute() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // 선생님이 자신이 등록한 학생과 진행하는 세션일 때만 붙는다 - 완주 시 그대로 기록된다.
  const tutorStudentId = searchParams.get('tutorStudentId') ?? undefined;
  // 수업 상세의 "시작"에서 왔으면 수업 id도 함께 - 완주 시 참여 학생 전원의 기록이 이 수업에 연결된다.
  const lessonId = searchParams.get('lessonId') ?? undefined;
  // 반 수업 화면 녹화는 선생님이 수업을 시작할 때 고른 값(rec=1)만 따른다 - 이 수업에만, 기기 결정으로 남기지 않는다.
  // 고르지 않았으면 이 수업은 녹화하지 않는다(선생님 기기의 다른 결정과 상관없이).
  const recordLesson = lessonId ? searchParams.get('rec') === '1' : null;
  useEffect(() => {
    if (recordLesson === null) return;
    const consent = recordingConsentStore();
    consent.setLessonOverride(recordLesson);
    return () => consent.setLessonOverride(null);
  }, [recordLesson]);
  // 홈 히어로·이어서 읽기·상세·리포트 "다시 읽기"가 이 재생을 기록할 아이를 싣는다. 플레이어는 전역 선택
  // 아이로 이름을 부르고 완주를 저장하므로, 띄우기 전에 전역 선택을 이 아이로 맞춘다.
  const requestedChildId = searchParams.get('childId');
  // resume=1은 "이어서 읽기", childId만 있으면 홈에서 아이를 골라 시작 - 플레이어가 시작 화면을 건너뛴다.
  const entry = searchParams.get('resume') === '1' ? 'resume' : requestedChildId ? 'start' : undefined;
  // Q-40 UT - 회차를 시작한 곳(리포트 다시 읽기·서재는 from=)과 수업 진행 형태(setting=, 선생님이 시작할 때 고름).
  const utContext = useMemo(
    () => ({
      entrySource: playEntrySource({ from: searchParams.get('from'), entry, lessonId }),
      playSetting: lessonId ? (parsePlaySetting(searchParams.get('setting')) ?? 'WHOLE_CLASS') : ('HOME' as const),
    }),
    [entry, lessonId, searchParams],
  );
  const { load: childrenLoad, children, selectedChild, selectChild } = useChildren();
  const childSync = playerChildSync({
    requestedChildId,
    // 로그인 확인 중에도 기다린다 - 확인 전에 플레이어가 먼저 마운트되면 아이 이름 없이 뜬다.
    isParent: authState.status === 'loading' || (authState.status === 'authenticated' && authState.user.role === 'PARENT'),
    childrenLoading: childrenLoad.status === 'loading',
    childIds: children.map((child) => child.id),
    selectedChildId: selectedChild?.id ?? null,
  });
  const childToSelect = childSync.kind === 'select' ? childSync.childId : null;
  useEffect(() => {
    if (childToSelect) selectChild(childToSelect);
  }, [childToSelect, selectChild]);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${storyId ?? ''}:${attempt}`;
  const [state, setState] = useState<LoadState>({ requestKey, status: 'loading' });

  const authReady = authState.status !== 'loading';
  useEffect(() => {
    if (!storyId || !authReady) return;
    let cancelled = false;
    loadStoryPackage(storyId)
      .then((storyPackage) => {
        if (!cancelled) setState({ requestKey, status: 'ready', storyPackage });
      })
      .catch((error: unknown) => {
        // 이용권 없음(402)·미등록 같은 서버 이유는 그대로 보여 준다 - 모두 "인터넷 연결"로 안내하면 원인이 가려진다.
        if (!cancelled) setState({ requestKey, status: 'error', failure: describeStoryLoadFailure(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [storyId, requestKey, authReady]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // 마지막으로 커밋된 로드 이후 storyId/attempt가 바뀌었다 - setState-in-effect 없이
  // 로딩 중인 것처럼 렌더링한다 (react-hooks/set-state-in-effect 참고).
  const effectiveState: LoadState = state.requestKey === requestKey ? state : { requestKey, status: 'loading' };

  if (effectiveState.status === 'ready' && childSync.kind === 'ready') {
    return <OneStoryPage storyPackage={effectiveState.storyPackage} tutorStudentId={tutorStudentId} lessonId={lessonId} entry={entry} utContext={utContext} />;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <BrandLockup size="compact" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {effectiveState.status === 'error' ? '이야기를 불러오지 못했어요' : '이야기를 준비하는 중이에요'}
        </Text>
        <Text style={styles.body}>
          {effectiveState.status === 'error' ? effectiveState.failure.message : '잠시만 기다려 주세요…'}
        </Text>
        {effectiveState.status === 'error' && effectiveState.failure.code === 'ENTITLEMENT_REQUIRED' && (() => {
          const next = entitlementNextStep(authState, location.pathname + location.search);
          return next ? <ActionButton variant="primary" label={next.label} onPress={() => navigate(next.path)} /> : null;
        })()}
        {effectiveState.status === 'error' && effectiveState.failure.retryable && <ActionButton variant="primary" label="다시 시도" onPress={retry} />}
        {/* 로딩 중에도 항상 접근 가능해야 한다 - 멈춰버린 fetch가 사용자를 이 화면에 가둬서는 안 된다. */}
        <ActionButton variant="secondary" label="처음으로 돌아가기" onPress={() => navigate(homePathForAuth(authState))} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: '600',
    color: storybookTheme.color.onContent,
    textAlign: 'center',
  },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted, textAlign: 'center' },
});

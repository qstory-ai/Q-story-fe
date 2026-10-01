import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { OneStoryPage } from '@/pages/one-story';
import { loadStoryPackage, type StoryRuntimePackage } from '@/entities/story';
import { homePathForAuth, useAuth } from '@/entities/auth';
import { ActionButton, BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; storyPackage: StoryRuntimePackage }
  | { requestKey: string; status: 'error' };

/**
 * 이야기 상세 페이지에서 도달하는 범용 story-id 플레이어 라우트("/stories/:storyId/play").
 * App.tsx의 DemoStoryRoute(무료 익명 데모)와는 의도적으로 분리해 둔다 - 데모 경로의 동작을
 * 건드리지 않기 위해서다.
 */
export function StoryPlayerRoute() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { state: authState } = useAuth();
  const [searchParams] = useSearchParams();
  // 선생님이 자신이 등록한 학생과 진행하는 세션일 때만 붙는다 - 완주 시 그대로 기록된다.
  const tutorStudentId = searchParams.get('tutorStudentId') ?? undefined;
  // 수업 상세의 "시작"에서 왔으면 수업 id도 함께 - 완주 시 참여 학생 전원의 기록이 이 수업에 연결된다.
  const lessonId = searchParams.get('lessonId') ?? undefined;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${storyId ?? ''}:${attempt}`;
  const [state, setState] = useState<LoadState>({ requestKey, status: 'loading' });

  useEffect(() => {
    if (!storyId) return;
    let cancelled = false;
    loadStoryPackage(storyId)
      .then((storyPackage) => {
        if (!cancelled) setState({ requestKey, status: 'ready', storyPackage });
      })
      .catch(() => {
        if (!cancelled) setState({ requestKey, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [storyId, requestKey]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  // 마지막으로 커밋된 로드 이후 storyId/attempt가 바뀌었다 - setState-in-effect 없이
  // 로딩 중인 것처럼 렌더링한다 (react-hooks/set-state-in-effect 참고).
  const effectiveState: LoadState = state.requestKey === requestKey ? state : { requestKey, status: 'loading' };

  if (effectiveState.status === 'ready') {
    return <OneStoryPage storyPackage={effectiveState.storyPackage} tutorStudentId={tutorStudentId} lessonId={lessonId} />;
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
          {effectiveState.status === 'error' ? '인터넷 연결을 확인한 뒤 다시 시도해 주세요.' : '잠시만 기다려 주세요…'}
        </Text>
        {effectiveState.status === 'error' && <ActionButton variant="primary" label="다시 시도" onPress={retry} />}
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

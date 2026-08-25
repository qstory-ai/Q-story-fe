import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { OneStoryPage } from '@/pages/one-story';
import { loadStoryPackage, type StoryRuntimePackage } from '@/entities/story';
import { ActionButton, BrandLockup, SafeAreaView, storybookTheme } from '@/shared/ui';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; storyPackage: StoryRuntimePackage }
  | { requestKey: string; status: 'error' };

/**
 * 이야기 상세 페이지("/stories/:storyId/play")에서 도달하는 범용 story-id 플레이어 라우트.
 * App.tsx의 DemoStoryRoute와 공유/파라미터화된 컴포넌트로 합치지 않고 의도적으로 별도
 * 컴포넌트로 뒀다 - 그 라우트는 "/"의 무료 익명 데모용으로 "지금 그대로 정확히 계속 동작해야
 * 한다"고 명시적으로 문서화되어 있고, 이 코드베이스는 이미 공유 추상화보다 라우트별 작은
 * 컴포넌트를 선호한다(ParentHomePage/ClassDashboardPage의 거의 동일하지만 분리된 가드
 * 블록 참고).
 */
export function StoryPlayerRoute() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
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
    return <OneStoryPage storyPackage={effectiveState.storyPackage} />;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <BrandLockup size="compact" />
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>
          {effectiveState.status === 'error' ? '이야기를 불러오지 못했어요' : '이야기를 준비하는 중이에요'}
        </Text>
        <Text style={styles.body}>
          {effectiveState.status === 'error' ? '인터넷 연결을 확인한 뒤 다시 시도해 주세요.' : '잠시만 기다려 주세요…'}
        </Text>
        {effectiveState.status === 'error' && <ActionButton variant="primary" label="다시 시도" onPress={retry} />}
        {/* 로딩 중에도 항상 접근 가능해야 한다 - 멈춰버린 fetch가 사용자를 이 화면에 가둬서는 안 된다. */}
        <ActionButton variant="secondary" label="서재로 돌아가기" onPress={() => navigate('/home')} />
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
    fontWeight: '600',
    color: storybookTheme.color.onDark,
    textAlign: 'center',
  },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onDarkMuted, textAlign: 'center' },
});

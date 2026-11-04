import { Suspense, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LaunchNotificationGate } from '@/features/launch-notification-gate';
import {
  describeStoryLoadFailure,
  getDefaultBetaStory,
  type StoryLoadFailure,
  type StoryRuntimePackage,
} from '@/entities/story';
import { isDevBuild } from '@/shared/config';
import { ActionButton, LoadingState, SafeAreaView, storybookTheme } from '@/shared/ui';

import { OneStoryPage } from './OneStoryPage';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; storyPackage: StoryRuntimePackage }
  | { status: 'error'; failure: StoryLoadFailure };

/** 데모는 늘 가정 회차 - UT에서 데모로 시작한 회차를 따로 본다(Q-40). */
const DEMO_UT_CONTEXT = { entrySource: 'demo', playSetting: 'HOME' } as const;

/** 계정 없이 여는 무료 데모 - "/demo". 기본 동화를 불러와 플레이어를 띄운다. */
export function DemoStoryRoute() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDefaultBetaStory()
      .then((storyPackage) => {
        if (!cancelled) setState({ status: 'ready', storyPackage });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', failure: describeStoryLoadFailure(error) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }, []);

  if (state.status === 'ready') {
    return (
      <LaunchNotificationGate>
        <Suspense
          fallback={
            <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container} accessibilityLiveRegion="polite">
              <LoadingState label="화면을 준비하고 있어요." />
            </SafeAreaView>
          }
        >
          <OneStoryPage storyPackage={state.storyPackage} utContext={DEMO_UT_CONTEXT} />
        </Suspense>
      </LaunchNotificationGate>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          {state.status === 'error'
            ? '이야기를 불러오지 못했어요'
            : '이야기를 준비하는 중이에요'}
        </Text>
        <Text style={styles.body}>
          {state.status === 'error' ? state.failure.message : '잠시만 기다려 주세요…'}
        </Text>
        {/* 실패 코드는 아이가 아니라 디버깅하는 사람용 - 개발 빌드에서만. */}
        {state.status === 'error' && state.failure.code && isDevBuild() && (
          <Text style={styles.debugCode}>{state.failure.code}</Text>
        )}
        {/* 다시 시도할 수 없는 실패여도 보여준다 - 이 화면에는 다른 출구가 없어서, 같은 말을 또 하는 버튼이 버튼 없이 막히는 것보다 낫다. */}
        {state.status === 'error' && (
          <ActionButton variant="primary" label="다시 시도" onPress={retry} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  title: { fontSize: storybookTheme.type.md, fontWeight: '900', color: storybookTheme.color.onContent, textAlign: 'center' },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted, textAlign: 'center' },
  debugCode: { fontSize: storybookTheme.type.xxs, color: storybookTheme.color.onContentMuted, textAlign: 'center' },
});

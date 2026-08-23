import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { OneStoryPage } from '@/pages/one-story';
import { LoginPage } from '@/pages/login';
import { DirectorSignupPage } from '@/pages/director-signup';
import { JoinClassPage } from '@/pages/join-class';
import { ClassDashboardPage } from '@/pages/class-dashboard';
import { ParentHomePage } from '@/pages/parent-home';
import { getDefaultBetaStory, type StoryRuntimePackage } from '@/entities/story';
import { AuthProvider } from '@/entities/auth';
import { ActionButton, SafeAreaView } from '@/shared/ui';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; storyPackage: StoryRuntimePackage }
  | { status: 'error' };

/** Unchanged from before the auth routes existed - the free anonymous demo at "/" must keep working exactly as-is. */
function DemoStoryRoute() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDefaultBetaStory()
      .then((storyPackage) => {
        if (!cancelled) setState({ status: 'ready', storyPackage });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
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
    return <OneStoryPage storyPackage={state.storyPackage} />;
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          {state.status === 'error'
            ? '이야기를 불러오지 못했어요'
            : '이야기를 준비하는 중이에요'}
        </Text>
        <Text style={styles.body}>
          {state.status === 'error'
            ? '인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
            : '잠시만 기다려 주세요…'}
        </Text>
        {state.status === 'error' && (
          <ActionButton variant="primary" label="다시 시도" onPress={retry} />
        )}
      </View>
    </SafeAreaView>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<DemoStoryRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/director" element={<DirectorSignupPage />} />
          <Route path="/join" element={<JoinClassPage />} />
          <Route path="/class" element={<ClassDashboardPage />} />
          <Route path="/parent" element={<ParentHomePage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F1FB' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  title: { fontSize: 18, fontWeight: '900', color: '#43225F', textAlign: 'center' },
  body: { fontSize: 14, color: '#6B5478', textAlign: 'center' },
});

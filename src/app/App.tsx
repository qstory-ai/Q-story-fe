import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { OneStoryPage } from '@/pages/one-story';
import { LaunchNotificationGate } from '@/features/launch-notification-gate';
import { LoginPage } from '@/pages/login';
import { SignupPage } from '@/pages/signup';
import { OrganizationSignupPage } from '@/pages/organization-signup';
import { ClassDashboardPage } from '@/pages/class-dashboard';
import { ParentHomePage } from '@/pages/parent-home';
import { HomePage } from '@/pages/home';
import { MyPage } from '@/pages/mypage';
import { NotFoundPage } from '@/pages/not-found';
import { ResetPasswordPage } from '@/pages/reset-password';
import { ReportHistoryPage, ReportHistoryDetailPage } from '@/pages/report-history';
import { StaffHomePage, StaffStoryPage, StaffScenePage } from '@/pages/staff';
import { LandingPage } from '@/pages/landing';
import { StoryDetailPage } from '@/pages/story-detail';
import { StoryPlayerRoute } from '@/pages/story-player';
import { getDefaultBetaStory, type StoryRuntimePackage } from '@/entities/story';
import { AuthProvider } from '@/entities/auth';
import { ActionButton, SafeAreaView } from '@/shared/ui';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; storyPackage: StoryRuntimePackage }
  | { status: 'error' };

/**
 * 무료 익명 데모 - 루트("/")를 제대로 된 랜딩 페이지로 쓸 수 있도록 "/demo"로 옮겼지만
 * (LandingPage 참고), 그 자체의 동작은 그대로다: 여전히 익명이고, 여전히 항상
 * 기본 베타 스토리 하나를 로드하며, 인증/역할 검증(gating)은 없다.
 */
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
    return (
      <LaunchNotificationGate>
        <OneStoryPage storyPackage={state.storyPackage} />
      </LaunchNotificationGate>
    );
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
          <Route path="/" element={<LandingPage />} />
          <Route path="/demo" element={<DemoStoryRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/organization" element={<OrganizationSignupPage />} />
          <Route path="/class" element={<ClassDashboardPage />} />
          <Route path="/parent" element={<ParentHomePage />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/reports" element={<ReportHistoryPage />} />
          <Route path="/reports/:completionId" element={<ReportHistoryDetailPage />} />
          <Route path="/staff" element={<StaffHomePage />} />
          <Route path="/staff/:storyId" element={<StaffStoryPage />} />
          <Route path="/staff/:storyId/scenes/:sceneId" element={<StaffScenePage />} />
          <Route path="/stories/:storyId" element={<StoryDetailPage />} />
          <Route path="/stories/:storyId/play" element={<StoryPlayerRoute />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F1FB' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  title: { fontSize: 18, fontWeight: '700', color: '#43225F', textAlign: 'center' },
  body: { fontSize: 14, color: '#6B5478', textAlign: 'center' },
});

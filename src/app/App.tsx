import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { HomePage } from '@/pages/home';
import { OneStoryPage } from '@/pages/one-story';
import { LaunchNotificationGate } from '@/features/launch-notification-gate';
import { LoginPage } from '@/pages/login';
import { JoinClassPage } from '@/pages/join-class';
import { SignupPage } from '@/pages/signup';
import { OrganizationSignupPage } from '@/pages/organization-signup';
import { ClassDashboardPage } from '@/pages/class-dashboard';
import { ParentHomePage } from '@/pages/parent-home';
import { MyPage } from '@/pages/mypage';
import { MyPageProfilePage } from '@/pages/mypage-profile';
import { MyPageAccountPage } from '@/pages/mypage-account';
import { MyPageSubscriptionPage } from '@/pages/mypage-subscription';
import { MyPageDeleteAccountPage } from '@/pages/mypage-delete-account';
import { NotFoundPage } from '@/pages/not-found';
import { ResetPasswordPage } from '@/pages/reset-password';
import { ReportHistoryPage, ReportHistoryDetailPage } from '@/pages/report-history';
import { StaffHomePage, StaffStoryPage, StaffScenePage } from '@/pages/staff';
import { LandingPage } from '@/pages/landing';
import { TutorHomePage } from '@/pages/tutor-home';
import { TutorStudentNewPage, TutorStudentsPage, TutorScheduleListPage } from '@/pages/tutor-student';
import { ParentLinkAcceptPage } from '@/pages/parent-link';
import { StoryDetailPage } from '@/pages/story-detail';
import { StoryPlayerRoute } from '@/pages/story-player';
import {
  describeStoryLoadFailure,
  getDefaultBetaStory,
  type StoryLoadFailure,
  type StoryRuntimePackage,
} from '@/entities/story';
import { AuthProvider } from '@/entities/auth';
import { SyncDemoCompletionOnAuth } from '@/features/sync-demo-completion';
import { ActionButton, SafeAreaView, storybookTheme } from '@/shared/ui';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; storyPackage: StoryRuntimePackage }
  | { status: 'error'; failure: StoryLoadFailure };

/** Unchanged from before the auth routes existed - the free anonymous demo must keep working
 * exactly as-is. It moved off "/" to "/demo" when the home page took the root, so anyone holding an
 * old "/" link now lands one tap away from it rather than inside it. */
function DemoStoryRoute() {
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
        <OneStoryPage storyPackage={state.storyPackage} />
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
        {/* The failure code is for whoever is debugging, not for a child - dev builds only. */}
        {state.status === 'error' && state.failure.code && import.meta.env?.DEV && (
          <Text style={styles.debugCode}>{state.failure.code}</Text>
        )}
        {/* Shown even when the failure is not retryable: this screen has no other way out, so
            stranding the child with no button is worse than a retry that reports the same thing
            again. */}
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
      <SyncDemoCompletionOnAuth />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/demo" element={<DemoStoryRoute />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/join" element={<JoinClassPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/organization" element={<OrganizationSignupPage />} />
          <Route path="/class" element={<ClassDashboardPage />} />
          <Route path="/parent" element={<ParentHomePage />} />
          <Route path="/tutor" element={<TutorHomePage />} />
          <Route path="/tutor/students/new" element={<TutorStudentNewPage />} />
          <Route path="/tutor/students" element={<TutorStudentsPage />} />
          <Route path="/tutor/schedule" element={<TutorScheduleListPage />} />
          <Route path="/tutor-invite/:token" element={<ParentLinkAcceptPage />} />
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/mypage/profile" element={<MyPageProfilePage />} />
          <Route path="/mypage/account" element={<MyPageAccountPage />} />
          <Route path="/mypage/subscription" element={<MyPageSubscriptionPage />} />
          <Route path="/mypage/delete-account" element={<MyPageDeleteAccountPage />} />
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
  title: { fontSize: storybookTheme.type.md, fontWeight: '900', color: '#43225F', textAlign: 'center' },
  body: { fontSize: storybookTheme.type.sm, color: '#6B5478', textAlign: 'center' },
  debugCode: { fontSize: storybookTheme.type.xxs, color: '#9C8AA5', textAlign: 'center' },
});

import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { LaunchNotificationGate } from '@/features/launch-notification-gate';
import {
  describeStoryLoadFailure,
  getDefaultBetaStory,
  type StoryLoadFailure,
  type StoryRuntimePackage,
} from '@/entities/story';
import { AuthProvider } from '@/entities/auth';
import { BookmarksProvider } from '@/entities/bookmark';
import { ChildrenProvider } from '@/entities/child';
import { SyncDemoCompletionOnAuth } from '@/features/sync-demo-completion';
import { ActionButton, SafeAreaView, storybookTheme } from '@/shared/ui';

const HomePage = lazy(() => import('@/pages/home').then((m) => ({ default: m.HomePage })));
const OneStoryPage = lazy(() => import('@/pages/one-story').then((m) => ({ default: m.OneStoryPage })));
const LoginPage = lazy(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })));
const JoinClassPage = lazy(() => import('@/pages/join-class').then((m) => ({ default: m.JoinClassPage })));
const SignupPage = lazy(() => import('@/pages/signup').then((m) => ({ default: m.SignupPage })));
const OrganizationSignupPage = lazy(() =>
  import('@/pages/organization-signup').then((m) => ({ default: m.OrganizationSignupPage })),
);
const ClassDashboardPage = lazy(() =>
  import('@/pages/class-dashboard').then((m) => ({ default: m.ClassDashboardPage })),
);
const ParentHomePage = lazy(() => import('@/pages/parent-home').then((m) => ({ default: m.ParentHomePage })));
const MyPage = lazy(() => import('@/pages/mypage').then((m) => ({ default: m.MyPage })));
const MyPageProfilePage = lazy(() =>
  import('@/pages/mypage-profile').then((m) => ({ default: m.MyPageProfilePage })),
);
const MyPageAccountPage = lazy(() =>
  import('@/pages/mypage-account').then((m) => ({ default: m.MyPageAccountPage })),
);
const MyPageSubscriptionPage = lazy(() =>
  import('@/pages/mypage-subscription').then((m) => ({ default: m.MyPageSubscriptionPage })),
);
const MyPageDeleteAccountPage = lazy(() =>
  import('@/pages/mypage-delete-account').then((m) => ({ default: m.MyPageDeleteAccountPage })),
);
const MyPageChildrenPage = lazy(() =>
  import('@/pages/mypage-children').then((m) => ({ default: m.MyPageChildrenPage })),
);
const MyPageClassesPage = lazy(() =>
  import('@/pages/mypage-classes').then((m) => ({ default: m.MyPageClassesPage })),
);
const MyPageNotificationsPage = lazy(() =>
  import('@/pages/mypage-notifications').then((m) => ({ default: m.MyPageNotificationsPage })),
);
const MyPagePrivacyPage = lazy(() =>
  import('@/pages/mypage-privacy').then((m) => ({ default: m.MyPagePrivacyPage })),
);
const MyPageSupportPage = lazy(() =>
  import('@/pages/mypage-support').then((m) => ({ default: m.MyPageSupportPage })),
);
const NotFoundPage = lazy(() => import('@/pages/not-found').then((m) => ({ default: m.NotFoundPage })));
const ResetPasswordPage = lazy(() =>
  import('@/pages/reset-password').then((m) => ({ default: m.ResetPasswordPage })),
);
const ReportHistoryPage = lazy(() =>
  import('@/pages/report-history').then((m) => ({ default: m.ReportHistoryPage })),
);
const ReportHistoryDetailPage = lazy(() =>
  import('@/pages/report-history').then((m) => ({ default: m.ReportHistoryDetailPage })),
);
const StaffHomePage = lazy(() => import('@/pages/staff').then((m) => ({ default: m.StaffHomePage })));
const StaffStoryPage = lazy(() => import('@/pages/staff').then((m) => ({ default: m.StaffStoryPage })));
const StaffScenePage = lazy(() => import('@/pages/staff').then((m) => ({ default: m.StaffScenePage })));
const LandingPage = lazy(() => import('@/pages/landing').then((m) => ({ default: m.LandingPage })));
const TutorHomePage = lazy(() => import('@/pages/tutor-home').then((m) => ({ default: m.TutorHomePage })));
const TutorStudentNewPage = lazy(() =>
  import('@/pages/tutor-student').then((m) => ({ default: m.TutorStudentNewPage })),
);
const TutorStudentsPage = lazy(() =>
  import('@/pages/tutor-student').then((m) => ({ default: m.TutorStudentsPage })),
);
const TutorScheduleListPage = lazy(() =>
  import('@/pages/tutor-student').then((m) => ({ default: m.TutorScheduleListPage })),
);
const ParentLinkAcceptPage = lazy(() =>
  import('@/pages/parent-link').then((m) => ({ default: m.ParentLinkAcceptPage })),
);
const StoryDetailPage = lazy(() => import('@/pages/story-detail').then((m) => ({ default: m.StoryDetailPage })));
const LibraryPage = lazy(() => import('@/pages/library').then((m) => ({ default: m.LibraryPage })));
const TutorLibraryPage = lazy(() => import('@/pages/tutor-library').then((m) => ({ default: m.TutorLibraryPage })));
const TutorClassesPage = lazy(() => import('@/pages/tutor-classes').then((m) => ({ default: m.TutorClassesPage })));
const TutorReportsPage = lazy(() => import('@/pages/tutor-reports').then((m) => ({ default: m.TutorReportsPage })));
const OrganizationTutorsPage = lazy(() =>
  import('@/pages/organization-tutors').then((m) => ({ default: m.OrganizationTutorsPage })),
);
const OrgInviteAcceptPage = lazy(() =>
  import('@/pages/org-invite-accept').then((m) => ({ default: m.OrgInviteAcceptPage })),
);
const TutorJoinOrganizationPage = lazy(() =>
  import('@/pages/tutor-join-organization').then((m) => ({ default: m.TutorJoinOrganizationPage })),
);
const StoryPlayerRoute = lazy(() =>
  import('@/pages/story-player').then((m) => ({ default: m.StoryPlayerRoute })),
);

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
        <Suspense fallback={<View style={styles.container} />}>
          <OneStoryPage storyPackage={state.storyPackage} />
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
      <ChildrenProvider>
        <BookmarksProvider>
          <SyncDemoCompletionOnAuth />
          <BrowserRouter>
        <Suspense fallback={<View style={styles.container} />}>
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
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/tutor" element={<TutorHomePage />} />
            <Route path="/tutor/library" element={<TutorLibraryPage />} />
            <Route path="/tutor/classes" element={<TutorClassesPage />} />
            <Route path="/tutor/reports" element={<TutorReportsPage />} />
            <Route path="/tutor/join-organization" element={<TutorJoinOrganizationPage />} />
            <Route path="/organization/tutors" element={<OrganizationTutorsPage />} />
            <Route path="/org-invite/:token" element={<OrgInviteAcceptPage />} />
            <Route path="/org-invite/code/:code" element={<OrgInviteAcceptPage />} />
            <Route path="/tutor/students/new" element={<TutorStudentNewPage />} />
            <Route path="/tutor/students" element={<TutorStudentsPage />} />
            <Route path="/tutor/schedule" element={<TutorScheduleListPage />} />
            <Route path="/tutor-invite/:token" element={<ParentLinkAcceptPage />} />
            <Route path="/tutor-invite/code/:code" element={<ParentLinkAcceptPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/mypage/profile" element={<MyPageProfilePage />} />
            <Route path="/mypage/account" element={<MyPageAccountPage />} />
            <Route path="/mypage/subscription" element={<MyPageSubscriptionPage />} />
            <Route path="/mypage/delete-account" element={<MyPageDeleteAccountPage />} />
            <Route path="/mypage/children" element={<MyPageChildrenPage />} />
            <Route path="/mypage/classes" element={<MyPageClassesPage />} />
            <Route path="/mypage/notifications" element={<MyPageNotificationsPage />} />
            <Route path="/mypage/privacy" element={<MyPagePrivacyPage />} />
            <Route path="/mypage/support" element={<MyPageSupportPage />} />
            <Route path="/reports" element={<ReportHistoryPage />} />
            <Route path="/reports/:completionId" element={<ReportHistoryDetailPage />} />
            <Route path="/staff" element={<StaffHomePage />} />
            <Route path="/staff/:storyId" element={<StaffStoryPage />} />
            <Route path="/staff/:storyId/scenes/:sceneId" element={<StaffScenePage />} />
            <Route path="/stories/:storyId" element={<StoryDetailPage />} />
            <Route path="/stories/:storyId/play" element={<StoryPlayerRoute />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </Suspense>
          </BrowserRouter>
        </BookmarksProvider>
      </ChildrenProvider>
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

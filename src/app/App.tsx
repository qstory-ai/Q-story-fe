import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { trackAppEntryOnce } from '@/entities/analytics';
import { LaunchNotificationGate } from '@/features/launch-notification-gate';
import {
  describeStoryLoadFailure,
  getDefaultBetaStory,
  type StoryLoadFailure,
  type StoryRuntimePackage,
} from '@/entities/story';
import { AuthProvider, legacyRedirectPath } from '@/entities/auth';
import { BookmarksProvider } from '@/entities/bookmark';
import { ChildrenProvider } from '@/entities/child';
import { SyncDemoCompletionOnAuth } from '@/features/sync-demo-completion';
import { ActionButton, LoadingState, SafeAreaView, storybookTheme } from '@/shared/ui';

import { LEGACY_REDIRECTS } from './legacy-redirects';
import { UsageTracking } from './usage-tracking';

const HomePage = lazy(() => import('@/pages/home').then((m) => ({ default: m.HomePage })));
const TutorialPage = lazy(() => import('@/pages/tutorial').then((m) => ({ default: m.TutorialPage })));
const OnboardingParentPage = lazy(() =>
  import('@/pages/onboarding-parent').then((m) => ({ default: m.OnboardingParentPage })),
);
const OnboardingTutorPage = lazy(() =>
  import('@/pages/onboarding-tutor').then((m) => ({ default: m.OnboardingTutorPage })),
);
const OneStoryPage = lazy(() => import('@/pages/one-story').then((m) => ({ default: m.OneStoryPage })));
const LoginPage = lazy(() => import('@/pages/login').then((m) => ({ default: m.LoginPage })));
const ClassDetailPage = lazy(() => import('@/pages/class-detail').then((m) => ({ default: m.ClassDetailPage })));
const TutorClassGroupNewPage = lazy(() => import('@/pages/tutor-class-group').then((m) => ({ default: m.TutorClassGroupNewPage })));
const JoinClassPage = lazy(() => import('@/pages/join-class').then((m) => ({ default: m.JoinClassPage })));
const SignupPage = lazy(() => import('@/pages/signup').then((m) => ({ default: m.SignupPage })));
const OrganizationSignupPage = lazy(() =>
  import('@/pages/organization-signup').then((m) => ({ default: m.OrganizationSignupPage })),
);
const ParentHomePage = lazy(() => import('@/pages/parent-home').then((m) => ({ default: m.ParentHomePage })));
const MyPage = lazy(() => import('@/pages/mypage').then((m) => ({ default: m.MyPage })));
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
const MyPageSettingsPage = lazy(() =>
  import('@/pages/mypage-settings').then((m) => ({ default: m.MyPageSettingsPage })),
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
const TutorStudentsPage = lazy(() =>
  import('@/pages/tutor-student').then((m) => ({ default: m.TutorStudentsPage })),
);
const StoryDetailPage = lazy(() => import('@/pages/story-detail').then((m) => ({ default: m.StoryDetailPage })));
const LibraryPage = lazy(() => import('@/pages/library').then((m) => ({ default: m.LibraryPage })));
const TutorLibraryPage = lazy(() => import('@/pages/tutor-library').then((m) => ({ default: m.TutorLibraryPage })));
const TutorLessonsPage = lazy(() => import('@/pages/tutor-lessons').then((m) => ({ default: m.TutorLessonsPage })));
const TutorReportsPage = lazy(() => import('@/pages/tutor-reports').then((m) => ({ default: m.TutorReportsPage })));
const OrganizationTutorsPage = lazy(() =>
  import('@/pages/organization-tutors').then((m) => ({ default: m.OrganizationTutorsPage })),
);
const OrganizationTutorDetailPage = lazy(() =>
  import('@/pages/organization-tutor-detail').then((m) => ({ default: m.OrganizationTutorDetailPage })),
);
const OrganizationClassesPage = lazy(() =>
  import('@/pages/organization-classes').then((m) => ({ default: m.OrganizationClassesPage })),
);
const OrganizationStudentDetailPage = lazy(() =>
  import('@/pages/organization-student-detail').then((m) => ({ default: m.OrganizationStudentDetailPage })),
);
const OrganizationReportPage = lazy(() =>
  import('@/pages/organization-report').then((m) => ({ default: m.OrganizationReportPage })),
);
const OrganizationSubscriptionPage = lazy(() =>
  import('@/pages/organization-subscription').then((m) => ({ default: m.OrganizationSubscriptionPage })),
);
const OrgInviteAcceptPage = lazy(() =>
  import('@/pages/org-invite-accept').then((m) => ({ default: m.OrgInviteAcceptPage })),
);
const TutorJoinOrganizationPage = lazy(() =>
  import('@/pages/tutor-join-organization').then((m) => ({ default: m.TutorJoinOrganizationPage })),
);
const TutorLessonDetailPage = lazy(() =>
  import('@/pages/tutor-lesson-detail').then((m) => ({ default: m.TutorLessonDetailPage })),
);
const TutorStudentDetailPage = lazy(() =>
  import('@/pages/tutor-student-detail').then((m) => ({ default: m.TutorStudentDetailPage })),
);
const StoryPlayerRoute = lazy(() =>
  import('@/pages/story-player').then((m) => ({ default: m.StoryPlayerRoute })),
);
const PaymentCheckoutPage = lazy(() =>
  import('@/pages/payment-checkout').then((m) => ({ default: m.PaymentCheckoutPage })),
);
const PaymentSuccessPage = lazy(() =>
  import('@/pages/payment-success').then((m) => ({ default: m.PaymentSuccessPage })),
);
// 팀 내부 화면 녹화 다시 보기 - 메뉴에 걸지 않는다. rrweb 플레이어는 이 화면에서만 불러온다.
const InternalReplayPage = lazy(() =>
  import('@/pages/internal-replay').then((m) => ({ default: m.InternalReplayPage })),
);
const PaymentFailPage = lazy(() =>
  import('@/pages/payment-fail').then((m) => ({ default: m.PaymentFailPage })),
);

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; storyPackage: StoryRuntimePackage }
  | { status: 'error'; failure: StoryLoadFailure };

function RouteLoadingFallback() {
  return (
    <SafeAreaView
      edges={['top', 'left', 'right', 'bottom']}
      style={styles.container}
      accessibilityLiveRegion="polite"
    >
      <LoadingState label="화면을 준비하고 있어요." />
    </SafeAreaView>
  );
}

/**
 * 예전 경로(북마크·알림 링크)를 새 경로로 옮긴다(Q-35) - 쿼리와 해시는 그대로 둔다. 대상 표는 legacyRedirectPath.
 */
function LegacyRedirect() {
  const location = useLocation();
  return (
    <Navigate
      replace
      to={{ pathname: legacyRedirectPath(location.pathname) ?? '/', search: location.search, hash: location.hash }}
    />
  );
}

/** 데모는 늘 가정 회차 - UT에서 데모로 시작한 회차를 따로 본다(Q-40). */
const DEMO_UT_CONTEXT = { entrySource: 'demo', playSetting: 'HOME' } as const;

/** The free anonymous demo (no account needed) lives at "/demo". */
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
        <Suspense fallback={<RouteLoadingFallback />}>
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
  // 앱을 연 경로(초대 링크·반 링크·알림·직접)를 탭당 한 번 남긴다(Q-40 UT).
  useEffect(() => {
    trackAppEntryOnce();
  }, []);

  return (
    <AuthProvider>
      <ChildrenProvider>
        <BookmarksProvider>
          <SyncDemoCompletionOnAuth />
          <BrowserRouter>
          <UsageTracking />
        <Suspense fallback={<RouteLoadingFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/onboarding/parent" element={<OnboardingParentPage />} />
            <Route path="/onboarding/tutor" element={<OnboardingTutorPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/demo" element={<DemoStoryRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/join" element={<JoinClassPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/organization" element={<OrganizationSignupPage />} />
            <Route path="/parent" element={<ParentHomePage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/tutor" element={<TutorHomePage />} />
            <Route path="/tutor/library" element={<TutorLibraryPage />} />
            <Route path="/tutor/classes" element={<TutorStudentsPage />} />
            <Route path="/tutor/classes/new" element={<TutorClassGroupNewPage />} />
            <Route path="/tutor/classes/:classId" element={<ClassDetailPage />} />
            <Route path="/tutor/lessons" element={<TutorLessonsPage />} />
            <Route path="/tutor/class-groups" element={<LegacyRedirect />} />
            <Route path="/tutor/class-groups/new" element={<LegacyRedirect />} />
            <Route path="/tutor/class-groups/:classId" element={<LegacyRedirect />} />
            <Route path="/tutor/reports" element={<TutorReportsPage />} />
            <Route path="/tutor/join-organization" element={<TutorJoinOrganizationPage />} />
            <Route path="/organization/tutors" element={<OrganizationTutorsPage />} />
            <Route path="/organization/tutors/:tutorId" element={<OrganizationTutorDetailPage />} />
            <Route path="/organization/classes" element={<OrganizationClassesPage />} />
            <Route path="/organization/classes/:classId" element={<ClassDetailPage />} />
            <Route path="/organization/classes/:classId/students/:studentId" element={<OrganizationStudentDetailPage />} />
            <Route path="/organization/usage" element={<LegacyRedirect />} />
            <Route path="/organization/reports" element={<OrganizationReportPage />} />
            <Route path="/organization/subscription" element={<OrganizationSubscriptionPage />} />
            <Route path="/org-invite/:token" element={<OrgInviteAcceptPage />} />
            <Route path="/org-invite/code/:code" element={<OrgInviteAcceptPage />} />
            <Route path="/tutor/students" element={<LegacyRedirect />} />
            <Route path="/tutor/students/:studentId" element={<TutorStudentDetailPage />} />
            <Route path="/tutor/lessons/:lessonId" element={<TutorLessonDetailPage />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/mypage/account" element={<MyPageAccountPage />} />
            <Route path="/mypage/subscription" element={<MyPageSubscriptionPage />} />
            <Route path="/payment/checkout" element={<PaymentCheckoutPage />} />
            <Route path="/payment/success" element={<PaymentSuccessPage />} />
            <Route path="/payment/fail" element={<PaymentFailPage />} />
            <Route path="/mypage/delete-account" element={<MyPageDeleteAccountPage />} />
            <Route path="/mypage/children" element={<MyPageChildrenPage />} />
            <Route path="/mypage/classes" element={<MyPageClassesPage />} />
            <Route path="/mypage/settings" element={<MyPageSettingsPage />} />
            {LEGACY_REDIRECTS.map(([from, to]) => (
              <Route key={from} path={from} element={<Navigate to={to} replace />} />
            ))}
            <Route path="/mypage/support" element={<MyPageSupportPage />} />
            <Route path="/reports" element={<ReportHistoryPage />} />
            <Route path="/reports/:completionId" element={<ReportHistoryDetailPage />} />
            <Route path="/staff" element={<StaffHomePage />} />
            <Route path="/staff/:storyId" element={<StaffStoryPage />} />
            <Route path="/staff/:storyId/scenes/:sceneId" element={<StaffScenePage />} />
            <Route path="/stories/:storyId" element={<StoryDetailPage />} />
            <Route path="/stories/:storyId/play" element={<StoryPlayerRoute />} />
            <Route path="/internal/replay" element={<InternalReplayPage />} />
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
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  title: { fontSize: storybookTheme.type.md, fontWeight: '900', color: storybookTheme.color.onContent, textAlign: 'center' },
  body: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted, textAlign: 'center' },
  debugCode: { fontSize: storybookTheme.type.xxs, color: storybookTheme.color.onContentSubtle, textAlign: 'center' },
});

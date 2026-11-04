import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { StyleSheet } from 'react-native';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { trackAppEntryOnce } from '@/entities/analytics';
import { AuthProvider } from '@/entities/auth';
import { BookmarksProvider } from '@/entities/bookmark';
import { ChildrenProvider } from '@/entities/child';
import { PushNotificationsBridge } from '@/features/push-notifications';
import { ReconsentGate } from '@/features/reconsent';
import { SyncDemoCompletionOnAuth } from '@/features/sync-demo-completion';
import { LEGACY_ROUTE_PATHS, legacyRedirectPath } from '@/shared/config';
import { LoadingState, SafeAreaView, storybookTheme } from '@/shared/ui';

import { PrefetchPlayScreen } from './prefetch-play-screen';
import { UsageTracking } from './usage-tracking';

/** pages의 named export를 lazy 라우트 컴포넌트로 - 화면마다 같은 then(...)을 적지 않게. */
function page<M, K extends keyof M>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] as unknown as ComponentType })));
}

const HomePage = page(() => import('@/pages/home'), 'HomePage');
const TutorialPage = page(() => import('@/pages/tutorial'), 'TutorialPage');
const OnboardingParentPage = page(() => import('@/pages/onboarding-parent'), 'OnboardingParentPage');
const OnboardingTutorPage = page(() => import('@/pages/onboarding-tutor'), 'OnboardingTutorPage');
const LoginPage = page(() => import('@/pages/login'), 'LoginPage');
const ClassDetailPage = page(() => import('@/pages/class-detail'), 'ClassDetailPage');
const TutorClassGroupNewPage = page(() => import('@/pages/tutor-class-group'), 'TutorClassGroupNewPage');
const JoinClassPage = page(() => import('@/pages/join-class'), 'JoinClassPage');
const SignupPage = page(() => import('@/pages/signup'), 'SignupPage');
const OrganizationSignupPage = page(() => import('@/pages/organization-signup'), 'OrganizationSignupPage');
const ParentHomePage = page(() => import('@/pages/parent-home'), 'ParentHomePage');
const MyPage = page(() => import('@/pages/mypage'), 'MyPage');
const MyPageAccountPage = page(() => import('@/pages/mypage-account'), 'MyPageAccountPage');
const MyPageSubscriptionPage = page(() => import('@/pages/mypage-subscription'), 'MyPageSubscriptionPage');
const MyPageDeleteAccountPage = page(() => import('@/pages/mypage-delete-account'), 'MyPageDeleteAccountPage');
const MyPageChildrenPage = page(() => import('@/pages/mypage-children'), 'MyPageChildrenPage');
const MyPageClassesPage = page(() => import('@/pages/mypage-classes'), 'MyPageClassesPage');
const MyPageSettingsPage = page(() => import('@/pages/mypage-settings'), 'MyPageSettingsPage');
const MyPageSupportPage = page(() => import('@/pages/mypage-support'), 'MyPageSupportPage');
const NotFoundPage = page(() => import('@/pages/not-found'), 'NotFoundPage');
const ResetPasswordPage = page(() => import('@/pages/reset-password'), 'ResetPasswordPage');
const ReportHistoryPage = page(() => import('@/pages/report-history'), 'ReportHistoryPage');
const ReportHistoryDetailPage = page(() => import('@/pages/report-history'), 'ReportHistoryDetailPage');
const StaffHomePage = page(() => import('@/pages/staff'), 'StaffHomePage');
const StaffStoryPage = page(() => import('@/pages/staff'), 'StaffStoryPage');
const StaffScenePage = page(() => import('@/pages/staff'), 'StaffScenePage');
const TutorHomePage = page(() => import('@/pages/tutor-home'), 'TutorHomePage');
const TutorStudentsPage = page(() => import('@/pages/tutor-student'), 'TutorStudentsPage');
const StoryDetailPage = page(() => import('@/pages/story-detail'), 'StoryDetailPage');
const LibraryPage = page(() => import('@/pages/library'), 'LibraryPage');
const TutorLibraryPage = page(() => import('@/pages/tutor-library'), 'TutorLibraryPage');
const TutorLessonsPage = page(() => import('@/pages/tutor-lessons'), 'TutorLessonsPage');
const TutorReportsPage = page(() => import('@/pages/tutor-reports'), 'TutorReportsPage');
const OrganizationTutorsPage = page(() => import('@/pages/organization-tutors'), 'OrganizationTutorsPage');
const OrganizationTutorDetailPage = page(() => import('@/pages/organization-tutor-detail'), 'OrganizationTutorDetailPage');
const OrganizationClassesPage = page(() => import('@/pages/organization-classes'), 'OrganizationClassesPage');
const OrganizationStudentDetailPage = page(() => import('@/pages/organization-student-detail'), 'OrganizationStudentDetailPage');
const ClassTermTransitionPage = page(() => import('@/pages/class-term-transition'), 'ClassTermTransitionPage');
const OrganizationReportPage = page(() => import('@/pages/organization-report'), 'OrganizationReportPage');
const OrganizationSubscriptionPage = page(() => import('@/pages/organization-subscription'), 'OrganizationSubscriptionPage');
const OrgInviteAcceptPage = page(() => import('@/pages/org-invite-accept'), 'OrgInviteAcceptPage');
const HomeroomInvitePage = page(() => import('@/pages/homeroom-invite'), 'HomeroomInvitePage');
const TutorJoinOrganizationPage = page(() => import('@/pages/tutor-join-organization'), 'TutorJoinOrganizationPage');
const TutorLessonDetailPage = page(() => import('@/pages/tutor-lesson-detail'), 'TutorLessonDetailPage');
const TutorStudentDetailPage = page(() => import('@/pages/tutor-student-detail'), 'TutorStudentDetailPage');
const StoryPlayerRoute = page(() => import('@/pages/one-story'), 'StoryPlayerRoute');
const DemoStoryRoute = page(() => import('@/pages/one-story'), 'DemoStoryRoute');
const PaymentCheckoutPage = page(() => import('@/pages/payment-checkout'), 'PaymentCheckoutPage');
const PaymentSuccessPage = page(() => import('@/pages/payment-success'), 'PaymentSuccessPage');
const InternalUiKitPage = page(() => import('@/pages/internal-ui-kit'), 'InternalUiKitPage');
const InternalReplayPage = page(() => import('@/pages/internal-replay'), 'InternalReplayPage');
const PaymentFailPage = page(() => import('@/pages/payment-fail'), 'PaymentFailPage');

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
 * 예전 경로(북마크·알림 링크)를 새 경로로 옮긴다 - 쿼리와 해시는 그대로 둔다. 대상 표는 shared/config legacy-redirects.
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
          <PrefetchPlayScreen />
          <BrowserRouter>
          <UsageTracking />
          <PushNotificationsBridge />
        <Suspense fallback={<RouteLoadingFallback />}>
          {/* 새 필수 동의(약관 2026-10-v2)를 받지 않은 계정은 화면 대신 다시 동의 화면을 먼저 본다. */}
          <ReconsentGate>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/onboarding/parent" element={<OnboardingParentPage />} />
            <Route path="/onboarding/tutor" element={<OnboardingTutorPage />} />
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
            <Route path="/tutor/reports" element={<TutorReportsPage />} />
            <Route path="/tutor/join-organization" element={<TutorJoinOrganizationPage />} />
            <Route path="/organization/tutors" element={<OrganizationTutorsPage />} />
            <Route path="/organization/tutors/:tutorId" element={<OrganizationTutorDetailPage />} />
            <Route path="/organization/classes" element={<OrganizationClassesPage />} />
            <Route path="/organization/classes/:classId" element={<ClassDetailPage />} />
            <Route path="/organization/classes/:classId/students/:studentId" element={<OrganizationStudentDetailPage />} />
            <Route path="/organization/classes/:classId/term" element={<ClassTermTransitionPage />} />
            <Route path="/organization/reports" element={<OrganizationReportPage />} />
            <Route path="/organization/subscription" element={<OrganizationSubscriptionPage />} />
            <Route path="/org-invite/:token" element={<OrgInviteAcceptPage />} />
            <Route path="/org-invite/code/:code" element={<OrgInviteAcceptPage />} />
            <Route path="/homeroom-invite" element={<HomeroomInvitePage />} />
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
            <Route path="/mypage/support" element={<MyPageSupportPage />} />
            <Route path="/reports" element={<ReportHistoryPage />} />
            <Route path="/reports/:completionId" element={<ReportHistoryDetailPage />} />
            <Route path="/staff" element={<StaffHomePage />} />
            <Route path="/staff/:storyId" element={<StaffStoryPage />} />
            <Route path="/staff/:storyId/scenes/:sceneId" element={<StaffScenePage />} />
            <Route path="/stories/:storyId" element={<StoryDetailPage />} />
            <Route path="/stories/:storyId/play" element={<StoryPlayerRoute />} />
            <Route path="/internal/replay" element={<InternalReplayPage />} />
            <Route path="/internal/ui-kit" element={<InternalUiKitPage />} />
            {LEGACY_ROUTE_PATHS.map((path) => (
              <Route key={path} path={path} element={<LegacyRedirect />} />
            ))}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          </ReconsentGate>
          </Suspense>
          </BrowserRouter>
        </BookmarksProvider>
      </ChildrenProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
});

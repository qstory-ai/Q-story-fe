import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, reportsPathFor, useAuth } from '@/entities/auth';
import { useBackOr } from '@/shared/lib';
import { CompletionReport } from './CompletionReport';

/** 지난 "오늘의 질문 기록" 하나를 읽기 전용으로 보여주는 화면. 본문은 CompletionReport가 그린다. */
export function ReportHistoryDetailPage() {
  const { completionId } = useParams<{ completionId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const reportsFallback = state.status === 'authenticated' ? reportsPathFor(state.user) : '/reports';
  const goBack = useBackOr(reportsFallback);

  // TUTOR는 자기가 진행한 세션, DIRECTOR는 자기 기관의 수업 기록(Q-35)을 연다 - 학생 상세·리포트 탭에서 여기로 온다.
  // 누가 어떤 기록을 열 수 있는지는 BE getStoryCompletion이 막으므로, 여기서는 역할 기반 페이지 접근만 허용한다.
  const canView =
    state.status === 'authenticated'
    && (state.user.role === 'PARENT' || state.user.role === 'TUTOR' || state.user.role === 'DIRECTOR');

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  if (!canView || !completionId) return null;

  return (
    <AppNavShell
      items={dashboardNavItems(state.user, navigate, pathname)}
      onBack={goBack}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <CompletionReport token={state.token} completionId={completionId} isParent={state.user.role === 'PARENT'} />
      </ScrollView>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: storybookTheme.layout.wideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: 16,
  },
});

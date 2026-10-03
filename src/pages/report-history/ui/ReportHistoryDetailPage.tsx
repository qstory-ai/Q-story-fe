import { useEffect } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { useBackOr } from '@/shared/lib';
import { CompletionReport } from './CompletionReport';

/** 지난 "오늘의 질문 기록" 하나를 읽기 전용으로 보여주는 화면. 본문은 CompletionReport가 그린다. */
export function ReportHistoryDetailPage() {
  const { completionId } = useParams<{ completionId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const reportsFallback = state.status === 'authenticated' && state.user.role === 'TUTOR' ? '/tutor/reports' : '/reports';
  const goBack = useBackOr(reportsFallback);

  // TUTOR도 자기가 진행한 세션의 상세는 볼 수 있어야 한다 - 선생님 리포트 탭에서 세션을
  // 탭했을 때 여기로 오게 되어 있다. BE의 getStoryCompletion은 이미 완료 기록 소유자가
  // 아닌 사용자를 차단하므로, 여기서는 role 기반 페이지 접근만 허용한다.
  const canView = state.status === 'authenticated' && (state.user.role === 'PARENT' || state.user.role === 'TUTOR');

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

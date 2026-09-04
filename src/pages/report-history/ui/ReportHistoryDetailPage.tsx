import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { AppNavShell, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { buildParentReport, type ParentReport } from '@/entities/analytics';
import { refetchStoryPackage, type StoryRuntimePackage } from '@/entities/story';
import { ReportContent } from '@/pages/one-story';
import { getStoryCompletion } from '@/entities/story-completion';
import { messageForError } from '@/shared/api';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; parentReport: ParentReport; storyPackage: StoryRuntimePackage }
  | { requestKey: string; status: 'error'; message: string };

/** 지난 "오늘의 질문 기록" 하나를 읽기 전용으로 보여주는 화면 - 저장된 outcomes와 이야기의 현재 reportCopy를 이용해, 실시간 세션이었다면 보여줬을 것과 동일한 ParentReport를 재구성한다. */
export function ReportHistoryDetailPage() {
  const { completionId } = useParams<{ completionId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const requestKey = `${completionId ?? ''}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });

  // TUTOR도 자기가 진행한 세션의 상세는 볼 수 있어야 한다 - 선생님 리포트 탭에서 세션을
  // 탭했을 때 여기로 오게 되어 있다. BE의 getStoryCompletion은 이미 완료 기록 소유자가
  // 아닌 사용자를 차단하므로, 여기서는 role 기반 페이지 접근만 허용한다.
  const canView = state.status === 'authenticated' && (
    state.user.role === 'PARENT' || state.user.role === 'CLASS_ACCOUNT' || state.user.role === 'TUTOR'
  );

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !completionId) return;
    let cancelled = false;
    getStoryCompletion(state.token, completionId)
      .then(async (detail) => {
        // 캐시 우회 - 같은 탭에서 이 이야기를 먼저 플레이했다면 loadStoryPackage()의 세션
        // 캐시가 방금 완료된 실시간 브랜치 삽화(GENERATED_BRANCH_ASSET)를 영영 못 보게 막는다.
        const storyPackage = await refetchStoryPackage(detail.storyId);
        if (cancelled) return;
        const parentReport = buildParentReport(storyPackage.reportCopy, detail.outcomes, {
          durationSeconds: detail.durationSeconds,
          branchAssetId: storyPackage.branchIllustrationAssetId,
          branchSummary: storyPackage.branchReportSummary,
        });
        setLoad({ requestKey, status: 'ready', parentReport, storyPackage });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          requestKey,
          status: 'error',
          message: messageForError(failure, '이 기록을 불러오지 못했어요. 기록이 삭제되었거나 접근 권한이 없을 수 있어요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state, completionId, requestKey]);

  if (!canView) return null;

  const effectiveLoad: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };

  return (
    <AppNavShell
      items={dashboardNavItems(state.user, navigate, 'reports')}
      onBack={() => navigate(state.status === 'authenticated' && state.user.role === 'TUTOR' ? '/tutor/reports' : '/reports')}
    >
      {effectiveLoad.status === 'loading' && (
        <View style={styles.centerBox}>
          <ActivityIndicator color={storybookTheme.color.gold} />
        </View>
      )}

      {effectiveLoad.status === 'error' && (
        <View style={styles.centerBox}>
          <Text style={styles.errorText}>{effectiveLoad.message}</Text>
        </View>
      )}

      {effectiveLoad.status === 'ready' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <ReportContent
            parentReport={effectiveLoad.parentReport}
            isWide={isWide}
            illustrationForAssetId={effectiveLoad.storyPackage.illustrationForAssetId}
          />
        </ScrollView>
      )}
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  errorText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    textAlign: 'center',
  },
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

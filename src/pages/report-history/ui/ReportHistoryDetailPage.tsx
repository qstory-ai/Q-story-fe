import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { buildParentReport, type ParentReport } from '@/entities/analytics';
import { refetchStoryPackage, type StoryRuntimePackage } from '@/entities/story';
import { ReportContent } from '@/pages/one-story';
import { getStoryCompletion, type StoryCompletionDetail } from '@/entities/story-completion';
import { messageForError } from '@/shared/api';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; parentReport: ParentReport; storyPackage: StoryRuntimePackage; detail: StoryCompletionDetail }
  | { requestKey: string; status: 'error'; message: string };

/** 지난 "오늘의 질문 기록" 하나를 읽기 전용으로 보여주는 화면 - 저장된 outcomes와 이야기의 현재 reportCopy를 이용해, 실시간 세션이었다면 보여줬을 것과 동일한 ParentReport를 재구성한다. */
export function ReportHistoryDetailPage() {
  const { completionId } = useParams<{ completionId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${completionId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });

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

  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (!token || !completionId) return;
    let cancelled = false;
    getStoryCompletion(token, completionId)
      .then(async (detail) => {
        // 캐시 우회 - 같은 탭에서 이 이야기를 먼저 플레이했다면 loadStoryPackage()의 세션
        // 캐시가 방금 완료된 실시간 브랜치 삽화(GENERATED_BRANCH_ASSET)를 영영 못 보게 막는다.
        const storyPackage = await refetchStoryPackage(detail.storyId);
        if (cancelled) return;
        const parentReport = buildParentReport(storyPackage.reportCopy, detail.outcomes, {
          durationSeconds: detail.durationSeconds,
          branchAssetId: storyPackage.branchIllustrationAssetId,
          branchSummary: storyPackage.branchReportSummary,
          companionChat: detail.companionChatSummary,
        });
        setLoad({ requestKey, status: 'ready', parentReport, storyPackage, detail });
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
  }, [token, completionId, requestKey]);

  if (!canView) return null;
  const isParent = state.user.role === 'PARENT';

  const effectiveLoad: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };

  return (
    <AppNavShell
      items={dashboardNavItems(state.user, navigate, 'reports')}
      onBack={() => navigate(state.status === 'authenticated' && state.user.role === 'TUTOR' ? '/tutor/reports' : '/reports')}
    >
      {effectiveLoad.status === 'loading' && <LoadingState label="리포트를 불러오는 중이에요…" />}

      {effectiveLoad.status === 'error' && (
        <ErrorState message={effectiveLoad.message} onRetry={() => setAttempt((n) => n + 1)} />
      )}

      {effectiveLoad.status === 'ready' && (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <SessionHeader
            detail={effectiveLoad.detail}
            storyTitle={effectiveLoad.parentReport.storyTitle}
            onReadAgain={isParent ? () => navigate(`/stories/${effectiveLoad.detail.storyId}/play`) : undefined}
          />
          <ReportContent
            parentReport={effectiveLoad.parentReport}
            isWide={isWide}
            illustrationForAssetId={effectiveLoad.storyPackage.illustrationForAssetId}
            audience={effectiveLoad.detail.sessionKind === 'CLASS' ? 'class' : 'child'}
          />
          {isParent && (
            <ActionButton
              label={readAgainLabel(effectiveLoad.detail)}
              onPress={() => navigate(`/stories/${effectiveLoad.detail.storyId}/play`)}
            />
          )}
        </ScrollView>
      )}
    </AppNavShell>
  );
}

function readAgainLabel(detail: StoryCompletionDetail): string {
  return detail.sessionKind === 'HOME' ? '이 이야기 다시 읽기' : '아이랑 다시 읽어보기';
}

/**
 * 기록 머리말 - 반 수업/선생님 수업/집에서 읽은 기록을 구분하고, 부모에게는 같은 동화를 바로 다시 읽는 길을 준다
 * (유치원에서 읽은 이야기를 서재에서 다시 찾지 않아도 되게).
 */
function SessionHeader({
  detail,
  storyTitle,
  onReadAgain,
}: {
  detail: StoryCompletionDetail;
  storyTitle: string;
  onReadAgain?: () => void;
}) {
  const where = [detail.organizationName, detail.className].filter(Boolean).join(' · ');
  const teacher = detail.tutorDisplayName ? `${detail.tutorDisplayName} 선생님` : null;
  const kindLabel =
    detail.sessionKind === 'CLASS' ? '반 수업 리포트' : detail.sessionKind === 'TUTOR' ? '선생님 수업 리포트' : '집에서 읽은 기록';
  const description =
    detail.sessionKind === 'CLASS'
      ? `${[where, teacher].filter(Boolean).join(' · ') || '선생님과 반 친구들'}과 함께 읽은 수업이에요${
          detail.participantCount > 1 ? ` (${detail.participantCount}명 참여)` : ''
        }. 반 전체의 이야기라서 우리 아이 한 명의 말로 나누지 않았어요.`
      : detail.sessionKind === 'TUTOR'
        ? `${teacher ?? '선생님'}과 우리 아이가 함께 읽은 수업이에요.`
        : '집에서 우리 아이와 함께 읽은 기록이에요.';
  return (
    <View style={styles.header}>
      <Pill label={kindLabel} tone="accent" />
      <Text style={styles.headerTitle}>{storyTitle}</Text>
      <Text style={styles.headerBody}>{description}</Text>
      {onReadAgain && detail.sessionKind !== 'HOME' && (
        <View style={styles.headerAction}>
          <Text style={styles.headerHint}>오늘 읽은 이야기를 집에서 아이와 한 번 더 읽어 보세요.</Text>
          <ActionButton label={readAgainLabel(detail)} onPress={onReadAgain} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  headerBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
    color: storybookTheme.color.onCardBody,
  },
  headerAction: {
    alignSelf: 'stretch',
    gap: storybookTheme.spacing.sm,
    marginTop: storybookTheme.spacing.xs,
  },
  headerHint: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
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

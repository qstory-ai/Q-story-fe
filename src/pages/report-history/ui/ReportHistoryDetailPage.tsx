import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, reportsPathFor, useAuth } from '@/entities/auth';
import { buildParentReport, type ParentReport } from '@/entities/analytics';
import { refetchStoryPackage, type StoryRuntimePackage } from '@/entities/story';
import { ReportContent } from '@/pages/one-story';
import { getStoryCompletion, type StoryCompletionDetail } from '@/entities/story-completion';
import { messageForError } from '@/shared/api';
import { teacherTitle, useBackOr } from '@/shared/lib';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; parentReport: ParentReport; storyPackage: StoryRuntimePackage; detail: StoryCompletionDetail }
  | { requestKey: string; status: 'error'; message: string };

/** 지난 "오늘의 질문 기록" 하나를 읽기 전용으로 보여주는 화면 - 저장된 outcomes와 이야기의 현재 reportCopy를 이용해, 실시간 세션이었다면 보여줬을 것과 동일한 ParentReport를 재구성한다. */
export function ReportHistoryDetailPage() {
  const { completionId } = useParams<{ completionId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const reportsFallback = state.status === 'authenticated' ? reportsPathFor(state.user) : '/reports';
  const goBack = useBackOr(reportsFallback);
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${completionId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });

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
      items={dashboardNavItems(state.user, navigate, pathname)}
      onBack={goBack}
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
          {isParent && effectiveLoad.detail.sessionKind === 'HOME' && (
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
  if (detail.sessionKind === 'CLASS') return '집에서 다시 플레이하기';
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
  const teacher = detail.tutorDisplayName ? `${teacherTitle(detail.tutorDisplayName)}` : null;
  const kindLabel =
    detail.sessionKind === 'CLASS' ? '반 수업 리포트' : detail.sessionKind === 'TUTOR' ? '선생님 수업 리포트' : '집에서 읽은 기록';
  const description =
    detail.sessionKind === 'CLASS'
      ? `반 친구들이 함께 읽은 수업이에요${[where, teacher].filter(Boolean).length > 0 ? ` (${[where, teacher].filter(Boolean).join(' · ')})` : ''}${
          detail.participantCount > 1 ? ` · ${detail.participantCount}명 참여` : ''
        }. 반 전체의 이야기라서 한 아이의 말로 나누지 않았어요.`
      : detail.sessionKind === 'TUTOR'
        ? `선생님과 아이가 함께 읽은 수업이에요${teacher ? ` (${teacher})` : ''}.`
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

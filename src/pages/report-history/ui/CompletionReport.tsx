import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { buildParentReport, type ParentReport } from '@/entities/analytics';
import { refetchStoryPackage, type StoryRuntimePackage } from '@/entities/story';
import {
  ReportContent,
  SessionReport,
  TeacherNoteEditor,
  readAgainChoice,
  useCompletionDetail,
  useReportTracking,
  type ReportViewSource,
  type SessionReportView,
} from '@/pages/one-story';
import { useAuth } from '@/entities/auth';
import { getStoryCompletion, type StoryCompletionDetail } from '@/entities/story-completion';
import { SessionCodeNote } from '@/entities/play-session';
import { messageForError } from '@/shared/api';
import { teacherTitle } from '@/shared/lib';
import { storyPlayPath } from '@/features/story-library';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; parentReport: ParentReport; storyPackage: StoryRuntimePackage; detail: StoryCompletionDetail }
  | { requestKey: string; status: 'error'; message: string };

/**
 * 리포트 하나의 본문 - 저장된 outcomes와 이야기의 현재 reportCopy로, 실시간 세션이었다면 보여줬을 것과 동일한
 * ParentReport를 재구성한다. 리포트 상세 화면(/reports/:id)이 쓴다.
 */
export function CompletionReport({
  token,
  completionId,
  isParent,
  viewSource = 'history',
}: {
  token: string;
  completionId: string;
  isParent: boolean;
  /** 리포트를 연 곳(통계) - 상세 화면은 주소의 from=으로 정한다. */
  viewSource?: ReportViewSource;
}) {
  const navigate = useNavigate();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${completionId}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });

  useEffect(() => {
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

  const effectiveLoad: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };
  const { state: authState } = useAuth();
  // 분석이 아직 만들어지는 중이면 상세를 다시 받아 관심·대화 카드를 채운다(Q-39).
  const polled = useCompletionDetail(
    effectiveLoad.status === 'ready' && needsPolling(effectiveLoad.detail) ? token : null,
    completionId,
  );
  const loadedKind = effectiveLoad.status === 'ready' ? effectiveLoad.detail.sessionKind : null;
  const trackReportAction = useReportTracking({
    kind: loadedKind,
    source: viewSource,
    completionId,
    viewerRole: authState.status === 'authenticated' ? authState.user.role : null,
    ready: effectiveLoad.status === 'ready',
  });

  if (effectiveLoad.status === 'loading') return <LoadingState label="리포트를 불러오는 중이에요…" />;
  if (effectiveLoad.status === 'error') {
    return <ErrorState message={effectiveLoad.message} onRetry={() => setAttempt((n) => n + 1)} />;
  }
  const detail = polled.detail ?? effectiveLoad.detail;
  const readAgainLegacy = (target: StoryCompletionDetail) => {
    trackReportAction('reread_click');
    navigate(readAgainPath(target));
  };
  const view = reportView(detail, isParent);
  const readAgain = isParent ? (
    <ReadAgainButtons
      detail={detail}
      onOpen={(childId) => {
        trackReportAction('reread_click');
        navigate(storyPlayPath(detail.storyId, { childId, from: 'report' }));
      }}
    />
  ) : null;
  if (view) {
    const isTutor = authState.status === 'authenticated' && authState.user.role === 'TUTOR';
    return (
      <View style={styles.body}>
        <SessionHeader detail={detail} storyTitle={effectiveLoad.parentReport.storyTitle} />
        <SessionReport
          storyPackage={effectiveLoad.storyPackage}
          isWide={isWide}
          view={view}
          data={{
            sessionKind: detail.sessionKind,
            className: detail.className,
            tutorDisplayName: detail.tutorDisplayName,
            completedAt: detail.completedAt,
            endStatus: detail.endStatus ?? 'COMPLETED',
            readFromSceneId: detail.readFromSceneId,
            readThroughSceneId: detail.readThroughSceneId,
            turns: detail.turns ?? [],
            outcomes: detail.outcomes,
            analysis: detail.analysis,
            teacherNote: detail.teacherNote,
          }}
          onRetryAnalysis={() => void polled.retry()}
          onAction={trackReportAction}
          teacherNoteSlot={
            view === 'teacher' && isTutor ? (
              <TeacherNoteEditor
                token={token}
                completionId={detail.id}
                initial={detail.teacherNote}
                onSaved={() => trackReportAction('teacher_note_saved')}
              />
            ) : undefined
          }
          readAgainSlot={readAgain}
        />
        <SessionCodeNote sessionId={detail.sessionId} />
      </View>
    );
  }
  return (
    <View style={styles.body}>
      <SessionHeader
        detail={effectiveLoad.detail}
        storyTitle={effectiveLoad.parentReport.storyTitle}
        onReadAgain={isParent ? () => readAgainLegacy(effectiveLoad.detail) : undefined}
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
          onPress={() => readAgainLegacy(effectiveLoad.detail)}
        />
      )}
      <SessionCodeNote sessionId={effectiveLoad.detail.sessionId} />
    </View>
  );
}

/**
 * 대화 기록이 있는 기록(Q-39 이후)은 새 리포트로 그린다. 보관 기간이 지나 원문이 지워진 기록·옛 기록은
 * 저장된 요약(outcomes)으로 그리는 기존 리포트를 쓴다.
 */
function reportView(detail: StoryCompletionDetail, isParent: boolean): SessionReportView | null {
  if (!detail.turns || detail.turnsAvailable === false) return null;
  if (detail.sessionKind === 'HOME') return 'home';
  if (!isParent) return 'teacher';
  return detail.sessionKind === 'CLASS' ? 'class-parent' : 'home';
}

function needsPolling(detail: StoryCompletionDetail) {
  return Boolean(detail.turns) && (!detail.analysis || detail.analysis.status === 'PENDING');
}

/**
 * "아이랑 다시 읽기" - 이 기록과 이어진 우리 아이의 새 가정 회차로 첫 장면부터 연다. 이어진 아이가 여럿이면
 * 고르게 하고, 정보가 없으면(옛 서버) 기록의 아이(가정 기록) 또는 지금 선택된 아이로 연다.
 */
function ReadAgainButtons({ detail, onOpen }: { detail: StoryCompletionDetail; onOpen: (childId: string | null) => void }) {
  const choice = readAgainChoice(detail.linkedChildren);
  if (choice.kind === 'pick') {
    return (
      <View style={styles.readAgain}>
        <Text style={styles.headerHint}>누구와 다시 읽을까요? 고른 아이의 새 기록으로 첫 장면부터 시작해요.</Text>
        <View style={styles.readAgainChoices}>
          {choice.children.map((child) => (
            <Pressable key={child.id} accessibilityRole="button" onPress={() => onOpen(child.id)} style={styles.childChoice}>
              <Text style={styles.childChoiceText}>{child.name}와 다시 읽기</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.readAgain}>
      <ActionButton
        label="아이랑 다시 읽기"
        onPress={() => onOpen(choice.kind === 'one' ? choice.childId : detail.childId)}
      />
    </View>
  );
}

/** 다시 읽기는 이 리포트의 아이로 기록한다 - 반 수업 리포트(아이 미지정)는 지금 선택된 아이 그대로. */
function readAgainPath(detail: StoryCompletionDetail): string {
  const choice = readAgainChoice(detail.linkedChildren);
  return storyPlayPath(detail.storyId, { childId: choice.kind === 'one' ? choice.childId : detail.childId, from: 'report' });
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
  body: { gap: 16 },
  readAgain: { gap: storybookTheme.spacing.sm },
  readAgainChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.sm },
  childChoice: {
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  childChoiceText: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
  },
});

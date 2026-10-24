import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/entities/auth';
import { ActionButton } from '@/shared/ui';
import { SessionCodeNote } from '@/entities/play-session';
import {
  ReportContent,
  ReportHeader,
  SessionReport,
  TeacherNoteEditor,
  useCompletionDetail,
  useReportTracking,
} from '@/widgets/session-report';

import type { OneStoryRuntime } from '../../model';
import { styles } from '../styles';

export function ParentReportPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    isWide,
    parentReport,
    openCompletionSurvey,
    finishFromReport,
    restartStory,
    storyPackage,
    liveTurns,
    completedRecordId,
    childName,
    questionOutcomes,
    isClassLesson,
    sessionCode,
  } = runtime;
  const { state: authState } = useAuth();
  const token = authState.status === 'authenticated' ? authState.token : null;
  // 방금 저장한 기록을 받아 와 서버 분석(관심·대화 카드)과 이어 읽기 전 대화까지 채운다(Q-39).
  const { detail, retry } = useCompletionDetail(token, completedRecordId);
  const turns = detail?.turns && detail.turns.length > 0 ? detail.turns : liveTurns;
  const useSessionReport = turns.length > 0 || Boolean(detail?.turns);
  // 로그인하지 않은 데모는 서버 분석이 없다 - 기다리는 표시 대신 생략으로 보여 준다.
  const analysis = token
    ? (detail?.analysis ?? null)
    : { status: 'SKIPPED' as const, observations: [], cards: [], commonScenes: [] };
  const isTutor = authState.status === 'authenticated' && authState.user.role === 'TUTOR';
  // 로그인 회차는 기록이 저장돼 id가 생긴 뒤에 열람을 남긴다(기록 id로 회차와 잇기 위해).
  const trackReportAction = useReportTracking({
    kind: detail?.sessionKind ?? (isClassLesson ? 'CLASS' : 'HOME'),
    source: 'live',
    completionId: completedRecordId,
    viewerRole: authState.status === 'authenticated' ? authState.user.role : 'GUEST',
    ready: !token || Boolean(completedRecordId),
  });

  // 리포트 탭과 같은 머리 카드 - 같은 리포트라 다시 볼 곳을 알려 준다(10/24 대표 QA).
  const reportsNote = token
    ? `이 ${isClassLesson ? '수업 기록' : '리포트'}은 '리포트' 탭에서 다시 볼 수 있어요.`
    : "가입하면 읽은 기록을 '리포트' 탭에 모아 볼 수 있어요.";
  const readAgain = (
    <ActionButton
      variant="secondaryFull"
      label="같은 이야기 다시 읽기"
      onPress={() => {
        trackReportAction('reread_click');
        void restartStory();
      }}
    />
  );

  return (
    <View style={[styles.parentReportContent, panel.column]}>
      <ReportHeader
        kindLabel={isClassLesson ? '반 수업 리포트' : '집에서 읽은 기록'}
        title={storyPackage.manifest.title}
        description={isClassLesson ? '반 친구들이 함께 읽은 수업이에요.' : '집에서 우리 아이와 함께 읽은 기록이에요.'}
        note={reportsNote}
      />
      {useSessionReport ? (
        <SessionReport
          storyPackage={storyPackage}
          isWide={isWide}
          view={isClassLesson ? 'teacher' : 'home'}
          data={{
            sessionKind: detail?.sessionKind ?? (isClassLesson ? 'CLASS' : 'HOME'),
            childName,
            className: detail?.className,
            completedAt: detail?.completedAt ?? null,
            endStatus: 'COMPLETED',
            readFromSceneId: detail?.readFromSceneId ?? storyPackage.presentation.scenes[0]?.id,
            readThroughSceneId: detail?.readThroughSceneId ?? storyPackage.manifest.endingSceneId,
            turns,
            outcomes: questionOutcomes,
            analysis,
            teacherNote: detail?.teacherNote,
          }}
          onRetryAnalysis={() => void retry()}
          onAction={trackReportAction}
          readAgainSlot={readAgain}
          teacherNoteSlot={
            isClassLesson && isTutor && token && completedRecordId ? (
              <TeacherNoteEditor
                token={token}
                completionId={completedRecordId}
                initial={detail?.teacherNote}
                onSaved={() => trackReportAction('teacher_note_saved')}
              />
            ) : isClassLesson ? (
              <Text style={styles.reportPanelDescription}>기록이 저장되면 여기서 메모를 남길 수 있어요.</Text>
            ) : undefined
          }
        />
      ) : (
        <ReportContent
          parentReport={parentReport}
          isWide={isWide}
          illustrationForAssetId={storyPackage.illustrationForAssetId}
        />
      )}

      {useSessionReport ? null : readAgain}
      {/* 후기와 나가기 - 머리 카드와 같은 흰 카드(예전 짙은 보라 상자는 리포트 탭과 달라 보였다). */}
      <ReportHeader
        kindLabel="1분이면 충분해요"
        title="방금 체험은 어떠셨나요?"
        description="좋았던 점과 불편했던 점을 남겨주시면 더 나은 이야기로 다듬는 데 바로 반영할게요."
      >
        <View style={[panel.actions, isWide && panel.actionsWide]}>
          <View style={panel.action}>
            <ActionButton variant="primary" label="1분 후기 남기기" onPress={openCompletionSurvey} />
          </View>
          <View style={panel.action}>
            {/* 로그인 안 한 데모는 데모 첫 화면이 아니라 메인 홈페이지(qstory.ai.kr)로 간다. */}
            <ActionButton variant="secondaryFull" size="lg" label="홈으로" onPress={finishFromReport} />
          </View>
        </View>
      </ReportHeader>
      <SessionCodeNote code={sessionCode} />
    </View>
  );
}

const panel = StyleSheet.create({
  // 리포트 탭(ReportHistoryDetailPage)과 같은 폭 - 넓은 화면에서 카드가 화면 끝까지 늘어나지 않게.
  column: { maxWidth: 1040, alignSelf: 'center' },
  actions: { gap: 8 },
  actionsWide: { flexDirection: 'row' },
  action: { flex: 1 },
});

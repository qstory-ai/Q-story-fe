import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/entities/auth';
import { SessionCodeNote } from '@/entities/play-session';

import type { OneStoryRuntime } from '../../model';
import { useCompletionDetail } from '../../model/use-completion-detail';
import { useReportTracking } from '../../model/use-report-tracking';
import { styles } from '../styles';
import { ReportContent } from './report-content';
import { SessionReport } from './session-report';
import { TeacherNoteEditor } from './teacher-note-editor';

export function ParentReportPanel({ runtime }: { runtime: OneStoryRuntime }) {
  const {
    isWide,
    parentReport,
    openCompletionSurvey,
    finishExperience,
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

  return (
    <View style={styles.parentReportContent}>
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

      <View
        style={[styles.reportActionPanel, isWide && styles.reportActionPanelWide]}
      >
        <View style={styles.reportActionCopy}>
          <Text style={styles.reportActionEyebrow}>1분이면 충분해요</Text>
          <Text style={styles.reportActionTitle}>방금 체험은 어떠셨나요?</Text>
          <Text style={styles.reportActionBody}>
            좋았던 점과 불편했던 점을 남겨주시면 더 나은 이야기로 다듬는 데
            바로 반영할게요.
          </Text>
        </View>
        <View style={styles.reportActionButtons}>
          <Pressable
            accessibilityRole="button"
            style={styles.reportPrimaryAction}
            onPress={openCompletionSurvey}
          >
            <Text style={styles.reportPrimaryActionText}>
              1분 체험 후기 남기기 →
            </Text>
          </Pressable>
          <View style={styles.reportSecondaryActionRow}>
            <Pressable
              accessibilityRole="button"
              style={styles.reportSecondaryAction}
              onPress={finishExperience}
            >
              <Text style={styles.reportSecondaryActionText}>
                홈으로 돌아가기
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.reportSecondaryAction}
              onPress={() => {
                trackReportAction('reread_click');
                restartStory();
              }}
            >
              <Text style={styles.reportSecondaryActionText}>
                같은 이야기 다시 읽기
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
      <SessionCodeNote code={sessionCode} />
    </View>
  );
}

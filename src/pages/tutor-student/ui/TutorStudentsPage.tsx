import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, EmptyState, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { DEFAULT_BETA_STORY_ID } from '@/entities/story';
import { createTutorInvite, listTutorStudents, type TutorInvite, type TutorStudent } from '@/entities/tutor';
import { InviteCodeCard, formatInviteExpiry, tutorInviteLink, tutorInviteShareMessage } from '@/features/invite-issue';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[] }
  | { status: 'error'; message: string };

const STATUS_LABEL: Record<TutorStudent['status'], string> = {
  PENDING_PARENT: '부모 확인 대기',
  CONFIRMED: '연결됨',
};

/**
 * 과외생 목록. 각 학생 카드에서 곧바로 "부모 초대 코드 발급" → 발급된 코드/링크를 인라인으로
 * 노출한다 (선생님이 학생과 대화 도중에 바로 구두로 코드를 알려 주거나 링크를 붙여넣을 수
 * 있게 하려는 의도). 발급은 idempotent가 아니라 매번 새 초대를 만들지만, 만료된 이전 초대는
 * 어차피 쓸 수 없어 사용자 관점에서는 문제되지 않는다.
 */
export function TutorStudentsPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [issuedByStudent, setIssuedByStudent] = useState<Record<string, TutorInvite>>({});
  const [issuingStudentId, setIssuingStudentId] = useState<string | null>(null);
  const [issueError, setIssueError] = useState<Record<string, string>>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
      return;
    }
    listTutorStudents(state.token)
      .then((students) => setLoad({ status: 'ready', students }))
      .catch((failure: unknown) => setLoad({
        status: 'error',
        message: messageForError(failure, '학생 목록을 불러오지 못했어요.'),
      }));
  }, [state, navigate, reloadKey]);

  const refresh = () => setReloadKey((n) => n + 1);

  async function issueInvite(studentId: string) {
    if (state.status !== 'authenticated') return;
    setIssuingStudentId(studentId);
    setIssueError((prev) => {
      const next = { ...prev };
      delete next[studentId];
      return next;
    });
    try {
      const invite = await createTutorInvite(state.token, studentId, { method: 'LINK' });
      setIssuedByStudent((prev) => ({ ...prev, [studentId]: invite }));
    } catch (failure: unknown) {
      const message = messageForError(failure, '초대를 만들지 못했어요.');
      setIssueError((prev) => ({ ...prev, [studentId]: message }));
    } finally {
      setIssuingStudentId(null);
    }
  }

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'classes')} onBack={() => navigate('/tutor')}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">등록된 학생</Text>
          <ActionButton label="새 학생 등록" icon="+" size="sm" onPress={() => navigate('/tutor/students/new')} />
        </View>

        {load.status === 'loading' && <LoadingState label="학생 목록을 불러오는 중이에요…" />}

        {load.status === 'ready' && load.students.length === 0 && (
          <EmptyState
            title="아직 등록된 학생이 없어요"
            body="첫 학생을 등록하고 부모 초대를 시작해 보세요."
            cta={{ label: '새 학생 등록하기', onPress: () => navigate('/tutor/students/new') }}
          />
        )}

        {load.status === 'ready' &&
          load.students.map((student) => (
            <View key={student.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>
                  {student.name} · {student.ageBand}
                </Text>
                <Pill label={STATUS_LABEL[student.status]} />
              </View>
              <Text style={styles.cardBody}>
                {student.lessonType === 'CLASS'
                  ? `반 수업${student.classGroupName ? ` · ${student.classGroupName}` : ''}`
                  : '개인 레슨'}
                {student.classType ? ` · ${student.classType}` : ''}
              </Text>
              {student.prepNote ? <Text style={styles.cardBody}>{student.prepNote}</Text> : null}
              {/* 카드마다 세로로 쌓인 전폭 버튼 셋은 목록을 세 배로 길게 만들고 무엇이 주 동작인지도
                  흐렸다 - 한 줄에 놓고 "이야기 시작"만 채움 버튼으로 둔다. */}
              <View style={styles.actions}>
                <ActionButton
                  variant="primary"
                  size="sm"
                  label="이야기 시작"
                  onPress={() => navigate(`/stories/${DEFAULT_BETA_STORY_ID}/play?tutorStudentId=${student.id}`)}
                />
                <ActionButton
                  variant="secondary"
                  label="상세 · 메모"
                  onPress={() => navigate(`/tutor/students/${student.id}`)}
                />
                {student.status === 'PENDING_PARENT' ? (
                  <ActionButton
                    variant="secondary"
                    label={issuingStudentId === student.id ? '초대 만드는 중…' : '부모 초대 코드'}
                    onPress={() => issueInvite(student.id)}
                    disabled={issuingStudentId === student.id}
                  />
                ) : null}
              </View>
              {issueError[student.id] ? (
                <Text style={styles.error}>{issueError[student.id]}</Text>
              ) : null}
              {issuedByStudent[student.id] ? (
                <InviteCodeCard
                  shortCode={issuedByStudent[student.id].shortCode}
                  link={tutorInviteLink(issuedByStudent[student.id].token)}
                  expiresLabel={formatInviteExpiry(issuedByStudent[student.id].expiresAt)}
                  shareMessage={tutorInviteShareMessage(student.name)}
                  onDismiss={() => setIssuedByStudent((prev) => {
                    const next = { ...prev };
                    delete next[student.id];
                    return next;
                  })}
                />
              ) : null}
            </View>
          ))}

        {load.status === 'error' && <ErrorState message={load.message} onRetry={refresh} />}
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.narrowMaxWidth,
    alignSelf: 'center',
    gap: storybookTheme.spacing.ms,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
  card: {
    gap: storybookTheme.spacing.sm,
    padding: storybookTheme.spacing.md,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceWhite,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: storybookTheme.spacing.sm },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.sm, marginTop: storybookTheme.spacing.xs },
  cardTitle: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  cardBody: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onCardBody },
});

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, Pill, SafeAreaView, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import { DEFAULT_BETA_STORY_ID } from '@/entities/story';
import { createTutorInvite, listTutorStudents, type TutorInvite, type TutorStudent } from '@/entities/tutor';
import { InviteCodeCard } from '@/features/invite-issue';

type LoadState = { status: 'loading' } | { status: 'ready'; students: TutorStudent[] } | { status: 'error' };

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

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
      return;
    }
    listTutorStudents(state.token)
      .then((students) => setLoad({ status: 'ready', students }))
      .catch(() => setLoad({ status: 'error' }));
  }, [state, navigate]);

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

  const originBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Pressable onPress={() => navigate('/tutor')} accessibilityRole="link" hitSlop={8} style={styles.backLink}>
        <Text style={styles.backLinkText}>← 홈으로</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">등록된 학생</Text>

        {load.status === 'ready' && load.students.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>아직 등록된 학생이 없어요</Text>
            <ActionButton label="새 학생 등록하기" onPress={() => navigate('/tutor/students/new')} />
          </View>
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
              {student.classType ? <Text style={styles.cardBody}>{student.classType}</Text> : null}
              {student.prepNote ? <Text style={styles.cardBody}>{student.prepNote}</Text> : null}
              <ActionButton
                variant="secondaryFull"
                label="이야기 시작하기"
                onPress={() => navigate(`/stories/${DEFAULT_BETA_STORY_ID}/play?tutorStudentId=${student.id}`)}
              />
              <ActionButton
                variant="secondaryFull"
                label="상세 · 메모 편집"
                onPress={() => navigate(`/tutor/students/${student.id}`)}
              />
              {student.status === 'PENDING_PARENT' ? (
                <ActionButton
                  variant="secondaryFull"
                  label={issuingStudentId === student.id ? '초대 만드는 중…' : '부모 초대 코드 발급'}
                  onPress={() => issueInvite(student.id)}
                  disabled={issuingStudentId === student.id}
                />
              ) : null}
              {issueError[student.id] ? (
                <Text style={styles.error}>{issueError[student.id]}</Text>
              ) : null}
              {issuedByStudent[student.id] ? (
                <InviteCodeCard
                  shortCode={issuedByStudent[student.id].shortCode}
                  link={`${originBase}/tutor-invite/${issuedByStudent[student.id].token}`}
                  expiresLabel={formatExpires(issuedByStudent[student.id].expiresAt)}
                  onDismiss={() => setIssuedByStudent((prev) => {
                    const next = { ...prev };
                    delete next[student.id];
                    return next;
                  })}
                />
              ) : null}
            </View>
          ))}

        {load.status === 'error' && <Text style={styles.error}>학생 목록을 불러오지 못했어요.</Text>}
      </View>
    </SafeAreaView>
  );
}

function formatExpires(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric' }).format(date);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.shellBackground },
  backLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: storybookTheme.spacing.ml },
  backLinkText: { color: storybookTheme.color.onLightMuted, fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.medium },
  content: {
    gap: storybookTheme.spacing.ms,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingBottom: storybookTheme.spacing.xl,
    maxWidth: storybookTheme.layout.narrowMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: storybookTheme.type.lg, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onLightHeading },
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
  cardTitle: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  cardBody: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onCardBody },
});

import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams, useLocation } from 'react-router-dom';

import { AppNavShell, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useBackOr } from '@/shared/lib';
import {
  dashboardNavItems,
  fetchClass,
  listClassStudents,
  previewClassByCode,
  useAuth,
  type ClassPreview,
  type ClassStudentResponse,
} from '@/entities/auth';
import { InviteCodeCard, classInviteLink, classInviteShareMessage } from '@/features/invite-issue';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; preview: ClassPreview; students: ClassStudentResponse[] }
  | { requestKey: string; status: 'error'; message: string };

/**
 * 담임 선생님의 반 화면 - 반 초대 링크 하나(알림장·단체방용)와 학생별 부모 연결 현황을 함께 본다. 부모님이
 * 링크로 들어와 아이를 고르면 명단의 같은 이름 학생과 이어지고, 여기서 "연결됨"으로 바뀐다.
 */
export function TutorClassGroupPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const goBack = useBackOr('/tutor/students');
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${classId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (!token || !classId) return;
    let cancelled = false;
    Promise.all([fetchClass(token, classId), listClassStudents(token, classId)])
      .then(async ([classGroup, students]) => {
        // 반 응답에는 기관 이름이 없다 - 부모가 보는 미리보기와 같은 이름을 안내 문구에 쓴다.
        const preview = await previewClassByCode(classGroup.joinCode);
        if (!cancelled) setLoad({ requestKey, status: 'ready', preview, students });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoad({ requestKey, status: 'error', message: messageForError(failure, '반 정보를 불러오지 못했어요.') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, requestKey]);

  if (state.status !== 'authenticated') return null;
  const effective: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={goBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {effective.status === 'loading' && <LoadingState label="반 정보를 불러오는 중이에요…" />}
        {effective.status === 'error' && (
          <ErrorState message={effective.message} onRetry={() => setAttempt((n) => n + 1)} />
        )}
        {effective.status === 'ready' && (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>{effective.preview.organizationName ?? '내 반'}</Text>
              <Text style={styles.title} accessibilityRole="header">{effective.preview.className}</Text>
              <Text style={styles.body}>
                부모님 연결 {effective.students.filter((student) => student.status === 'CONFIRMED').length} /{' '}
                {effective.students.length}명
              </Text>
            </View>

            <InviteCodeCard
              reusable
              shortCode={effective.preview.classCode}
              link={classInviteLink(effective.preview.classCode)}
              shareMessage={classInviteShareMessage(effective.preview.className, effective.preview.organizationName)}
            />

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>학생 명단</Text>
              {effective.students.length === 0 ? (
                <Text style={styles.body}>
                  아직 들어온 아이가 없어요. 위 반 초대 링크를 보내면 부모님이 아이를 연결할 때 명단에 자동으로 올라가요. 수업은 명단이 비어 있어도 먼저 만들 수 있어요.
                </Text>
              ) : (
                effective.students.map((student) => (
                  <View key={student.id} style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle}>
                        {student.name} · {student.ageBand}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {student.parentDisplayName ? `${student.parentDisplayName} 부모님` : '아직 부모님이 들어오지 않았어요'}
                      </Text>
                    </View>
                    <Pill label={student.status === 'CONFIRMED' ? '연결됨' : '보호자 연결 대기'} tone={student.status === 'CONFIRMED' ? 'accent' : 'onCard'} />
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  header: { gap: storybookTheme.spacing.xs },
  eyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.contentPanelBorder,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  rowMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onContentMuted,
  },
});

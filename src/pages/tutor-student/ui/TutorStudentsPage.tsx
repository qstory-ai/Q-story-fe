import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, EmptyState, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { TUTOR_PATHS, dashboardNavItems, useAuth } from '@/entities/auth';
import { listTutorClasses, listTutorStudents, type TutorClass, type TutorStudent } from '@/entities/tutor';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[] }
  | { status: 'error'; message: string };

const STATUS_LABEL: Record<TutorStudent['status'], string> = {
  PENDING_PARENT: '보호자 연결 대기',
  CONFIRMED: '연결됨',
};

/**
 * 선생님 "반·학생" 탭(/tutor/classes). 선생님은 반 단위로만 일한다(1:1 과외도 아이 한 명짜리 반) - 학생을
 * 한 명씩 등록하지 않고, 반 초대 링크로 보호자가 아이를 연결하면 명단에 자동으로 올라온다. 내 반 목록(누르면
 * 반 상세)과 반에 들어온 아이(누르면 학생 상세·리포트)를 함께 본다.
 *
 * <p>"새 반 만들기"는 이 화면이 기본 진입점이다(Q-35). 반이 하나도 없을 때는 빈 화면의 버튼 하나만, 반이
 * 있으면 머리말의 버튼 하나만 보인다.
 */
export function TutorStudentsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  // 담임인 반. 부가 정보라 실패해도 학생 목록은 보인다.
  // null = 아직 불러오는 중이거나 실패 - 그동안 "아직 만든 반이 없어요"를 보이지 않는다.
  const [homeroomClasses, setHomeroomClasses] = useState<TutorClass[] | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const tutorToken = state.status === 'authenticated' && state.user.role === 'TUTOR' ? state.token : null;
  const tutorId = state.status === 'authenticated' ? state.user.id : null;

  useEffect(() => {
    if (!tutorToken) return;
    let cancelled = false;
    listTutorClasses(tutorToken)
      .then((classes) => {
        if (!cancelled) setHomeroomClasses(classes.filter((classGroup) => classGroup.tutorId === tutorId));
      })
      .catch(() => {});
    listTutorStudents(tutorToken)
      .then((students) => {
        if (!cancelled) setLoad({ status: 'ready', students });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoad({ status: 'error', message: messageForError(failure, '학생 목록을 불러오지 못했어요.') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tutorToken, tutorId, reloadKey]);

  const refresh = () => setReloadKey((n) => n + 1);

  if (state.status !== 'authenticated') return null;

  const hasNoClass = homeroomClasses?.length === 0;
  const newClass = () => navigate(TUTOR_PATHS.newClass);

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={() => navigate('/tutor')}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">반·학생</Text>
          {homeroomClasses && homeroomClasses.length > 0 ? (
            <ActionButton label="새 반 만들기" icon="+" size="sm" onPress={newClass} />
          ) : null}
        </View>

        {hasNoClass ? (
          <EmptyState
            title="아직 만든 반이 없어요"
            body="반을 만들면 초대 링크가 생겨요. 알림장에 올리면 보호자가 아이를 연결할 때 명단에 자동으로 올라가요. 1:1 과외도 아이 한 명짜리 반으로 시작해요."
            cta={{ label: '새 반 만들기', onPress: newClass }}
          />
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>내 반</Text>
            {(homeroomClasses ?? []).map((classGroup) => (
              <Pressable
                key={classGroup.id}
                accessibilityRole="link"
                accessibilityLabel={`${classGroup.name} 반 상세 열기`}
                onPress={() => navigate(TUTOR_PATHS.classDetail(classGroup.id))}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{classGroup.name}</Text>
                  <Text style={styles.rowMeta}>초대 링크 · 명단 · 보호자 연결 현황</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle} accessibilityRole="header">반에 들어온 아이</Text>

        {load.status === 'loading' && <LoadingState label="학생 목록을 불러오는 중이에요…" />}

        {load.status === 'ready' && load.students.length === 0 && (
          <Text style={styles.cardBody}>
            아직 들어온 아이가 없어요. 반 상세의 초대 링크를 보내면 보호자가 아이를 연결할 때 여기에 올라와요.
          </Text>
        )}

        {load.status === 'ready' && load.students.length > 0 && (
          <View style={styles.card}>
            {load.students.map((student) => (
              <Pressable
                key={student.id}
                accessibilityRole="link"
                accessibilityLabel={`${student.name} 학생 상세 열기`}
                onPress={() => navigate(TUTOR_PATHS.student(student.id))}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>
                    {student.name} · {student.ageBand}
                  </Text>
                  {student.classGroupName ? <Text style={styles.rowMeta}>{student.classGroupName}</Text> : null}
                </View>
                <Pill label={STATUS_LABEL[student.status]} />
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </View>
        )}

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
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
    marginTop: storybookTheme.spacing.sm,
  },
  card: {
    gap: storybookTheme.spacing.xs,
    padding: storybookTheme.spacing.md,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceWhite,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  cardTitle: { fontSize: storybookTheme.type.md, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  cardBody: { fontSize: storybookTheme.type.sm, lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal, color: storybookTheme.color.onContentMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  pressed: { opacity: 0.85 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: storybookTheme.type.sm, fontWeight: storybookTheme.type.weight.bold, color: storybookTheme.color.onCardTitle },
  rowMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  chevron: { fontSize: storybookTheme.type.lg, color: storybookTheme.color.onCardMuted, paddingHorizontal: 4 },
});

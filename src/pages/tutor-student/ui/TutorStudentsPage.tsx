import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { ActionButton, AppNavShell, EmptyState, ErrorState, LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
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
 * 반과 학생. 선생님은 반 단위로만 일한다(1:1 과외도 아이 한 명짜리 반) - 학생을 한 명씩 등록하거나
 * 학생별 부모 초대를 보내지 않고, 반 초대 링크로 부모님이 아이를 연결하면 명단에 자동으로 올라온다.
 * 그래서 학생 목록은 읽기 전용 명단이고, 학생별로는 상세·메모만 남긴다.
 */
export function TutorStudentsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  // 담임인 반 - 반마다 초대 링크 하나와 부모 연결 현황을 보는 반 화면으로 간다. 부가 정보라 실패해도 목록은 보인다.
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

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={() => navigate('/tutor')}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">반과 학생</Text>
          <View style={styles.headerActions}>
            <ActionButton label="새 반 만들기" icon="+" size="sm" onPress={() => navigate('/tutor/class-groups/new')} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>내 반</Text>
          <Text style={styles.cardBody}>
            학생을 미리 등록하지 않아도 돼요. 반 초대 링크 하나를 알림장에 올리면 부모님이 아이를 연결할 때 명단에 자동으로 올라가요.
          </Text>
          <View style={styles.actions}>
            {(homeroomClasses ?? []).map((classGroup) => (
              <ActionButton
                key={classGroup.id}
                variant="secondary"
                label={`${classGroup.name} 초대·명단`}
                onPress={() => navigate(`/tutor/class-groups/${classGroup.id}`)}
              />
            ))}
          </View>
          {homeroomClasses?.length === 0 ? (
            <Text style={styles.cardBody}>아직 만든 반이 없어요. 위 "새 반 만들기"로 시작해 보세요.</Text>
          ) : null}
        </View>

        <Text style={styles.cardTitle} accessibilityRole="header">반에 들어온 아이</Text>
        <Text style={styles.cardBody}>부모님이 반 초대 링크로 아이를 연결하면 여기에 올라와요.</Text>

        {load.status === 'loading' && <LoadingState label="학생 목록을 불러오는 중이에요…" />}

        {load.status === 'ready' && load.students.length === 0 && (
          <EmptyState
            title="아직 학생이 없어요"
            body="반을 만들어 초대 링크를 보내면 부모님이 아이를 연결할 때 여기에 올라와요."
            cta={{ label: '새 반 만들기', onPress: () => navigate('/tutor/class-groups/new') }}
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
              {student.classGroupName ? <Text style={styles.cardBody}>{student.classGroupName}</Text> : null}
              <View style={styles.actions}>
                <ActionButton
                  variant="secondary"
                  label="상세 · 메모"
                  onPress={() => navigate(`/tutor/students/${student.id}`)}
                />
              </View>
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
  headerActions: { flexDirection: 'row', gap: storybookTheme.spacing.sm, flexWrap: 'wrap', flexShrink: 1 },
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

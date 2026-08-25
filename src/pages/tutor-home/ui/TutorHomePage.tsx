import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Pill, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';

type LoadState = { status: 'loading' } | { status: 'ready'; students: TutorStudent[] } | { status: 'error' };

const STATUS_LABEL: Record<TutorStudent['status'], string> = {
  PENDING_PARENT: '부모 연결 확인 대기',
  CONFIRMED: '부모 연결 완료',
};

/**
 * 방문 선생님의 실제 홈("/tutor") - q-story-flow-prototype.tsx의 TutorHomeScreen을 이식했다.
 * 프로토타입은 today's schedule/stat 카드 여러 개를 보여줬지만, 이번 범위는 학생 로스터
 * 자체(실데이터, listTutorStudents())까지만 - 오늘 일정 계산 같은 파생 뷰는 다음 단계로 미룬다.
 */
export function TutorHomePage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated') return;
    listTutorStudents(state.token)
      .then((students) => setLoad({ status: 'ready', students }))
      .catch(() => setLoad({ status: 'error' }));
  }, [state]);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')}>
      <View style={styles.scroll}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>방문 선생님</Text>
          <Text style={styles.title} accessibilityRole="header">{state.user.displayName}님</Text>
          <Text style={styles.body}>오늘 만날 아이와 수업을 준비해 보세요.</Text>
          <ActionButton label="새 학생 등록하기" onPress={() => navigate('/tutor/students/new')} />
          <View style={styles.linkRow}>
            <Pressable accessibilityRole="link" onPress={() => navigate('/tutor/students')}>
              <Text style={styles.link}>과외생 목록 →</Text>
            </Pressable>
            <Pressable accessibilityRole="link" onPress={() => navigate('/tutor/schedule')}>
              <Text style={styles.link}>주간 일정 →</Text>
            </Pressable>
          </View>
        </View>

        {load.status === 'ready' && load.students.length === 0 && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>등록된 학생과 일정이 아직 없어요</Text>
            <Text style={styles.panelBody}>
              아이의 별명과 연령대만 먼저 입력하고, 부모님께 확인 링크를 보낸 뒤 정기 수업 시간을 설정해요.
            </Text>
          </View>
        )}

        {load.status === 'ready' && load.students.length > 0 && (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>오늘 만날 아이</Text>
            {load.students.map((student) => (
              <Pressable
                key={student.id}
                onPress={() => navigate('/tutor/students')}
                accessibilityRole="link"
                style={({ pressed }) => [styles.studentRow, pressed && styles.pressed]}
              >
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>
                    {student.name} · {student.ageBand}
                  </Text>
                  {student.classType ? <Text style={styles.studentMeta}>{student.classType}</Text> : null}
                </View>
                <Pill label={STATUS_LABEL[student.status]} tone="onDark" />
              </Pressable>
            ))}
          </View>
        )}

        {load.status === 'error' && (
          <Text style={styles.errorText}>학생 목록을 불러오지 못했어요.</Text>
        )}
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    alignItems: 'stretch',
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 10,
  },
  eyebrow: { fontSize: storybookTheme.type.xs, fontWeight: '700', color: storybookTheme.color.error, letterSpacing: 0.4 },
  title: { fontSize: storybookTheme.type.lg, fontWeight: '900', color: storybookTheme.color.onCardTitle },
  body: { fontSize: storybookTheme.type.sm, lineHeight: 21, color: storybookTheme.color.onCardBody, marginBottom: 4 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  link: { fontSize: storybookTheme.type.sm, fontWeight: '700', color: storybookTheme.color.primary },
  panel: {
    width: '100%',
    gap: 12,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  panelTitle: { fontSize: storybookTheme.type.md, fontWeight: '900', color: storybookTheme.color.onDark },
  panelBody: { fontSize: storybookTheme.type.sm, lineHeight: 20, color: storybookTheme.color.onDarkMuted },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.panelOnDarkBorder,
  },
  pressed: { opacity: 0.85 },
  studentInfo: { gap: 2 },
  studentName: { fontSize: storybookTheme.type.sm, fontWeight: '700', color: storybookTheme.color.onDark },
  studentMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onDarkMuted },
  errorText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error, textAlign: 'center' },
});

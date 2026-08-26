import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, Pill, SafeAreaView, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import { DEFAULT_BETA_STORY_ID } from '@/entities/story';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';

type LoadState = { status: 'loading' } | { status: 'ready'; students: TutorStudent[] } | { status: 'error' };

const STATUS_LABEL: Record<TutorStudent['status'], string> = {
  PENDING_PARENT: '부모 확인 대기',
  CONFIRMED: '연결됨',
};

/** 과외생 목록 - q-story-flow-prototype.tsx의 TutorStudentsScreen을 실제 로스터로 이식. */
export function TutorStudentsPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

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

  if (state.status !== 'authenticated') return null;

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
            </View>
          ))}

        {load.status === 'error' && <Text style={styles.error}>학생 목록을 불러오지 못했어요.</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.shellBackground },
  backLink: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 20 },
  backLinkText: { color: storybookTheme.color.onLightMuted, fontSize: storybookTheme.type.sm, fontWeight: '500' },
  content: {
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  title: { fontSize: storybookTheme.type.lg, fontWeight: '700', color: storybookTheme.color.onLightHeading },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
  card: {
    gap: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: storybookTheme.type.md, fontWeight: '700', color: storybookTheme.color.onCardTitle },
  cardBody: { fontSize: storybookTheme.type.sm, lineHeight: 19, color: storybookTheme.color.onCardBody },
});

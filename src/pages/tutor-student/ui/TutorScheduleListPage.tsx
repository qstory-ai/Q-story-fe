import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import { listTutorSchedules, type TutorSchedule } from '@/entities/tutor';

type LoadState = { status: 'loading' } | { status: 'ready'; schedules: TutorSchedule[] } | { status: 'error' };

const WEEKDAY_LABEL: Record<TutorSchedule['weekday'], string> = {
  MON: '월', TUE: '화', WED: '수', THU: '목', FRI: '금', SAT: '토',
};

/**
 * 주간 일정 - q-story-flow-prototype.tsx의 TutorScheduleListScreen을 이식. 프로토타입의
 * "관리" 버튼(단건 시간 변경/휴강/반복 수정)은 카피로만 존재하고 실제 구현이 없었다 - 이번
 * 범위도 목록 조회까지만이고, 개별 수정/취소는 다음 단계로 미룬다.
 */
export function TutorScheduleListPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR') {
      navigate('/', { replace: true });
      return;
    }
    listTutorSchedules(state.token)
      .then((schedules) => setLoad({ status: 'ready', schedules }))
      .catch(() => setLoad({ status: 'error' }));
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Pressable onPress={() => navigate('/tutor')} accessibilityRole="link" hitSlop={8} style={styles.backLink}>
        <Text style={styles.backLinkText}>← 홈으로</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">주간 일정</Text>

        {load.status === 'ready' && load.schedules.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>표시할 일정이 없어요</Text>
            <ActionButton label="첫 일정 만들기" onPress={() => navigate('/tutor/students/new')} />
          </View>
        )}

        {load.status === 'ready' &&
          load.schedules.map((schedule) => (
            <View key={schedule.id} style={styles.card}>
              <Text style={styles.cardTime}>
                {WEEKDAY_LABEL[schedule.weekday]}요일 {schedule.startTime}–{schedule.endTime}
              </Text>
              <Text style={styles.cardTitle}>{schedule.studentName}</Text>
              <Text style={styles.cardBody}>{schedule.location} · 매주 반복</Text>
            </View>
          ))}

        {load.status === 'error' && <Text style={styles.error}>일정을 불러오지 못했어요.</Text>}
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
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  cardTime: { fontSize: storybookTheme.type.xs, fontWeight: '700', color: storybookTheme.color.linkOnLight },
  cardTitle: { fontSize: storybookTheme.type.md, fontWeight: '700', color: storybookTheme.color.onCardTitle },
  cardBody: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onCardBody },
});

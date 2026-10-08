import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { LoadingState, Pill, storybookTheme } from '@/shared/ui';
import { classHistoryRows, listStudentClassHistory, type ClassHistoryRow } from '@/entities/class-lifecycle';

import { lifecycleStyles as styles } from './lifecycle-styles';

type Load = { key: string; status: 'loading' } | { key: string; status: 'ready'; rows: ClassHistoryRow[] } | { key: string; status: 'error' };

/**
 * 학생 상세의 반 이력 - 언제 어느 반이었는지(최신이 위). 반을 옮기거나 수료해도 기록은 이어진다. 기관 반 학생이 아니거나
 * 볼 수 없으면(403·404) 카드를 숨긴다.
 */
export function ClassHistoryCard({ token, studentId }: { token: string; studentId: string }) {
  const key = `${studentId}`;
  const [load, setLoad] = useState<Load>({ key, status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    listStudentClassHistory(token, studentId)
      .then((history) => {
        if (!cancelled) setLoad({ key, status: 'ready', rows: classHistoryRows(history) });
      })
      .catch(() => {
        if (!cancelled) setLoad({ key, status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [token, studentId, key]);

  const value: Load = load.key === key ? load : { key, status: 'loading' };
  if (value.status === 'error') return null;
  if (value.status === 'ready' && value.rows.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>반 이력</Text>
      {value.status === 'loading' ? <LoadingState compact label="반 이력을 불러오는 중이에요…" /> : null}
      {value.status === 'ready'
        ? value.rows.map((row, index) => (
            <View key={`${row.classId}:${row.period}`} style={[styles.row, index === 0 && { borderTopWidth: 0 }]}>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  alignSelf: 'flex-start',
                  marginTop: 5,
                  backgroundColor: row.current ? storybookTheme.color.primary : storybookTheme.color.pillBorder,
                }}
              />
              <View style={styles.flex}>
                <Text style={styles.rowTitle}>{row.className}</Text>
                <Text style={styles.muted}>{row.period}</Text>
                {row.note ? <Text style={styles.muted}>{row.note}</Text> : null}
              </View>
              {row.current ? <Pill label="지금 반" tone="accent" /> : row.archived ? <Pill label="지난 반" tone="onLight" /> : null}
            </View>
          ))
        : null}
      {value.status === 'ready' ? (
        <Text style={styles.muted}>반을 옮기거나 수료해도 지난 반의 수업 기록과 리포트는 아래 리포트에서 그대로 볼 수 있어요.</Text>
      ) : null}
    </View>
  );
}

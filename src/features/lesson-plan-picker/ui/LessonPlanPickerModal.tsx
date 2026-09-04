import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import {
  createTutorLessonPlan,
  listTutorStudents,
  type TutorStudent,
} from '@/entities/tutor';

type StudentsLoad =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[] }
  | { status: 'error'; message: string };

type Props = {
  visible: boolean;
  storyId: string;
  storyTitle: string;
  onClose: () => void;
  /** 성공 시 부모가 토스트/카피를 띄울 수 있게 - 없으면 그냥 close만. */
  onSuccess?: (studentName: string) => void;
};

/**
 * IA "[2] 서재 > 작품 상세 > 수업에 사용하기" 진입점. 선생님이 어떤 학생에게 이 이야기를 담을지
 * 골라 확정하면 tutor-lesson-plan을 만든다 - 같은 (학생, 이야기) 조합이 이미 있으면 서버가
 * 조용히 기존 계획을 반환하므로 사용자에게 실패로 노출되지 않는다.
 */
export function LessonPlanPickerModal({ visible, storyId, storyTitle, onClose, onSuccess }: Props) {
  const { state } = useAuth();
  const [students, setStudents] = useState<StudentsLoad>({ status: 'loading' });
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canFetch = visible && state.status === 'authenticated' && state.user.role === 'TUTOR';

  useEffect(() => {
    if (!canFetch || state.status !== 'authenticated') return;
    let cancelled = false;
    listTutorStudents(state.token)
      .then((list) => {
        if (!cancelled) setStudents({ status: 'ready', students: list });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = messageForError(failure, '학생 목록을 불러오지 못했어요.');
        setStudents({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [canFetch, state]);

  // 미인증 사용자용 파생 뷰 - fetch 상태에는 저장하지 않고 렌더 시점에만 계산한다.
  const effectiveStudents = useMemo<StudentsLoad>(
    () => (visible && state.status === 'authenticated' && state.user.role !== 'TUTOR'
      ? { status: 'error', message: '선생님 계정으로 로그인해야 이용할 수 있어요.' }
      : students),
    [visible, state, students],
  );

  async function assign(student: TutorStudent) {
    if (state.status !== 'authenticated') return;
    setSavingStudentId(student.id);
    setError(null);
    try {
      await createTutorLessonPlan(state.token, { tutorStudentId: student.id, storyId });
      onSuccess?.(student.name);
      onClose();
    } catch (failure: unknown) {
      const message = messageForError(failure, '수업 계획에 담지 못했어요.');
      setError(message);
    } finally {
      setSavingStudentId(null);
    }
  }

  return (
    <Modal
      visible={visible}
      accessibilityLabel="수업에 사용할 학생 선택"
      eyebrow="수업에 사용하기"
      title={`${storyTitle}을(를) 어떤 아이 수업에 담을까요?`}
      linkAction={{ label: '취소', onPress: onClose }}
    >
      <View style={styles.body}>
        {effectiveStudents.status === 'loading' ? (
          <Text style={styles.helper}>학생 목록을 불러오는 중이에요…</Text>
        ) : effectiveStudents.status === 'error' ? (
          <Text style={[styles.helper, styles.errorText]}>{effectiveStudents.message}</Text>
        ) : effectiveStudents.students.length === 0 ? (
          <Text style={styles.helper}>등록된 학생이 없어요. 학생을 먼저 등록해 주세요.</Text>
        ) : (
          <View style={styles.list}>
            {effectiveStudents.students.map((student) => (
              <Pressable
                key={student.id}
                accessibilityRole="button"
                accessibilityLabel={`${student.name} 수업에 담기`}
                onPress={() => assign(student)}
                disabled={savingStudentId !== null}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowName}>{student.name}</Text>
                  <Text style={styles.rowMeta}>{student.ageBand}{student.classType ? ` · ${student.classType}` : ''}</Text>
                </View>
                <Text style={styles.action}>
                  {savingStudentId === student.id ? '담는 중…' : '담기'}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12 },
  helper: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 14,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
  },
  pressed: { opacity: 0.85 },
  rowBody: { flex: 1, gap: 2 },
  rowName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  rowMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  action: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});

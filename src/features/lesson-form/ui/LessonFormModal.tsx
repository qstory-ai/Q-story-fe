import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Modal, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import { createLesson, type Lesson } from '@/entities/lesson';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreated?: (lesson: Lesson) => void;
};

type RefsLoad =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[]; stories: StoryCatalogEntry[] }
  | { status: 'error'; message: string };

/**
 * IA "새 수업 만들기" 스텝을 한 모달에 담는다: 이름/목표(선택)/일정(선택) + 참여 학생 + 사용
 * 이야기. 학생과 이야기는 각각 체크리스트로 여러 개 선택할 수 있어서, "한 수업에 여러 학생/
 * 여러 이야기" 요구를 그대로 반영. 실패 시 폼 값은 유지되고 에러만 표시.
 */
export function LessonFormModal({ visible, onClose, onCreated }: Props) {
  const { state } = useAuth();
  const [refs, setRefs] = useState<RefsLoad>({ status: 'loading' });
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [scheduledAtInput, setScheduledAtInput] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length > 0 && !submitting, [name, submitting]);

  useEffect(() => {
    if (!visible) return;
    if (state.status !== 'authenticated') return;
    let cancelled = false;
    Promise.all([listTutorStudents(state.token), listStories()])
      .then(([students, stories]) => {
        if (!cancelled) setRefs({ status: 'ready', students, stories });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        const message = failure instanceof Error ? failure.message : '학생·이야기 목록을 불러오지 못했어요.';
        setRefs({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [visible, state]);

  async function handleSubmit() {
    if (!canSubmit || state.status !== 'authenticated') return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await createLesson(state.token, {
        name: name.trim(),
        goal: goal.trim() || null,
        scheduledAt: parseDateTime(scheduledAtInput),
        studentIds: Array.from(selectedStudentIds),
        storyIds: Array.from(selectedStoryIds),
      });
      onCreated?.(created);
      // 성공 시 폼 초기화하고 닫는다.
      setName('');
      setGoal('');
      setScheduledAtInput('');
      setSelectedStudentIds(new Set());
      setSelectedStoryIds(new Set());
      onClose();
    } catch (failure: unknown) {
      const message = failure instanceof Error ? failure.message : '수업을 만들지 못했어요.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function toggleStudent(id: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleStory(id: string) {
    setSelectedStoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <Modal
      visible={visible}
      accessibilityLabel="새 수업 만들기"
      eyebrow="새 수업"
      title="새 수업 만들기"
      positiveAction={{
        label: submitting ? '만드는 중…' : '수업 만들기',
        onPress: handleSubmit,
        disabled: !canSubmit,
        loading: submitting,
      }}
      negativeAction={{ label: '취소', onPress: onClose, disabled: submitting }}
    >
      <View style={styles.body}>
        <TextField
          label="수업 이름"
          value={name}
          onChangeText={setName}
          placeholder="예: 화요일 오후 반"
          maxLength={80}
        />
        <TextareaField
          label="수업 목표 (선택)"
          value={goal}
          onChangeText={setGoal}
          placeholder="예: 헨젤과 그레텔에서 아이의 질문을 세 개 이상 이끌어내기"
        />
        <TextField
          label="수업 일정 (선택)"
          value={scheduledAtInput}
          onChangeText={setScheduledAtInput}
          placeholder="예: 2026-03-05 15:00"
          description="YYYY-MM-DD HH:MM 형식으로 적어 주세요. 비워 두면 일정 미정으로 저장돼요."
        />

        <View style={styles.group}>
          <Text style={styles.groupLabel}>참여 학생</Text>
          {refs.status === 'loading' ? (
            <Text style={styles.helper}>학생 목록을 불러오는 중이에요…</Text>
          ) : refs.status === 'error' ? (
            <Text style={styles.errorText}>{refs.message}</Text>
          ) : refs.students.length === 0 ? (
            <Text style={styles.helper}>등록된 학생이 없어요. 학생을 먼저 등록해 주세요.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {refs.students.map((student) => {
                const selected = selectedStudentIds.has(student.id);
                return (
                  <Pressable
                    key={student.id}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleStudent(student.id)}
                    style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {student.name} · {student.ageBand}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.group}>
          <Text style={styles.groupLabel}>사용 이야기</Text>
          {refs.status === 'loading' ? (
            <Text style={styles.helper}>이야기 목록을 불러오는 중이에요…</Text>
          ) : refs.status === 'ready' && refs.stories.length === 0 ? (
            <Text style={styles.helper}>등록된 이야기가 없어요.</Text>
          ) : refs.status === 'ready' ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {refs.stories.map((story) => {
                const selected = selectedStoryIds.has(story.storyId);
                return (
                  <Pressable
                    key={story.storyId}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    onPress={() => toggleStory(story.storyId)}
                    style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{story.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

/**
 * "YYYY-MM-DD HH:MM" 형태를 ISO 문자열로 변환. 빈 값이면 null. 파싱 실패도 null(BE가 null로
 * 받으면 "일정 미정"으로 저장하므로 사용자를 막지 않는다) - 다만 조금 나은 UX를 위해 앞으로
 * 일정 입력을 정식 date-picker로 교체할 예정.
 */
function parseDateTime(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

const styles = StyleSheet.create({
  body: { gap: 14 },
  group: { gap: 8 },
  groupLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  helper: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  chipPressed: { opacity: 0.85 },
  chipLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  chipLabelSelected: { color: storybookTheme.color.onDark },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});

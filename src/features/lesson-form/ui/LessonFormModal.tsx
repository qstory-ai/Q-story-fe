import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Modal, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useAuth } from '@/entities/auth';
import { createLesson, updateLesson, type Lesson } from '@/entities/lesson';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 기존 lesson을 편집할 때 - undefined면 새 수업 만들기 모드. 저장 성공은 onSaved로 전달된다. */
  editing?: Lesson | null;
  /** 새로 만든 lesson - 편집 모드에서는 호출되지 않는다(대신 onSaved). */
  onCreated?: (lesson: Lesson) => void;
  /** 편집 저장 성공 시 호출 - 상세 페이지가 로컬 상태를 갱신할 수 있게. */
  onSaved?: (lesson: Lesson) => void;
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
export function LessonFormModal({ visible, onClose, editing, onCreated, onSaved }: Props) {
  const { state } = useAuth();
  const [refs, setRefs] = useState<RefsLoad>({ status: 'loading' });
  // 초기값을 editing prop에서 lazy-init으로 뽑는다 - useEffect로 prop을 state에 sync하면
  // react-hooks/set-state-in-effect에 걸리기 때문. 편집 대상이 바뀔 때는 부모가 `key={lessonId}`
  // 로 이 컴포넌트를 remount 시켜 initial state를 다시 계산하도록 한다(부모 호출부에 명시).
  const [name, setName] = useState(() => editing?.name ?? '');
  const [goal, setGoal] = useState(() => editing?.goal ?? '');
  const [scheduledAtInput, setScheduledAtInput] = useState(() =>
    editing?.scheduledAt ? formatDateTimeForInput(editing.scheduledAt) : '',
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    () => new Set(editing?.students.map((s) => s.id) ?? []),
  );
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(
    () => new Set(editing?.storyIds ?? []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing != null;
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
        const message = messageForError(failure, '학생·이야기 목록을 불러오지 못했어요.');
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
      const input = {
        name: name.trim(),
        goal: goal.trim() || null,
        scheduledAt: parseDateTime(scheduledAtInput),
        studentIds: Array.from(selectedStudentIds),
        storyIds: Array.from(selectedStoryIds),
      };
      if (editing) {
        const updated = await updateLesson(state.token, editing.id, input);
        onSaved?.(updated);
      } else {
        const created = await createLesson(state.token, input);
        onCreated?.(created);
      }
      // 성공 시 폼 초기화하고 닫는다. editing 모드에서도 리셋 - 다음 열림에서 useEffect가 다시
      // 값을 채우거나 비운다.
      setName('');
      setGoal('');
      setScheduledAtInput('');
      setSelectedStudentIds(new Set());
      setSelectedStoryIds(new Set());
      onClose();
    } catch (failure: unknown) {
      setError(messageForError(failure, editing ? '수업을 저장하지 못했어요.' : '수업을 만들지 못했어요.'));
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
      accessibilityLabel={isEdit ? '수업 편집' : '새 수업 만들기'}
      eyebrow={isEdit ? '수업 편집' : '새 수업'}
      title={isEdit ? '수업 편집' : '새 수업 만들기'}
      positiveAction={{
        label: submitting ? (isEdit ? '저장 중…' : '만드는 중…') : (isEdit ? '변경 저장' : '수업 만들기'),
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

/**
 * ISO 문자열(BE 응답)을 편집 입력 placeholder 형식("YYYY-MM-DD HH:MM")으로 되돌린다 -
 * parseDateTime의 역함수. Date를 로컬 타임존 기준으로 formatting해서 저장했던 그대로의
 * 시각을 사용자가 다시 보게 한다.
 */
function formatDateTimeForInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

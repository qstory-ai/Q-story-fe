import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { Modal, TextField, TextareaField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { TUTOR_PATHS, useAuth } from '@/entities/auth';
import { createLesson, updateLesson, type Lesson } from '@/entities/lesson';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';
import { TutorClassPicker } from '@/features/tutor-class-picker';

import {
  DEFAULT_RECURRING_COUNT,
  MAX_RECURRING_COUNT,
  WEEKDAY_LABELS,
  computeRecurringDates,
  defaultFirstLessonInput,
  describeRecurrence,
  formatDateTimeForInput,
  parseDateTime,
  parseLessonDateTime,
} from '../lib/lesson-schedule';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 기존 lesson을 편집할 때 - undefined면 새 수업 만들기 모드. 저장 성공은 onSaved로 전달된다. */
  editing?: Lesson | null;
  /** 새로 만든 lesson - 편집 모드에서는 호출되지 않는다(대신 onSaved). */
  onCreated?: (lesson: Lesson) => void;
  /** 편집 저장 성공 시 호출 - 상세 페이지가 로컬 상태를 갱신할 수 있게. */
  onSaved?: (lesson: Lesson) => void;
  /** 새 수업을 특정 반에서 만들 때 그 반을 미리 고른다(반 상세). 편집 모드에서는 쓰지 않는다. */
  initialClass?: { id: string; name: string } | null;
};

type RefsLoad =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[]; stories: StoryCatalogEntry[] }
  | { status: 'error'; message: string };

/**
 * 새 수업 만들기 / 수업 편집 모달. 수업은 언제나 반 수업이다(1:1 과외도 아이 한 명짜리 반).
 *
 * <p>Q-35에서 만들기 단계를 줄였다: 반 → 첫 수업 일시(텍스트 "YYYY-MM-DD HH:MM") → 반복(기본 "매주 12회")만 정하면
 * 된다. 수업 이름은 비워 두면 "{반 이름} 수업", 요일은 첫 수업의 요일, 참여 학생은 반 학생 전원이다. 여러 요일·
 * 종료일·수업 목표는 "자세히"를 펼쳐서 정한다(기능은 그대로).
 */
export function LessonFormModal({ visible, onClose, editing, onCreated, onSaved, initialClass }: Props) {
  const navigate = useNavigate();
  const { state } = useAuth();
  const token = state.status === 'authenticated' ? state.token : null;
  const [refs, setRefs] = useState<RefsLoad>({ status: 'loading' });
  // 초기값은 editing에서 lazy-init - 편집 대상이 바뀌면 부모가 key로 remount시킨다.
  const [name, setName] = useState(() => editing?.name ?? '');
  const [className, setClassName] = useState(() => (editing ? '' : (initialClass?.name ?? '')));
  const [goal, setGoal] = useState(() => editing?.goal ?? '');
  // 편집: 그 회차의 일시(비우면 일정 미정). 새 수업: 첫 수업 일시(기본 오늘 15:00).
  const [dateTimeInput, setDateTimeInput] = useState(() =>
    editing ? (editing.scheduledAt ? formatDateTimeForInput(editing.scheduledAt) : '') : defaultFirstLessonInput(new Date()),
  );
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(
    () => new Set(editing?.students.map((s) => s.id) ?? []),
  );
  const [selectedStoryIds, setSelectedStoryIds] = useState<Set<string>>(
    () => new Set(editing?.storyIds ?? []),
  );
  // 반을 고르면 그 반의 학생이 참여 학생으로 자동 선택된다(BE도 studentIds가 비어 오면 반 학생으로
  // 채우지만 화면에서 바로 보이게). 결석한 아이는 참여 학생 칩에서 빼면 된다.
  const [classGroupId, setClassGroupId] = useState<string | null>(() => editing?.classGroupId ?? initialClass?.id ?? null);
  // 학생 목록이 반보다 늦게 오면(반이 하나라 자동으로 골라진 경우) 도착했을 때 반 학생을 채운다.
  const [studentsSeededFor, setStudentsSeededFor] = useState<string | null>(() => editing?.classGroupId ?? null);
  const needsClass = !classGroupId;
  // 수업 형태 - 신규 생성 기본값은 정기(매주 12회). 편집은 언제나 회차 하나만 고친다.
  const [kind, setKind] = useState<'RECURRING' | 'ONE_OFF'>(() => (editing != null ? 'ONE_OFF' : 'RECURRING'));
  // 정기 수업 회차(seriesId 있음) 편집 시 적용 범위 - "향후 모든 수업"이면 같은 시리즈의 이후
  // 예정 회차에도 변경을 반영한다(BE LessonService.applyToFutureSiblings). 회차마다 별도 Lesson이라
  // 조용한 기본값은 혼란을 주므로 null로 시작해 명시적으로 고르기 전엔 저장을 막는다.
  const [applyScope, setApplyScope] = useState<'THIS' | 'FUTURE' | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  // 비어 있으면 첫 수업의 요일 하나("매주 같은 요일").
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set());
  const [endCount, setEndCount] = useState(String(DEFAULT_RECURRING_COUNT));
  const [endDateInput, setEndDateInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing != null;
  const isSeriesEdit = isEdit && editing?.seriesId != null;
  const firstLesson = useMemo(() => parseLessonDateTime(dateTimeInput), [dateTimeInput]);
  const recurringDates = useMemo(() => {
    if (isEdit || kind !== 'RECURRING') return [];
    return computeRecurringDates({
      firstLesson: dateTimeInput,
      count: Number(endCount) || 0,
      weekdays,
      endDate: endDateInput.trim() || undefined,
    });
  }, [isEdit, kind, dateTimeInput, endCount, weekdays, endDateInput]);
  const lessonName = name.trim() || (className ? `${className} 수업` : '');
  // 단발·편집은 비우면 "일정 미정"으로 저장되지만, 무언가 적었는데 형식이 틀리면 조용히 미정으로 넘기지 않는다.
  const dateTimeInvalid = dateTimeInput.trim().length > 0 && firstLesson == null;

  const canSubmit =
    !submitting
    && lessonName.length > 0
    && !(kind === 'RECURRING' && !isEdit && recurringDates.length === 0)
    && !dateTimeInvalid
    && !(isSeriesEdit && applyScope === null)
    && !needsClass;

  // auth state 객체 전체가 아니라 token에만 의존해야 프로필 갱신 등으로 목록을 다시 받지 않는다.
  useEffect(() => {
    if (!visible || !token) return;
    let cancelled = false;
    Promise.all([listTutorStudents(token), listStories()])
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
  }, [visible, token]);

  const pickClass = useCallback((nextClassGroupId: string, nextClassName: string) => {
    setClassGroupId(nextClassGroupId);
    setClassName(nextClassName);
  }, []);

  // 반이 바뀌었거나 학생 목록이 막 도착했으면 그 반 학생 전원을 참여 학생으로 채운다(렌더 중 파생 상태 갱신).
  if (refs.status === 'ready' && classGroupId && studentsSeededFor !== classGroupId) {
    setStudentsSeededFor(classGroupId);
    setSelectedStudentIds(
      new Set(refs.students.filter((student) => student.classGroupId === classGroupId).map((student) => student.id)),
    );
  }

  async function handleSubmit() {
    if (!canSubmit || state.status !== 'authenticated') return;
    setSubmitting(true);
    setSubmitProgress(null);
    setError(null);
    try {
      const baseInput = {
        name: lessonName,
        goal: goal.trim() || null,
        studentIds: Array.from(selectedStudentIds),
        storyIds: Array.from(selectedStoryIds),
        classGroupId: classGroupId ?? undefined,
      };
      if (editing) {
        const updated = await updateLesson(state.token, editing.id, {
          ...baseInput,
          scheduledAt: parseDateTime(dateTimeInput),
          applyToFutureInSeries: editing.seriesId != null && applyScope === 'FUTURE',
        });
        onSaved?.(updated);
      } else if (kind === 'ONE_OFF') {
        const created = await createLesson(state.token, {
          ...baseInput,
          scheduledAt: parseDateTime(dateTimeInput),
        });
        onCreated?.(created);
      } else {
        // 정기 수업 - 계산된 각 datetime마다 개별 Lesson을 만든다. 하나씩 기다리면 12회에 10초쯤
        // 걸려서, BE rate limit을 넘지 않게 몇 개씩 묶어 병렬로 보낸다. 실패는 그 묶음에서 중단
        // (부분 성공은 상세 페이지에서 정리).
        // seriesId는 이 제출 하나에서만 쓰는 클라이언트 생성 UUID - N번의 create 호출 전체가
        // 같은 값을 실어 보내야 나중에 "향후 모든 수업 수정"으로 형제들을 함께 찾을 수 있다.
        const dates = recurringDates;
        const seriesId = crypto.randomUUID();
        setSubmitProgress({ done: 0, total: dates.length });
        let lastCreated: Lesson | null = null;
        let done = 0;
        for (let i = 0; i < dates.length; i += RECURRING_CREATE_CONCURRENCY) {
          const batch = await Promise.all(
            dates.slice(i, i + RECURRING_CREATE_CONCURRENCY).map((scheduledAt) =>
              createLesson(state.token, { ...baseInput, scheduledAt, seriesId }).then((created) => {
                done += 1;
                setSubmitProgress({ done, total: dates.length });
                return created;
              }),
            ),
          );
          lastCreated = batch[batch.length - 1] ?? lastCreated;
        }
        // onCreated는 부모 리스트 refresh용이라 마지막 lesson 하나만 전달해도 문제없다 -
        // 부모는 이 콜백 이후 listLessons를 다시 호출해 전체를 새로 받는다.
        if (lastCreated) onCreated?.(lastCreated);
      }
      // 부모가 닫힘 상태로 key를 바꿔 remount하므로 폼을 따로 비우지 않는다.
      onClose();
    } catch (failure: unknown) {
      const fallback = editing
        ? '수업을 저장하지 못했어요.'
        : kind === 'RECURRING'
          ? '정기 수업을 만드는 중 오류가 났어요. 이미 만들어진 회차는 유지돼요.'
          : '수업을 만들지 못했어요.';
      setError(messageForError(failure, fallback));
    } finally {
      setSubmitting(false);
      setSubmitProgress(null);
    }
  }

  const recurrenceSummary = describeRecurrence(recurringDates, weekdays.size > 0 ? weekdays : null);

  return (
    <Modal
      visible={visible}
      accessibilityLabel={isEdit ? '수업 편집' : '새 수업 만들기'}
      eyebrow={isEdit ? '수업 편집' : '새 수업'}
      title={isEdit ? '수업 편집' : '새 수업 만들기'}
      positiveAction={{
        label: submitting
          ? (submitProgress
              ? `${submitProgress.done}/${submitProgress.total} 만드는 중…`
              : (isEdit ? '저장 중…' : '만드는 중…'))
          : (isEdit
              ? (isSeriesEdit && applyScope === 'FUTURE' ? '향후 수업까지 저장' : '변경 저장')
              : kind === 'RECURRING' && recurringDates.length > 0
                ? `${recurringDates.length}회 수업 만들기`
                : '수업 만들기'),
        onPress: handleSubmit,
        disabled: !canSubmit,
        loading: submitting,
      }}
      negativeAction={{ label: '취소', onPress: onClose, disabled: submitting }}
    >
      <View style={styles.body}>
        {state.status === 'authenticated' ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>반</Text>
            <TutorClassPicker
              token={state.token}
              value={classGroupId}
              onChange={pickClass}
              onCreateClass={() => {
                onClose();
                navigate(TUTOR_PATHS.newClass);
              }}
            />
          </View>
        ) : null}

        <TextField
          label={isEdit ? '수업 이름' : '수업 이름 (선택)'}
          value={name}
          onChangeText={setName}
          placeholder={className ? `비워 두면 "${className} 수업"` : '예: 목요일 동화 수업'}
          maxLength={80}
        />

        {/* 정기 수업의 한 회차를 편집할 때만. applyScope가 null이면 저장 비활성(canSubmit). */}
        {isSeriesEdit ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>적용 범위 (선택 필요)</Text>
            <ChoiceRow
              options={[
                { value: 'THIS', label: '이 수업만' },
                { value: 'FUTURE', label: '이 수업과 향후 모든 수업' },
              ]}
              value={applyScope}
              onChange={setApplyScope}
            />
            {applyScope === null ? (
              <Text style={styles.helper}>
                정기 수업은 회차마다 따로 저장돼요. 학생·이야기 변경을 앞으로의 다른 회차에도
                반영할지 먼저 골라 주세요.
              </Text>
            ) : applyScope === 'FUTURE' ? (
              <Text style={styles.helper}>
                이름·목표·학생·이야기 변경과 시각 이동은 같은 정기 수업 중 아직 진행 전인 앞으로의
                회차에도 함께 반영돼요. 요일·주기 자체는 바뀌지 않아요.
              </Text>
            ) : (
              <Text style={styles.helper}>이 회차에만 반영돼요. 다른 회차는 그대로 남아요.</Text>
            )}
          </View>
        ) : null}

        <TextField
          label={!isEdit && kind === 'RECURRING' ? '첫 수업 일시' : '수업 일시 (선택)'}
          value={dateTimeInput}
          onChangeText={setDateTimeInput}
          placeholder="예: 2026-03-05 15:00"
          description={
            !isEdit && kind === 'RECURRING'
              ? 'YYYY-MM-DD HH:MM 형식으로 적어 주세요. 이 날부터 같은 요일·시각으로 반복해요.'
              : 'YYYY-MM-DD HH:MM 형식으로 적어 주세요. 비워 두면 일정 미정으로 저장돼요.'
          }
          errorText={dateTimeInvalid ? '날짜를 2026-03-05 15:00처럼 적어 주세요.' : undefined}
        />

        {!isEdit ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>반복</Text>
            <ChoiceRow
              options={[
                { value: 'RECURRING', label: '매주 반복' },
                { value: 'ONE_OFF', label: '한 번만' },
              ]}
              value={kind}
              onChange={setKind}
            />
            {kind === 'RECURRING' ? (
              <>
                <TextField
                  label="총 회차"
                  value={endCount}
                  onChangeText={setEndCount}
                  placeholder={String(DEFAULT_RECURRING_COUNT)}
                  description={`최대 ${MAX_RECURRING_COUNT}회. 자세히에서 종료일을 정하면 그날까지 만들어요.`}
                  keyboardType="numeric"
                />
                <Text style={styles.helper}>
                  {recurrenceSummary ?? '첫 수업 일시와 회차를 확인해 주세요. 아직 만들 수 있는 수업이 없어요.'}
                </Text>
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.group}>
          <Text style={styles.groupLabel}>참여 학생</Text>
          {refs.status === 'loading' ? (
            <Text style={styles.helper}>학생 목록을 불러오는 중이에요…</Text>
          ) : refs.status === 'error' ? (
            <Text style={styles.errorText}>{refs.message}</Text>
          ) : !classGroupId ? (
            <Text style={styles.helper}>반을 고르면 그 반의 아이들이 참여 학생으로 선택돼요.</Text>
          ) : refs.students.every((student) => student.classGroupId !== classGroupId) ? (
            <Text style={styles.helper}>
              아직 반에 들어온 아이가 없어요. 반 초대 링크로 보호자가 아이를 연결하면 이 수업에 자동으로 참여해요.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {refs.students.filter((student) => student.classGroupId === classGroupId).map((student) => {
                const selected = selectedStudentIds.has(student.id);
                return (
                  <Pressable
                    key={student.id}
                    accessibilityRole="checkbox"
                    aria-checked={selected}
                    onPress={() => setSelectedStudentIds((prev) => toggleInSet(prev, student.id))}
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
          <Text style={styles.groupLabel}>사용 이야기 (선택)</Text>
          <Text style={styles.helper}>비워 두면 수업 날 서재에서 이야기를 시작할 때 정해져요.</Text>
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
                    aria-checked={selected}
                    onPress={() => setSelectedStoryIds((prev) => toggleInSet(prev, story.storyId))}
                    style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{story.title}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </View>

        <Pressable
          accessibilityRole="button"
          aria-expanded={showDetails}
          onPress={() => setShowDetails((open) => !open)}
          style={styles.detailsToggle}
        >
          <Text style={styles.detailsToggleLabel}>
            {showDetails
              ? '자세히 접기'
              : !isEdit && kind === 'RECURRING'
                ? '요일·종료일·수업 목표 자세히'
                : '수업 목표 적기'}
          </Text>
        </Pressable>

        {showDetails || (isEdit && goal.trim().length > 0) ? (
          <View style={styles.detailsBlock}>
            {!isEdit && kind === 'RECURRING' ? (
              <>
                <View style={styles.group}>
                  <Text style={styles.groupLabel}>반복 요일</Text>
                  <Text style={styles.helper}>따로 고르지 않으면 첫 수업의 요일에만 해요.</Text>
                  <View style={styles.weekdayRow}>
                    {WEEKDAY_LABELS.map((label, day) => {
                      const selected = weekdays.size > 0 ? weekdays.has(day) : firstLesson?.getDay() === day;
                      return (
                        <Pressable
                          key={day}
                          accessibilityRole="checkbox"
                          aria-checked={selected}
                          onPress={() =>
                            setWeekdays((prev) => {
                              // 처음 누를 때는 지금 보이는 선택(첫 수업 요일)에서 출발한다.
                              const base = prev.size > 0 || !firstLesson ? prev : new Set([firstLesson.getDay()]);
                              return toggleInSet(base, day);
                            })
                          }
                          style={({ pressed }) => [
                            styles.weekdayChip,
                            selected && styles.weekdayChipSelected,
                            day === 0 && !selected && styles.weekdayChipSunday,
                            day === 6 && !selected && styles.weekdayChipSaturday,
                            pressed && styles.chipPressed,
                          ]}
                        >
                          <Text style={[styles.weekdayChipLabel, selected && styles.weekdayChipLabelSelected]}>
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
                <TextField
                  label="종료 날짜 (선택)"
                  value={endDateInput}
                  onChangeText={setEndDateInput}
                  placeholder="예: 2026-06-30"
                  description="YYYY-MM-DD 형식. 적으면 회차 대신 이 날짜(포함)까지 만들어요."
                />
              </>
            ) : null}
            <TextareaField
              label="수업 목표 (선택)"
              value={goal}
              onChangeText={setGoal}
              placeholder="예: 헨젤과 그레텔에서 아이의 질문을 세 개 이상 이끌어내기"
            />
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    </Modal>
  );
}

/** 정기 수업 회차를 한 번에 몇 개씩 만들지 - 순차(1)는 너무 느리고, 한꺼번에 60개는 rate limit 위험. */
const RECURRING_CREATE_CONCURRENCY = 4;

function ChoiceRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.kindRow}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            aria-checked={selected}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.kindOption,
              selected && styles.kindOptionSelected,
              pressed && styles.chipPressed,
            ]}
          >
            <Text style={[styles.kindOptionLabel, selected && styles.kindOptionLabelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function toggleInSet<T>(prev: Set<T>, value: T): Set<T> {
  const next = new Set(prev);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
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
  // 선택된 칩 배경이 primary(#1E293B)라 글자는 흰색 - onContent(같은 #1E293B)였을 땐 글자가 안 보였다.
  chipLabelSelected: { color: storybookTheme.color.onDark },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
  kindRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  kindOption: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentSurface,
  },
  kindOptionSelected: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  kindOptionLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContentMuted,
  },
  kindOptionLabelSelected: { color: storybookTheme.color.onDark },
  detailsToggle: { alignSelf: 'flex-start', paddingVertical: 4 },
  detailsToggleLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
    textDecorationLine: 'underline',
  },
  detailsBlock: {
    gap: 14,
    padding: 14,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  // 일~토 7칸을 한 줄에 나눠 담는다 - wrap이면 390px 폭에서 "토"만 아랫줄로 떨어졌다.
  weekdayRow: { flexDirection: 'row', gap: 6 },
  weekdayChip: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: storybookTheme.color.contentSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayChipSelected: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  weekdayChipSunday: { borderColor: 'rgba(255, 154, 162, 0.6)' },
  weekdayChipSaturday: { borderColor: 'rgba(158, 200, 255, 0.6)' },
  weekdayChipLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  weekdayChipLabelSelected: { color: storybookTheme.color.onDark },
});

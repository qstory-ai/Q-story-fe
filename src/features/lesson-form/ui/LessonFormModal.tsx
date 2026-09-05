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
  // 수업 형태 - 신규 생성 시 기본값은 '정기'(사용자 관행 상 대부분 반복). 편집 모드는 강제
  // '단발성'(=단일 Lesson 하나 수정)만 지원. 정기 → 단발 변환은 데이터 손실이 있어 UI에서 잠금.
  const [kind, setKind] = useState<'RECURRING' | 'ONE_OFF'>(() =>
    editing != null ? 'ONE_OFF' : 'RECURRING',
  );
  // 편집 대상이 정기 수업의 한 회차(seriesId 있음)일 때만 의미 있는 선택 - "이 수업만" 저장하면
  // 이 Lesson 하나만, "향후 모든 수업"이면 같은 시리즈에서 아직 예정 상태이고 이 수업과 같거나
  // 이후 시각인 형제들에도 이름/목표/학생/이야기 변경과 시각 이동량을 함께 반영한다(BE의
  // LessonService.applyToFutureSiblings 참고).
  const [applyScope, setApplyScope] = useState<'THIS' | 'FUTURE'>('THIS');
  // 정기 수업: 다중 요일 선택 (0=일 ... 6=토). 기본은 오늘 요일 하나만.
  const [weekdays, setWeekdays] = useState<Set<number>>(() => new Set([new Date().getDay()]));
  const [startTime, setStartTime] = useState('15:00');
  const [startDateInput, setStartDateInput] = useState(() => formatDateOnly(new Date()));
  const [endMode, setEndMode] = useState<'COUNT' | 'DATE'>('COUNT');
  const [endCount, setEndCount] = useState('12'); // "12회" - 학기 3개월 기준 근사치
  const [endDateInput, setEndDateInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isEdit = editing != null;
  const recurringPreviewCount = useMemo(() => {
    if (kind !== 'RECURRING') return 0;
    return computeRecurringDates({
      startDate: startDateInput,
      startTime,
      weekdays,
      endMode,
      endCount: Number(endCount) || 0,
      endDate: endDateInput,
    }).length;
  }, [kind, startDateInput, startTime, weekdays, endMode, endCount, endDateInput]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (name.trim().length === 0) return false;
    if (kind === 'RECURRING' && recurringPreviewCount === 0) return false;
    return true;
  }, [name, submitting, kind, recurringPreviewCount]);

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
    setSubmitProgress(null);
    setError(null);
    const baseInput = {
      name: name.trim(),
      goal: goal.trim() || null,
      studentIds: Array.from(selectedStudentIds),
      storyIds: Array.from(selectedStoryIds),
    };
    try {
      if (editing) {
        const updated = await updateLesson(state.token, editing.id, {
          ...baseInput,
          scheduledAt: parseDateTime(scheduledAtInput),
          applyToFutureInSeries: editing.seriesId != null && applyScope === 'FUTURE',
        });
        onSaved?.(updated);
      } else if (kind === 'ONE_OFF') {
        const created = await createLesson(state.token, {
          ...baseInput,
          scheduledAt: parseDateTime(scheduledAtInput),
        });
        onCreated?.(created);
      } else {
        // 정기 수업 - 계산된 각 datetime마다 개별 Lesson을 순차 생성한다. Promise.all로 병렬
        // 화하지 않는 이유: BE에 rate limit이 걸려 있을 수 있고, 진행률을 사용자에게 정확히
        // 보여 주려면 순차가 편하다. 실패는 곧바로 중단(부분 성공은 상세 페이지에서 정리).
        // seriesId는 이 제출 하나에서만 쓰는 클라이언트 생성 UUID - N번의 create 호출 전체가
        // 같은 값을 실어 보내야 나중에 "향후 모든 수업 수정"으로 형제들을 함께 찾을 수 있다.
        const dates = computeRecurringDates({
          startDate: startDateInput,
          startTime,
          weekdays,
          endMode,
          endCount: Number(endCount) || 0,
          endDate: endDateInput,
        });
        const seriesId = crypto.randomUUID();
        setSubmitProgress({ done: 0, total: dates.length });
        let lastCreated: Lesson | null = null;
        for (let i = 0; i < dates.length; i += 1) {
          const created = await createLesson(state.token, {
            ...baseInput,
            scheduledAt: dates[i],
            seriesId,
          });
          lastCreated = created;
          setSubmitProgress({ done: i + 1, total: dates.length });
        }
        // onCreated는 부모 리스트 refresh용이라 마지막 lesson 하나만 전달해도 문제없다 -
        // 부모는 이 콜백 이후 listLessons를 다시 호출해 전체를 새로 받는다.
        if (lastCreated) onCreated?.(lastCreated);
      }
      // 성공 시 폼 초기화하고 닫는다. editing 모드에서도 리셋 - 다음 열림에서 useEffect가 다시
      // 값을 채우거나 비운다.
      setName('');
      setGoal('');
      setScheduledAtInput('');
      setSelectedStudentIds(new Set());
      setSelectedStoryIds(new Set());
      setApplyScope('THIS');
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

  function toggleWeekday(day: number) {
    setWeekdays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day); else next.add(day);
      return next;
    });
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
        label: submitting
          ? (submitProgress
              ? `${submitProgress.done}/${submitProgress.total} 만드는 중…`
              : (isEdit ? '저장 중…' : '만드는 중…'))
          : (isEdit
              ? (editing?.seriesId != null && applyScope === 'FUTURE' ? '향후 수업까지 저장' : '변경 저장')
              : kind === 'RECURRING' && recurringPreviewCount > 0
                ? `${recurringPreviewCount}회 수업 만들기`
                : '수업 만들기'),
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
        {/* 수업 형태 - 신규 생성 시만. 편집은 항상 단일 lesson이라 토글 숨김. */}
        {!isEdit ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>수업 형태</Text>
            <View style={styles.kindRow}>
              {(['RECURRING', 'ONE_OFF'] as const).map((option) => {
                const selected = kind === option;
                const label = option === 'RECURRING' ? '정기 수업' : '단발성 수업';
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setKind(option)}
                    style={({ pressed }) => [
                      styles.kindOption,
                      selected && styles.kindOptionSelected,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={[styles.kindOptionLabel, selected && styles.kindOptionLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* 정기 수업의 한 회차를 편집할 때만 - 단발성 수업이나 시리즈 없는 편집엔 의미가 없다. */}
        {isEdit && editing?.seriesId != null ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>적용 범위</Text>
            <View style={styles.kindRow}>
              {(['THIS', 'FUTURE'] as const).map((option) => {
                const selected = applyScope === option;
                const label = option === 'THIS' ? '이 수업만' : '이 수업과 향후 모든 수업';
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setApplyScope(option)}
                    style={({ pressed }) => [
                      styles.kindOption,
                      selected && styles.kindOptionSelected,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={[styles.kindOptionLabel, selected && styles.kindOptionLabelSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {applyScope === 'FUTURE' ? (
              <Text style={styles.helper}>
                이름·목표·학생·이야기 변경과 시각 이동은 같은 정기 수업 중 아직 진행 전인 앞으로의
                회차에도 함께 반영돼요. 요일·주기 자체는 바뀌지 않아요.
              </Text>
            ) : null}
          </View>
        ) : null}

        {/* 단발성: 예전 그대로 단일 datetime 입력. 편집도 이 분기 사용. */}
        {isEdit || kind === 'ONE_OFF' ? (
          <TextField
            label="수업 일정 (선택)"
            value={scheduledAtInput}
            onChangeText={setScheduledAtInput}
            placeholder="예: 2026-03-05 15:00"
            description="YYYY-MM-DD HH:MM 형식으로 적어 주세요. 비워 두면 일정 미정으로 저장돼요."
          />
        ) : null}

        {/* 정기: 요일 + 시작 시간 + 시작일 + 종료 조건. 아래 실제로 몇 회 생성될지 미리보기. */}
        {!isEdit && kind === 'RECURRING' ? (
          <View style={styles.recurringBlock}>
            <View style={styles.group}>
              <Text style={styles.groupLabel}>반복 요일</Text>
              <View style={styles.weekdayRow}>
                {WEEKDAY_LABELS.map((label, day) => {
                  const selected = weekdays.has(day);
                  return (
                    <Pressable
                      key={day}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      onPress={() => toggleWeekday(day)}
                      style={({ pressed }) => [
                        styles.weekdayChip,
                        selected && styles.weekdayChipSelected,
                        day === 0 && !selected && styles.weekdayChipSunday,
                        day === 6 && !selected && styles.weekdayChipSaturday,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.weekdayChipLabel,
                          selected && styles.weekdayChipLabelSelected,
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <TextField
              label="시작 시간"
              value={startTime}
              onChangeText={setStartTime}
              placeholder="15:00"
              description="HH:MM 형식 (예: 15:00, 09:30)."
            />
            <TextField
              label="시작 날짜"
              value={startDateInput}
              onChangeText={setStartDateInput}
              placeholder="예: 2026-03-05"
              description="YYYY-MM-DD 형식. 이 날짜 포함 이후 첫 번째 해당 요일부터 시작해요."
            />
            <View style={styles.group}>
              <Text style={styles.groupLabel}>종료 조건</Text>
              <View style={styles.kindRow}>
                {(['COUNT', 'DATE'] as const).map((option) => {
                  const selected = endMode === option;
                  const label = option === 'COUNT' ? '횟수 지정' : '종료일 지정';
                  return (
                    <Pressable
                      key={option}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => setEndMode(option)}
                      style={({ pressed }) => [
                        styles.kindOption,
                        selected && styles.kindOptionSelected,
                        pressed && styles.chipPressed,
                      ]}
                    >
                      <Text style={[styles.kindOptionLabel, selected && styles.kindOptionLabelSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {endMode === 'COUNT' ? (
              <TextField
                label="총 회차"
                value={endCount}
                onChangeText={setEndCount}
                placeholder="예: 12"
                description="선택한 요일 기준 총 몇 회 만들지 (최대 60회)."
                keyboardType="numeric"
              />
            ) : (
              <TextField
                label="종료 날짜"
                value={endDateInput}
                onChangeText={setEndDateInput}
                placeholder="예: 2026-06-30"
                description="YYYY-MM-DD 형식. 이 날짜 포함 이전까지 생성."
              />
            )}
            <Text style={styles.helper}>
              {recurringPreviewCount > 0
                ? `총 ${recurringPreviewCount}회의 수업이 만들어져요.`
                : '요일/시작일/종료 조건을 확인해 주세요. 아직 만들 수 있는 수업이 없어요.'}
            </Text>
          </View>
        ) : null}

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

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 정기 수업의 실제 회차(datetime 목록)를 계산한다. startDate 이후로 하루씩 넘기며,
 * weekdays에 포함된 요일이면 startTime을 붙여 ISO 문자열로 push. 종료 조건:
 *  - COUNT: 개수가 count에 도달하면 중단 (최대 60회 상한 - 실수로 몇백개를 만들지 못하게).
 *  - DATE: endDate 포함 이후엔 중단. endDate 자체도 매칭되면 포함.
 * 입력이 이상하면 빈 배열을 반환해 UI가 "만들 수 있는 수업이 없어요"로 안내한다.
 */
function computeRecurringDates(input: {
  startDate: string;
  startTime: string;
  weekdays: Set<number>;
  endMode: 'COUNT' | 'DATE';
  endCount: number;
  endDate: string;
}): string[] {
  const MAX_TOTAL = 60;
  const start = parseDateOnly(input.startDate);
  const [hh, mm] = parseHourMinute(input.startTime);
  if (!start || hh == null || mm == null || input.weekdays.size === 0) return [];
  const end = input.endMode === 'DATE' ? parseDateOnly(input.endDate) : null;
  if (input.endMode === 'DATE' && !end) return [];
  const count = input.endMode === 'COUNT' ? Math.min(Math.max(input.endCount, 0), MAX_TOTAL) : MAX_TOTAL;
  if (count === 0) return [];

  const dates: string[] = [];
  // 안전 상한 - startDate와 end가 아주 멀거나 weekdays가 하나뿐이어도 무한 루프 방지.
  const HARD_DAY_LIMIT = 366 * 2;
  const cursor = new Date(start);
  for (let i = 0; i < HARD_DAY_LIMIT; i += 1) {
    if (end && cursor > end) break;
    if (input.weekdays.has(cursor.getDay())) {
      const withTime = new Date(cursor);
      withTime.setHours(hh, mm, 0, 0);
      dates.push(withTime.toISOString());
      if (dates.length >= count) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function parseDateOnly(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, y, mo, d] = match;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseHourMinute(raw: string): [number, number] | [null, null] {
  const match = raw.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return [null, null];
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return [null, null];
  return [hh, mm];
}

function formatDateOnly(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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
  chipLabelSelected: { color: storybookTheme.color.onContent },
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
  recurringBlock: {
    gap: 14,
    padding: 14,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  weekdayRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  weekdayChip: {
    minWidth: 36,
    paddingHorizontal: 8,
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

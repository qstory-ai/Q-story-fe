import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  ActionButton,
  AppNavShell,
  ErrorState,
  FilterChip,
  LoadingState,
  SelectField,
  StatusBanner,
  SwitchField,
  storybookTheme,
} from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { useBackOr } from '@/shared/lib';
import {
  ORGANIZATION_PATHS,
  dashboardNavItems,
  fetchClass,
  listClassStudents,
  listClasses,
  useDirectorSession,
  type ClassResponse,
  type ClassStudentResponse,
} from '@/entities/auth';
import {
  TERM_CHOICE_LABEL,
  buildTermTransitionRequest,
  canArchiveAfterTransition,
  initialTermChoices,
  lifecycleFailureMessage,
  runTermTransition,
  skippedStudentLines,
  summarizeTermChoices,
  termChoiceSummaryLines,
  termResultSummary,
  type TermChoice,
  type TermChoices,
  type TermTransitionResult,
} from '@/entities/class-lifecycle';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | { requestKey: string; status: 'ready'; classGroup: ClassResponse; students: ClassStudentResponse[]; targets: ClassResponse[] }
  | { requestKey: string; status: 'error'; message: string };

type Step = 'choose' | 'confirm' | 'done';

const ACTIONS: TermChoice['action'][] = ['MOVE', 'KEEP', 'GRADUATE'];

/** 기록이 남는다는 안내 - 고르는 단계와 확인 단계에 같이 보인다. */
const RECORDS_STAY = '옮기거나 수료해도 지금까지의 수업 기록과 리포트는 그대로 남아 계속 볼 수 있어요. 옮기거나 수료한 학생의 보호자에게는 알림이 가요.';

/**
 * 학기 마무리(/organization/classes/:classId/term) - 이 반의 지금 학생 모두에게 다음 반 / 이 반에 그대로 / 수료를 정해 한 번에
 * 적용한다. 처음엔 모두 "그대로"라 고르지 않은 학생은 이 반에 남는다. 그대로가 하나도 없으면 마무리하면서 이 반을 지난 반으로
 * 보관할 수 있다. 고르기 → 확인 → 결과 세 단계.
 */
export function ClassTermTransitionPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const director = useDirectorSession(navigate);
  const detailPath = classId ? ORGANIZATION_PATHS.classDetail(classId) : ORGANIZATION_PATHS.classes;
  const goBack = useBackOr(detailPath);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${classId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [choices, setChoices] = useState<TermChoices>({});
  const [archiveWanted, setArchiveWanted] = useState(false);
  const [bulkTargetId, setBulkTargetId] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('choose');
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<TermTransitionResult | null>(null);

  const token = director?.token ?? null;
  const organizationId = director?.organizationId ?? null;

  useEffect(() => {
    if (!token || !classId || !organizationId) return;
    let cancelled = false;
    Promise.all([fetchClass(token, classId), listClassStudents(token, classId), listClasses(token, organizationId)])
      .then(([classGroup, students, classes]) => {
        if (cancelled) return;
        const current = students.filter((student) => !student.endedAt);
        setChoices(initialTermChoices(current.map((student) => student.id)));
        setLoad({
          requestKey,
          status: 'ready',
          classGroup,
          students: current,
          targets: classes.filter((entry) => entry.id !== classGroup.id && !entry.archivedAt),
        });
      })
      .catch((failure: unknown) => {
        if (!cancelled) {
          setLoad({ requestKey, status: 'error', message: messageForError(failure, '반 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.') });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, organizationId, requestKey]);

  const effective: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };
  const students = useMemo(() => (effective.status === 'ready' ? effective.students : []), [effective]);
  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const nameById = useMemo(() => Object.fromEntries(students.map((student) => [student.id, student.name])), [students]);
  const classNameById = useMemo(
    () => (effective.status === 'ready' ? Object.fromEntries(effective.targets.map((entry) => [entry.id, entry.name])) : {}),
    [effective],
  );
  const archiveAllowed = canArchiveAfterTransition(studentIds, choices);
  // 그대로를 하나라도 고르면 보관은 저절로 꺼진다(다시 모두 정하면 사용자가 다시 켠다).
  const archiveClass = archiveWanted && archiveAllowed;

  if (!director) return null;

  const setChoice = (studentId: string, action: TermChoice['action']) => {
    setProblem(null);
    setChoices((current) => {
      const previous = current[studentId];
      const next: TermChoice =
        action === 'MOVE'
          ? { action: 'MOVE', targetClassId: previous?.action === 'MOVE' ? previous.targetClassId : bulkTargetId }
          : { action };
      return { ...current, [studentId]: next };
    });
  };
  const setTarget = (studentId: string, targetClassId: string) => {
    setProblem(null);
    setChoices((current) => ({ ...current, [studentId]: { action: 'MOVE', targetClassId } }));
  };
  const setAll = (choice: TermChoice) => {
    setProblem(null);
    setChoices(Object.fromEntries(studentIds.map((id) => [id, choice])));
  };

  const onReview = () => {
    if (effective.status !== 'ready') return;
    const built = buildTermTransitionRequest({ sourceClassId: effective.classGroup.id, studentIds, choices, archiveClass, nameById });
    if (!built.ok) {
      setProblem(built.message);
      return;
    }
    setProblem(null);
    setStep('confirm');
  };

  const onSubmit = async () => {
    if (effective.status !== 'ready' || !token) return;
    const built = buildTermTransitionRequest({ sourceClassId: effective.classGroup.id, studentIds, choices, archiveClass, nameById });
    if (!built.ok) {
      setProblem(built.message);
      setStep('choose');
      return;
    }
    setSubmitting(true);
    setProblem(null);
    try {
      setResult(await runTermTransition(token, effective.classGroup.id, built.request));
      setStep('done');
    } catch (failure) {
      setProblem(lifecycleFailureMessage(failure, '학기 마무리를 하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppNavShell items={dashboardNavItems(director.user, navigate, pathname)} onBack={goBack}>
      <ScrollView contentContainerStyle={styles.content}>
        {effective.status === 'loading' && <LoadingState label="반 정보를 불러오는 중이에요…" />}
        {effective.status === 'error' && <ErrorState message={effective.message} onRetry={() => setAttempt((n) => n + 1)} />}
        {effective.status === 'ready' && (
          <>
            <View style={styles.header}>
              <Text style={styles.eyebrow}>{effective.classGroup.name}</Text>
              <Text style={styles.title} accessibilityRole="header">학기 마무리</Text>
              <Text style={styles.stepLabel}>
                {step === 'choose' ? '1. 학생마다 정하기' : step === 'confirm' ? '2. 확인하기' : '3. 마무리했어요'}
              </Text>
            </View>

            {effective.classGroup.archivedAt ? (
              <View style={styles.card}>
                <Text style={styles.body}>이미 지난 반으로 보관한 반이에요. 다시 열어야 학기 마무리를 할 수 있어요.</Text>
                <ActionButton variant="secondary" label="반 상세로" onPress={() => navigate(detailPath)} />
              </View>
            ) : step === 'done' && result ? (
              <View style={styles.card}>
                <StatusBanner variant="success" label="학기 마무리를 마쳤어요." body={termResultSummary(result)} />
                {result.skipped.length > 0 ? (
                  <StatusBanner
                    variant="warning"
                    label={`${result.skipped.length}명은 옮기지 못해 이 반에 남았어요.`}
                    body={skippedStudentLines(result.skipped, nameById).join('\n')}
                  />
                ) : null}
                <Text style={styles.body}>{RECORDS_STAY}</Text>
                <ActionButton label="반 상세로" onPress={() => navigate(detailPath, { replace: true })} />
              </View>
            ) : students.length === 0 ? (
              <View style={styles.card}>
                <Text style={styles.body}>이 반에 지금 학생이 없어요. 더 쓰지 않는 반이면 반 상세의 반 관리에서 바로 지난 반으로 보관할 수 있어요.</Text>
                <ActionButton variant="secondary" label="반 상세로" onPress={() => navigate(detailPath)} />
              </View>
            ) : step === 'confirm' ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>이렇게 마무리할까요?</Text>
                {termChoiceSummaryLines(summarizeTermChoices(studentIds, choices, classNameById)).map((line) => (
                  <Text key={line} style={styles.summaryLine}>· {line}</Text>
                ))}
                <Text style={styles.summaryLine}>
                  · {archiveClass ? '마무리한 뒤 이 반을 지난 반으로 보관해요' : '이 반은 지금 쓰는 반으로 남아요'}
                </Text>
                <Text style={styles.body}>{RECORDS_STAY}</Text>
                {problem ? <StatusBanner variant="warning" label={problem} /> : null}
                <View style={styles.actions}>
                  <ActionButton label={submitting ? '마무리하는 중…' : '학기 마무리하기'} loading={submitting} disabled={submitting} onPress={onSubmit} />
                  <ActionButton variant="secondary" label="다시 고르기" disabled={submitting} onPress={() => setStep('choose')} />
                </View>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <Text style={styles.body}>
                    학생마다 다음 반, 이 반에 그대로, 수료 중 하나를 골라 주세요. 고르지 않은 학생은 이 반에 그대로 남아요.
                  </Text>
                  <Text style={styles.muted}>{RECORDS_STAY}</Text>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>한 번에 정하기</Text>
                  {effective.targets.length > 0 ? (
                    <View style={styles.bulkRow}>
                      <View style={styles.flex}>
                        <SelectField
                          label="모두 이 반으로 옮기기"
                          placeholder="다음 반을 골라 주세요"
                          value={bulkTargetId}
                          onChange={(value) => {
                            setBulkTargetId(value);
                            setAll({ action: 'MOVE', targetClassId: value });
                          }}
                          options={effective.targets.map((entry) => ({ value: entry.id, label: entry.name }))}
                        />
                      </View>
                    </View>
                  ) : (
                    <Text style={styles.muted}>옮길 수 있는 다른 반이 없어요. 다음 반으로 보내려면 반/학생 관리에서 새 반을 먼저 만들어 주세요.</Text>
                  )}
                  <View style={styles.actions}>
                    <ActionButton variant="secondary" label="모두 수료" onPress={() => setAll({ action: 'GRADUATE' })} />
                    <ActionButton variant="secondary" label="모두 그대로" onPress={() => setAll({ action: 'KEEP' })} />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>학생 {students.length}명</Text>
                  {students.map((student) => {
                    const choice = choices[student.id] ?? { action: 'KEEP' };
                    return (
                      <View key={student.id} style={styles.studentRow} accessibilityLabel={`${student.name} 다음 학기`}>
                        <Text style={styles.rowTitle}>
                          {student.name} · {student.ageBand}
                        </Text>
                        <View style={styles.chips} accessibilityRole="radiogroup">
                          {ACTIONS.map((action) => (
                            <FilterChip
                              key={action}
                              label={TERM_CHOICE_LABEL[action]}
                              selected={choice.action === action}
                              tone="filled"
                              onPress={() => setChoice(student.id, action)}
                            />
                          ))}
                        </View>
                        {choice.action === 'MOVE' ? (
                          effective.targets.length > 0 ? (
                            <SelectField
                              label="다음 반"
                              placeholder="반을 골라 주세요"
                              value={choice.targetClassId}
                              onChange={(value) => setTarget(student.id, value)}
                              options={effective.targets.map((entry) => ({ value: entry.id, label: entry.name }))}
                            />
                          ) : (
                            <Text style={styles.muted}>옮길 수 있는 다른 반이 없어요.</Text>
                          )
                        ) : null}
                      </View>
                    );
                  })}
                </View>

                <View style={styles.card}>
                  <SwitchField
                    label="마무리 후 이 반을 지난 반으로 보관"
                    description={
                      archiveAllowed
                        ? '반 코드와 담임 초대는 더 이상 쓸 수 없고, 기록과 리포트는 그대로 볼 수 있어요.'
                        : '"이 반에 그대로"인 학생이 있으면 보관할 수 없어요.'
                    }
                    checked={archiveClass}
                    disabled={!archiveAllowed}
                    onChange={setArchiveWanted}
                  />
                </View>

                {problem ? <StatusBanner variant="warning" label={problem} /> : null}
                <ActionButton label="다음" onPress={onReview} />
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.md,
  },
  header: { gap: storybookTheme.spacing.xs },
  eyebrow: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  stepLabel: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  muted: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardMuted,
  },
  summaryLine: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.sm },
  bulkRow: { flexDirection: 'row', gap: storybookTheme.spacing.sm },
  flex: { flex: 1 },
  studentRow: {
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.xs },
});

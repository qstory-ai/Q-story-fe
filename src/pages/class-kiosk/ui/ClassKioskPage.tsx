import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ErrorState, LoadingState, Modal, ModalBody, SafeAreaView, TextField, radius, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import {
  TUTOR_PATHS,
  addClassStudent,
  fetchClass,
  listClassStudents,
  useAuth,
  type ClassResponse,
  type ClassStudentResponse,
} from '@/entities/auth';
import { listStories, type StoryCatalogEntry } from '@/entities/story';
import { storyPlayPath } from '@/features/story-library';

import { duplicateNames, pickKioskStory, sortKioskStudents } from '../model/kiosk';

type LoadState =
  | { requestKey: string; status: 'loading' }
  | {
      requestKey: string;
      status: 'ready';
      classGroup: ClassResponse;
      students: ClassStudentResponse[];
      stories: StoryCatalogEntry[];
    }
  | { requestKey: string; status: 'error'; message: string };

/**
 * 체험 모드(도서관 행사 등) - 선생님이 태블릿마다 이 화면을 띄워 두면 아이가 자기 이름을 눌러 이야기를 시작한다.
 * 재생은 수업 없이 tutorStudentId만 실어 그 아이 한 명의 기록으로 남고, 보호자가 이어져 있으면 바로 리포트가 간다.
 * 미리 가입하지 않은 아이는 "처음 왔어요"로 이름만 올리고, 다 읽은 뒤 화면의 QR로 보호자가 가입하면 오늘 기록이 보인다.
 */
export function ClassKioskPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const token = state.status === 'authenticated' ? state.token : null;
  const isTutor = state.status === 'authenticated' && state.user.role === 'TUTOR';
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${classId ?? ''}:${attempt}`;
  const [load, setLoad] = useState<LoadState>({ requestKey, status: 'loading' });
  const [storyId, setStoryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<ClassStudentResponse | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [exitOpen, setExitOpen] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!isTutor) navigate('/', { replace: true });
  }, [state.status, isTutor, navigate]);

  useEffect(() => {
    if (!token || !classId) return;
    let cancelled = false;
    Promise.all([fetchClass(token, classId), listClassStudents(token, classId), listStories()])
      .then(([classGroup, students, stories]) => {
        if (!cancelled) setLoad({ requestKey, status: 'ready', classGroup, students, stories });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ requestKey, status: 'error', message: messageForError(error, '반 정보를 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, requestKey]);

  const ready = load.requestKey === requestKey && load.status === 'ready' ? load : null;
  const effective: LoadState = load.requestKey === requestKey ? load : { requestKey, status: 'loading' };
  const students = useMemo(() => (ready ? sortKioskStudents(ready.students) : []), [ready]);
  const dupNames = useMemo(() => duplicateNames(students), [students]);
  const openStories = useMemo(() => (ready ? ready.stories.filter((story) => !story.requiresEntitlement) : []), [ready]);
  const defaultStory = useMemo(() => (ready ? pickKioskStory(ready.stories) : null), [ready]);
  const story = openStories.find((entry) => entry.storyId === storyId) ?? defaultStory;

  const start = (student: ClassStudentResponse) => {
    if (!story || !classId) return;
    setPicked(null);
    navigate(storyPlayPath(story.storyId, { tutorStudentId: student.id, kioskClassId: classId }), {
      state: { kioskChildName: student.name },
    });
  };

  const submitNewName = async () => {
    if (!token || !classId) return;
    const name = newName.trim();
    if (!name) {
      setAddError('이름을 적어 주세요.');
      return;
    }
    setAdding(true);
    setAddError(null);
    try {
      const created = await addClassStudent(token, classId, name);
      setAddOpen(false);
      setNewName('');
      // 명단에도 바로 보이게 넣고, 이 아이로 곧장 시작할지 묻는다.
      setLoad((prev) => (prev.status === 'ready' ? { ...prev, students: [...prev.students, created] } : prev));
      setPicked(created);
    } catch (error) {
      setAddError(messageForError(error, '이름을 올리지 못했어요.'));
    } finally {
      setAdding(false);
    }
  };

  if (effective.status !== 'ready') {
    return (
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
        {effective.status === 'error' ? (
          <ErrorState message={effective.message} onRetry={() => setAttempt((value) => value + 1)} />
        ) : (
          <LoadingState label="체험 모드를 준비하는 중이에요…" />
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>{effective.classGroup.name} 체험</Text>
            <Text style={styles.title} accessibilityRole="header">
              내 이름을 눌러 주세요
            </Text>
          </View>
          <Pressable
            onPress={() => setExitOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="체험 모드 끝내기"
            style={styles.exit}
          >
            <Text style={styles.exitLabel}>선생님 메뉴</Text>
          </Pressable>
        </View>

        {openStories.length > 1 ? (
          <View style={styles.storyRow}>
            {openStories.map((entry) => {
              const selected = entry.storyId === story?.storyId;
              return (
                <Pressable
                  key={entry.storyId}
                  onPress={() => setStoryId(entry.storyId)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={[styles.storyChip, selected && styles.storyChipSelected]}
                >
                  <Text style={[styles.storyChipLabel, selected && styles.storyChipLabelSelected]}>{entry.title}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : story ? (
          <Text style={styles.subtitle}>오늘 읽을 이야기: {story.title}</Text>
        ) : null}

        {!story ? <Text style={styles.subtitle}>지금 열 수 있는 이야기가 없어요. 선생님께 알려 주세요.</Text> : null}

        <View style={styles.grid}>
          {students.map((student) => (
            <Pressable
              key={student.id}
              onPress={() => setPicked(student)}
              disabled={!story}
              accessibilityRole="button"
              accessibilityLabel={`${student.name} 시작하기`}
              style={({ pressed }) => [styles.nameButton, pressed && styles.nameButtonPressed]}
            >
              <Text style={styles.nameLabel} numberOfLines={1}>
                {student.name}
              </Text>
              {dupNames.has(student.name) ? (
                <Text style={styles.nameHint} numberOfLines={1}>
                  {student.parentDisplayName ? `${student.parentDisplayName} 보호자` : student.ageBand}
                </Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable
            onPress={() => {
              setAddError(null);
              setAddOpen(true);
            }}
            disabled={!story}
            accessibilityRole="button"
            style={({ pressed }) => [styles.nameButton, styles.newButton, pressed && styles.nameButtonPressed]}
          >
            <Text style={styles.newLabel}>처음 왔어요</Text>
            <Text style={styles.nameHint}>이름을 적고 시작해요</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={picked !== null}
        title={picked ? `${picked.name} 친구 맞아요?` : undefined}
        accessibilityLabel="이름 확인"
        positiveAction={{ label: '맞아요, 시작할게요', onPress: () => picked && start(picked) }}
        negativeAction={{ label: '아니에요', onPress: () => setPicked(null) }}
      >
        {story ? <ModalBody>{story.title} 이야기를 시작해요.</ModalBody> : null}
      </Modal>

      <Modal
        visible={addOpen}
        title="이름을 적어 주세요"
        accessibilityLabel="처음 온 친구 이름 적기"
        positiveAction={{ label: '다음', onPress: () => void submitNewName(), loading: adding, disabled: adding }}
        negativeAction={{ label: '닫기', onPress: () => setAddOpen(false) }}
      >
        <TextField
          label="이름"
          value={newName}
          onChangeText={setNewName}
          maxLength={20}
          autoFocus
          onSubmitEditing={() => void submitNewName()}
          errorText={addError ?? undefined}
          placeholder="예: 김하늘"
        />
      </Modal>

      <Modal
        visible={exitOpen}
        title="체험 모드를 끝낼까요?"
        accessibilityLabel="체험 모드 끝내기"
        positiveAction={{
          label: '끝내기',
          onPress: () => navigate(classId ? TUTOR_PATHS.classDetail(classId) : TUTOR_PATHS.classes, { replace: true }),
        }}
        negativeAction={{ label: '계속하기', onPress: () => setExitOpen(false) }}
      >
        <ModalBody>반 화면으로 돌아가요. 아이들이 읽은 기록은 그대로 남아요.</ModalBody>
      </Modal>
    </SafeAreaView>
  );
}

/** 다 읽은 뒤 화면 등 체험 모드 다른 화면에서도 같은 바탕을 쓴다. */
export const kioskStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: storybookTheme.color.background },
});

const styles = StyleSheet.create({
  screen: kioskStyles.screen,
  content: {
    width: '100%',
    maxWidth: 1040,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.lg,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xxl,
    gap: storybookTheme.spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: storybookTheme.spacing.md },
  flex: { flex: 1, gap: storybookTheme.spacing.xs },
  eyebrow: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
  title: {
    fontSize: storybookTheme.type.xxl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  subtitle: { fontSize: storybookTheme.type.md, color: storybookTheme.color.onContentMuted },
  exit: {
    minHeight: 44,
    paddingHorizontal: storybookTheme.spacing.md,
    justifyContent: 'center',
    borderRadius: radius.rounded,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
  },
  exitLabel: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  storyRow: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.sm },
  storyChip: {
    minHeight: 44,
    paddingHorizontal: storybookTheme.spacing.md,
    justifyContent: 'center',
    borderRadius: radius.rounded,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: storybookTheme.color.surfaceCard,
  },
  storyChipSelected: { borderColor: storybookTheme.color.primary, borderWidth: 2 },
  storyChipLabel: { fontSize: storybookTheme.type.md, color: storybookTheme.color.onCardBody },
  storyChipLabelSelected: { color: storybookTheme.color.primary, fontWeight: storybookTheme.type.weight.bold },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: storybookTheme.spacing.md },
  nameButton: {
    flexGrow: 1,
    flexBasis: 180,
    minHeight: 112,
    paddingHorizontal: storybookTheme.spacing.md,
    paddingVertical: storybookTheme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: storybookTheme.spacing.xs,
    borderRadius: radius[24],
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: storybookTheme.color.surfaceCard,
  },
  nameButtonPressed: { borderColor: storybookTheme.color.primary, borderWidth: 2 },
  nameLabel: {
    fontSize: storybookTheme.type.xxl,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  nameHint: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.onContentMuted },
  newButton: { borderStyle: 'dashed', borderColor: storybookTheme.color.primary },
  newLabel: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
});

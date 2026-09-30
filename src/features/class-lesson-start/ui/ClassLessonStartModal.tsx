import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, Modal, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { createLesson } from '@/entities/lesson';
import { listTutorClasses, type TutorClass } from '@/entities/tutor';

type Props = {
  visible: boolean;
  token: string;
  /** 담임 반만 고르게 하려고 받는다 - listTutorClasses는 소속 기관의 다른 선생님 반도 돌려준다. */
  tutorId: string;
  storyId: string;
  storyTitle: string;
  onClose: () => void;
};

type Load =
  | { status: 'loading' }
  | { status: 'ready'; classes: TutorClass[] }
  | { status: 'error' };

/**
 * 선생님의 "이야기 시작하기" - 어느 반과 읽을지 고르면 그 자리에서 반 수업을 하나 만들고 플레이어로 간다.
 *
 * <p>선생님은 반 단위로만 일한다(1:1 과외도 아이 한 명짜리 반). 학생을 고르는 대신 반을 고르고,
 * studentIds를 비워 보내 서버가 반 명단 전원을 참여 학생으로 채우게 한다. 플레이어에는 lessonId만
 * 넘겨 완주 기록이 이 수업(=반 수업 리포트)으로 묶이게 한다.
 */
export function ClassLessonStartModal({ visible, token, tutorId, storyId, storyTitle, onClose }: Props) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [startingClassId, setStartingClassId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    listTutorClasses(token)
      .then((classes) => {
        if (!cancelled) setLoad({ status: 'ready', classes: classes.filter((classGroup) => classGroup.tutorId === tutorId) });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [visible, token, tutorId]);

  async function startWith(classGroup: TutorClass) {
    setStartingClassId(classGroup.id);
    setStartError(null);
    try {
      const lesson = await createLesson(token, {
        name: storyTitle,
        classGroupId: classGroup.id,
        storyIds: [storyId],
        studentIds: [],
        scheduledAt: new Date().toISOString(),
      });
      navigate(`/stories/${storyId}/play?lessonId=${lesson.id}`);
    } catch (failure: unknown) {
      setStartError(messageForError(failure, '수업을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.'));
      setStartingClassId(null);
    }
  }

  return (
    <Modal
      visible={visible}
      eyebrow="반 선택"
      title="어느 반과 읽을까요?"
      accessibilityLabel="이야기 시작 전 반 선택"
      linkAction={{ label: '취소', onPress: onClose }}
    >
      <View style={styles.body}>
        <Text style={styles.subtitle}>{`${storyTitle}을(를) 반 수업으로 시작해요.`}</Text>

        {load.status === 'loading' ? (
          <Text style={styles.helper}>반 목록을 불러오는 중이에요…</Text>
        ) : load.status === 'error' ? (
          <Text style={[styles.helper, styles.errorText]}>반 목록을 불러오지 못했어요.</Text>
        ) : load.classes.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              이야기는 반과 함께 시작해요. 1:1 과외도 아이 한 명짜리 반을 만들면 돼요.
            </Text>
            <ActionButton
              label="새 반 만들기"
              onPress={() => {
                onClose();
                navigate('/tutor/class-groups/new');
              }}
            />
          </View>
        ) : (
          <View style={styles.list}>
            {load.classes.map((classGroup) => (
              <Pressable
                key={classGroup.id}
                accessibilityRole="button"
                accessibilityLabel={`${classGroup.name}과(와) 시작`}
                onPress={() => startWith(classGroup)}
                disabled={startingClassId !== null}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <Text style={styles.rowName} numberOfLines={1}>{classGroup.name}</Text>
                <Text style={styles.rowMeta}>{startingClassId === classGroup.id ? '시작하는 중…' : '시작'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {startError ? <Text style={[styles.helper, styles.errorText]}>{startError}</Text> : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: storybookTheme.spacing.ms },
  subtitle: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
  helper: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardMuted,
    textAlign: 'center',
    paddingVertical: storybookTheme.spacing.sm,
  },
  errorText: { color: storybookTheme.color.error },
  list: { gap: storybookTheme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    paddingHorizontal: storybookTheme.spacing.md,
    paddingVertical: storybookTheme.spacing.ms,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
  },
  pressed: { opacity: 0.8 },
  rowName: {
    flex: 1,
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  rowMeta: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
  emptyBox: {
    gap: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.ms,
    alignItems: 'stretch',
  },
  emptyText: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
});

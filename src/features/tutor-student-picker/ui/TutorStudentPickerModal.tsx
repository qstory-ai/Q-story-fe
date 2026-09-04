import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, Modal, storybookTheme } from '@/shared/ui';
import { listTutorStudents, type TutorStudent } from '@/entities/tutor';

type Props = {
  visible: boolean;
  token: string;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  /** 학생을 골랐을 때 - 인자는 방금 선택된 학생. 모달 닫기는 호출자 책임. */
  onSelected: (student: TutorStudent) => void;
};

type Load =
  | { status: 'loading' }
  | { status: 'ready'; students: TutorStudent[] }
  | { status: 'error' };

/**
 * 튜터판 ChildPickerModal - "이야기 시작 전 학생 선택". 개인 선생님이 여러 학생을 등록해 뒀을
 * 때 어떤 학생과 시작할지 확인 스텝. 반 선생님(예: "새싹반")도 학생 목록에 반 이름으로 등록해
 * 놓으면 이 목록에 나타나 동일한 방식으로 선택된다 - TutorStudent의 name 필드가 개인 이름과
 * 반 이름을 모두 담을 수 있어서 별도 스키마 없이 커버된다.
 *
 * <p>비어 있을 때(등록된 학생 0명)엔 "학생을 먼저 등록해 주세요" 안내와 등록 화면으로 가는 링크만.
 * 등록 자체는 별도 화면(/tutor/students/new)에서 진행되므로, 이 모달은 등록 폼을 품지 않는다.
 */
export function TutorStudentPickerModal({ visible, token, title, subtitle, onClose, onSelected }: Props) {
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: 'loading' });

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    listTutorStudents(token)
      .then((students) => {
        if (!cancelled) setLoad({ status: 'ready', students });
      })
      .catch(() => {
        if (!cancelled) setLoad({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [visible, token]);

  return (
    <Modal
      visible={visible}
      eyebrow="학생 선택"
      title={title ?? '어떤 학생과 시작할까요?'}
      accessibilityLabel="이야기 시작 전 학생 선택"
      linkAction={{ label: '취소', onPress: onClose }}
    >
      <View style={styles.body}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {load.status === 'loading' ? (
          <Text style={styles.helper}>학생 목록을 불러오는 중이에요…</Text>
        ) : load.status === 'error' ? (
          <Text style={[styles.helper, styles.errorText]}>학생 목록을 불러오지 못했어요.</Text>
        ) : load.students.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>
              먼저 학생(또는 반)을 등록해야 이야기를 시작할 수 있어요. 반 선생님이라면 반 이름
              (예: 새싹반)으로 등록해도 돼요.
            </Text>
            <ActionButton
              label="학생 등록하기"
              onPress={() => {
                onClose();
                navigate('/tutor/students/new');
              }}
            />
          </View>
        ) : (
          <View style={styles.grid}>
            {load.students.map((student) => (
              <StudentTile key={student.id} student={student} onPress={() => onSelected(student)} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

/** ChildAvatarChoice와 같은 톤. 이모지 대신 이름의 첫 글자를 원 안에 넣는다. */
function StudentTile({ student, onPress }: { student: TutorStudent; onPress: () => void }) {
  const initial = student.name.trim().charAt(0) || '학';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${student.name}과(와) 시작`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.avatarFrame}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
      <Text style={styles.tileName} numberOfLines={1}>{student.name}</Text>
      <Text style={styles.tileMeta} numberOfLines={1}>{student.ageBand}</Text>
    </Pressable>
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
    paddingVertical: storybookTheme.spacing.md,
  },
  errorText: { color: storybookTheme.color.error },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: storybookTheme.spacing.md,
    paddingVertical: 6,
  },
  tile: {
    width: 96,
    alignItems: 'center',
    gap: storybookTheme.spacing.xs,
  },
  pressed: { opacity: 0.8 },
  avatarFrame: {
    width: 84,
    height: 84,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 3,
    borderColor: storybookTheme.color.gold,
    backgroundColor: storybookTheme.color.pillBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: storybookTheme.type.xxl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.primary,
  },
  tileName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
    textAlign: 'center',
  },
  tileMeta: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onCardMuted,
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

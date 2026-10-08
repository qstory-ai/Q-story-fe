import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ActionButton, Modal, ModalBody, Pill, StatusBanner } from '@/shared/ui';
import { withParticle } from '@/shared/lib';
import type { ClassStudentResponse } from '@/entities/auth';
import {
  archivedClassBanner,
  formatLifecycleDate,
  lifecycleFailureMessage,
  listStudentClassHistory,
  movedToClassName,
  pastMemberLabel,
  unarchiveClass,
} from '@/entities/class-lifecycle';

import { lifecycleStyles as styles } from './lifecycle-styles';

/** 반 이력을 한 번에 너무 많이 부르지 않는다 - 넘으면 "다른 반으로 옮김"으로 둔다. */
const MAX_HISTORY_LOOKUPS = 30;

/**
 * 이 반을 떠난 학생(옮김·수료) - includePast로 받은 줄. 옮긴 학생은 반 이력에서 옮겨 간 반 이름을 찾아 붙인다
 * (실패하면 "다른 반으로 옮김").
 */
export function PastMembersCard({
  token,
  classId,
  students,
  onOpen,
}: {
  token: string;
  classId: string;
  students: ClassStudentResponse[];
  /** 학생 상세로 갈 수 있으면. 없으면 줄을 누를 수 없다. */
  onOpen?: (studentId: string) => void;
}) {
  const [movedTo, setMovedTo] = useState<Record<string, string>>({});
  const movedIds = students
    .filter((student) => student.endReason === 'MOVED')
    .slice(0, MAX_HISTORY_LOOKUPS)
    .map((student) => student.id)
    .join(',');

  useEffect(() => {
    if (!movedIds) return;
    let cancelled = false;
    Promise.all(
      movedIds.split(',').map((id) =>
        listStudentClassHistory(token, id)
          .then((history) => [id, movedToClassName(history, classId)] as const)
          .catch(() => [id, null] as const),
      ),
    ).then((entries) => {
      if (cancelled) return;
      setMovedTo(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry[1]))));
    });
    return () => {
      cancelled = true;
    };
  }, [token, classId, movedIds]);

  if (students.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>지난 학생 {students.length}명</Text>
      <Text style={styles.muted}>이 반을 떠난 학생이에요. 이 반에서 남긴 기록과 리포트는 그대로 볼 수 있어요.</Text>
      {students.map((student) => {
        const body = (
          <>
            <View style={styles.flex}>
              <Text style={styles.rowTitle}>
                {student.name} · {student.ageBand}
              </Text>
              {student.endedAt ? <Text style={styles.muted}>{formatLifecycleDate(student.endedAt)}</Text> : null}
            </View>
            <Pill label={pastMemberLabel(student, movedTo[student.id])} tone="onLight" />
          </>
        );
        return onOpen ? (
          <Pressable
            key={student.id}
            accessibilityRole="link"
            accessibilityLabel={`${student.name} 학생 상세 열기`}
            onPress={() => onOpen(student.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            {body}
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ) : (
          <View key={student.id} style={styles.row}>
            {body}
          </View>
        );
      })}
    </View>
  );
}

/** 지난 반 상세 맨 위 읽기 전용 안내. 관리자(reopen)에게는 확인 뒤 "다시 열기"가 붙는다. */
export function ArchivedClassBanner({
  archivedAt,
  reopen,
}: {
  archivedAt: string | null | undefined;
  reopen?: { token: string; classId: string; className: string; onReopened: () => void };
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onConfirm = async () => {
    if (!reopen) return;
    setBusy(true);
    setError(null);
    try {
      await unarchiveClass(reopen.token, reopen.classId);
      setConfirming(false);
      reopen.onReopened();
    } catch (failure) {
      setError(lifecycleFailureMessage(failure, '반을 다시 열지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: 8 }}>
      <StatusBanner label={archivedClassBanner(archivedAt)} />
      {reopen ? (
        <View style={styles.actions}>
          <ActionButton variant="secondary" label="다시 열기" onPress={() => setConfirming(true)} />
        </View>
      ) : null}
      {reopen ? (
        <Modal
          visible={confirming}
          accessibilityLabel="반 다시 열기 확인"
          title={`${withParticle(reopen.className, '을/를')} 다시 열까요?`}
          positiveAction={{ label: busy ? '여는 중…' : '다시 열기', onPress: onConfirm, disabled: busy, loading: busy }}
          negativeAction={{ label: '취소', onPress: () => setConfirming(false), disabled: busy }}
        >
          <ModalBody>
            다시 열면 지금 쓰는 반 목록으로 돌아오고, 반 코드로 보호자가 다시 들어올 수 있어요. 담임 초대는 새로 만들어야 해요.
          </ModalBody>
          {error ? <StatusBanner variant="warning" label={error} /> : null}
        </Modal>
      ) : null}
    </View>
  );
}

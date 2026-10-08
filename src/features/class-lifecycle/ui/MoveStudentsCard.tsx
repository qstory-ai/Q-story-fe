import { useState } from 'react';
import { Text, View } from 'react-native';

import { ActionButton, Checkbox, Modal, ModalBody, SelectField, StatusBanner } from '@/shared/ui';
import { withDirectionParticle } from '@/shared/lib';
import type { ClassResponse, ClassStudentResponse } from '@/entities/auth';
import { lifecycleFailureMessage, moveClassStudents, skippedStudentLines, type MoveStudentsResult } from '@/entities/class-lifecycle';

import { lifecycleStyles as styles } from './lifecycle-styles';

export type MoveOutcome = { targetName: string; movedNames: string[]; skippedLines: string[] };

/**
 * 학생 옮기기 - 명단에서 여러 명을 고르고, 같은 기관의 지금 쓰는 다른 반을 골라 옮긴다. 옮기지 못한 학생은 이유와
 * 함께 알려 준다. 옮겨도 학생의 지난 기록은 그대로 따라간다.
 */
export function MoveStudentsCard({
  token,
  classId,
  students,
  targetClasses,
  onDone,
  onCancel,
}: {
  token: string;
  classId: string;
  /** 지금 학생만. */
  students: ClassStudentResponse[];
  /** 옮길 수 있는 반 - 이 기관의 지금 쓰는 반(이 반 제외). */
  targetClasses: ClassResponse[];
  onDone: (outcome: MoveOutcome) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetId, setTargetId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = targetClasses.find((classGroup) => classGroup.id === targetId) ?? null;
  const allSelected = students.length > 0 && selected.size === students.length;
  const nameById = Object.fromEntries(students.map((student) => [student.id, student.name]));

  const toggle = (id: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const onMove = async () => {
    if (!target) return;
    setMoving(true);
    setError(null);
    try {
      const result: MoveStudentsResult = await moveClassStudents(token, classId, {
        studentIds: students.filter((student) => selected.has(student.id)).map((student) => student.id),
        targetClassId: target.id,
      });
      setConfirming(false);
      onDone({
        targetName: target.name,
        movedNames: result.moved.map((id) => nameById[id] ?? '한 학생'),
        skippedLines: skippedStudentLines(result.skipped, nameById),
      });
    } catch (failure) {
      setError(lifecycleFailureMessage(failure, '학생을 옮기지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setMoving(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>학생 옮기기</Text>
      <Text style={styles.body}>옮길 학생을 고르고 옮길 반을 정해 주세요. 옮겨도 지난 수업 기록과 리포트는 그대로 따라가요.</Text>

      {targetClasses.length === 0 ? (
        <StatusBanner variant="warning" label="옮길 수 있는 다른 반이 없어요. 반/학생 관리에서 새 반을 먼저 만들어 주세요." />
      ) : (
        <SelectField
          label="옮길 반"
          placeholder="반을 골라 주세요"
          value={targetId}
          onChange={setTargetId}
          options={targetClasses.map((classGroup) => ({ value: classGroup.id, label: classGroup.name }))}
        />
      )}

      <View style={styles.divider}>
        <Checkbox
          checked={allSelected}
          onChange={(checked) => setSelected(checked ? new Set(students.map((student) => student.id)) : new Set())}
          label={`모두 고르기 (${students.length}명)`}
        />
        {students.map((student) => (
          <Checkbox
            key={student.id}
            checked={selected.has(student.id)}
            onChange={(checked) => toggle(student.id, checked)}
            label={`${student.name} · ${student.ageBand}`}
            description={student.parentDisplayName ? `보호자 ${student.parentDisplayName}` : '보호자 연결 대기'}
          />
        ))}
      </View>

      <View style={styles.actions}>
        <ActionButton
          size="sm"
          label={selected.size > 0 ? `${selected.size}명 옮기기` : '옮기기'}
          onPress={() => {
            setError(null);
            setConfirming(true);
          }}
          disabled={selected.size === 0 || !target}
        />
        <ActionButton variant="secondary" label="취소" onPress={onCancel} />
      </View>

      <Modal
        visible={confirming}
        accessibilityLabel="학생 옮기기 확인"
        title={target ? `${selected.size}명을 ${withDirectionParticle(target.name)} 옮길까요?` : '학생 옮기기'}
        positiveAction={{ label: moving ? '옮기는 중…' : '옮기기', onPress: onMove, disabled: moving, loading: moving }}
        negativeAction={{ label: '취소', onPress: () => setConfirming(false), disabled: moving }}
      >
        <ModalBody>
          {students
            .filter((student) => selected.has(student.id))
            .map((student) => student.name)
            .join(', ')}
        </ModalBody>
        <ModalBody>
          옮긴 학생은 새 반 담임 선생님의 명단으로 가고, 보호자에게 알림이 가요. 지난 수업 기록과 리포트는 그대로 남아요.
        </ModalBody>
        {error ? <StatusBanner variant="warning" label={error} /> : null}
      </Modal>
    </View>
  );
}

/** 옮기기 결과 - 옮긴 학생과 옮기지 못한 학생(이유). */
export function MoveOutcomeBanner({ outcome }: { outcome: MoveOutcome }) {
  return (
    <View style={{ gap: 8 }}>
      {outcome.movedNames.length > 0 ? (
        <StatusBanner
          variant="success"
          label={`${outcome.movedNames.length}명을 ${withDirectionParticle(outcome.targetName)} 옮겼어요.`}
          body={outcome.movedNames.join(', ')}
        />
      ) : null}
      {outcome.skippedLines.length > 0 ? (
        <StatusBanner variant="warning" label={`${outcome.skippedLines.length}명은 옮기지 못했어요.`} body={outcome.skippedLines.join('\n')} />
      ) : null}
    </View>
  );
}

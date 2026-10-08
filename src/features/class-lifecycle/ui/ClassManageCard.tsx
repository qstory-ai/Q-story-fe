import { useState } from 'react';
import { Text, View } from 'react-native';

import { ActionButton, Modal, ModalBody, StatusBanner, TextField } from '@/shared/ui';
import { withParticle } from '@/shared/lib';
import type { ClassResponse } from '@/entities/auth';
import { archiveClass, lifecycleFailureMessage, renameClass } from '@/entities/class-lifecycle';

import { lifecycleStyles as styles } from './lifecycle-styles';

/**
 * 관리자 반 상세의 "반 관리" - 이름 바꾸기, 학생 옮기기, 학기 마무리, 지난 반으로 보관·다시 열기.
 * 다시 열기는 지난 반 안내(ArchivedClassBanner)에 있다. 보관은 지금 학생이 없을 때만 된다(서버도 409) - 학생이 있으면 학기 마무리로 안내한다.
 */
export function ClassManageCard({
  token,
  classGroup,
  studentCount,
  onChanged,
  onStartMove,
  onStartTermTransition,
}: {
  token: string;
  classGroup: ClassResponse;
  /** 지금 학생 수(지난 학생 제외). */
  studentCount: number;
  /** 이름·보관 상태가 바뀌면 반 상세를 다시 불러온다. */
  onChanged: () => void;
  onStartMove: () => void;
  onStartTermTransition: () => void;
}) {
  const archived = Boolean(classGroup.archivedAt);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(classGroup.name);
  const [saving, setSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'archive' | null>(null);
  const [busy, setBusy] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  const trimmed = name.trim();
  const onSaveName = async () => {
    setSaving(true);
    setRenameError(null);
    try {
      await renameClass(token, classGroup.id, trimmed);
      setRenaming(false);
      onChanged();
    } catch (failure) {
      setRenameError(lifecycleFailureMessage(failure, '반 이름을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSaving(false);
    }
  };

  const onConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    setArchiveError(null);
    try {
      await archiveClass(token, classGroup.id);
      setConfirm(null);
      onChanged();
    } catch (failure) {
      setArchiveError(
        lifecycleFailureMessage(failure, '지난 반으로 보관하지 못했어요. 잠시 후 다시 시도해 주세요.'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>반 관리</Text>

      {renaming ? (
        <View style={{ gap: 8 }}>
          <TextField label="반 이름" value={name} onChangeText={setName} />
          <Text style={styles.muted}>이름을 바꿔도 지난 리포트에는 그때 반 이름이 남아요.</Text>
          {renameError ? <StatusBanner variant="warning" label={renameError} /> : null}
          <View style={styles.actions}>
            <ActionButton
              size="sm"
              label={saving ? '저장 중…' : '이름 저장'}
              loading={saving}
              onPress={onSaveName}
              disabled={!trimmed || trimmed.length > 255 || trimmed === classGroup.name || saving}
            />
            <ActionButton
              variant="secondary"
              label="취소"
              onPress={() => {
                setRenaming(false);
                setName(classGroup.name);
                setRenameError(null);
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <ActionButton
            variant="secondary"
            label="이름 바꾸기"
            onPress={() => {
              setName(classGroup.name);
              setRenaming(true);
            }}
          />
          {!archived ? (
            <>
              <ActionButton variant="secondary" label="학생 옮기기" onPress={onStartMove} disabled={studentCount === 0} />
              <ActionButton variant="secondary" label="학기 마무리" onPress={onStartTermTransition} disabled={studentCount === 0} />
            </>
          ) : null}
        </View>
      )}

      {archived ? null : (
      <View style={styles.divider}>
        {studentCount > 0 ? (
          <>
            <Text style={styles.body}>
              학년이 끝났으면 학기 마무리에서 학생마다 다음 반·그대로·수료를 정해 주세요. 지난 반으로 보관하려면 이 반에 지금 학생이 없어야 해요.
            </Text>
            <View style={styles.actions}>
              <ActionButton variant="secondary" label="지난 반으로 보관" onPress={() => undefined} disabled />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.body}>
              더 쓰지 않는 반은 지난 반으로 보관해 두세요. 반 코드와 담임 초대는 더 이상 쓸 수 없고, 기록과 리포트는 그대로 볼 수 있어요.
            </Text>
            <View style={styles.actions}>
              <ActionButton variant="secondary" label="지난 반으로 보관" onPress={() => setConfirm('archive')} />
            </View>
          </>
        )}
      </View>
      )}

      <Modal
        visible={confirm !== null}
        accessibilityLabel="지난 반으로 보관 확인"
        title={`${withParticle(classGroup.name, '을/를')} 지난 반으로 보관할까요?`}
        positiveAction={{
          label: busy ? '보관하는 중…' : '보관하기',
          onPress: onConfirm,
          disabled: busy,
          loading: busy,
        }}
        negativeAction={{
          label: '취소',
          onPress: () => {
            setConfirm(null);
            setArchiveError(null);
          },
          disabled: busy,
        }}
      >
        <ModalBody>
          보관하면 반 코드와 담임 초대로 더 이상 들어올 수 없어요. 지금까지의 수업 기록과 리포트는 그대로 남아 언제든 볼 수 있고, 필요하면 다시 열 수 있어요.
        </ModalBody>
        {archiveError ? <StatusBanner variant="warning" label={archiveError} /> : null}
      </Modal>
    </View>
  );
}

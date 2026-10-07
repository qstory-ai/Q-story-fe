import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { ageYearsFromBirthYear, trackBetaEvent } from '@/entities/analytics';
import {
  BirthYearChips,
  CHILD_AVATARS,
  ageBandFromBirthYear,
  defaultBirthYearForBand,
  useChildren,
  type Child,
  type ChildAvatarKey,
} from '@/entities/child';

type Props = {
  visible: boolean;
  onClose: () => void;
  /** 지정하면 편집 모드(이 아이 값으로 초기화, 저장 시 editChild), 없으면 등록 모드. */
  editing?: Child | null;
};

/**
 * 아이 프로필 등록/편집 시트 - 이름 · 출생연도(나이는 계산) · 아바타.
 * 부모 계정 소유임은 ChildrenProvider가 보장하므로 여기선 역할을 다시 확인하지 않는다.
 */
export function AddChildModal({ visible, onClose, editing }: Props) {
  const isEdit = Boolean(editing);
  return (
    <Modal
      visible={visible}
      accessibilityLabel={isEdit ? '아이 프로필 편집' : '아이 추가'}
      eyebrow={isEdit ? '아이 편집' : '아이 등록'}
      title={isEdit ? '아이 프로필' : '새 아이 프로필'}
    >
      {/* editing이 바뀔 때마다 폼을 remount해 상태(name/ageBand/avatarKey)와 저장 에러도 함께 초기화한다. */}
      <ChildFormBody key={editing?.id ?? 'new'} editing={editing ?? null} onClose={onClose} />
    </Modal>
  );
}

/** 폼 상태와 저장/취소 버튼을 함께 가져서, remount 시 저장 상태까지 같이 초기화된다. */
function ChildFormBody({ editing, onClose }: { editing: Child | null; onClose: () => void }) {
  const { addChild, editChild } = useChildren();
  const isEdit = editing !== null;

  const [name, setName] = useState(editing?.name ?? '');
  // 출생연도가 없는 프로필은 저장된 연령대의 가운데 나이로 초기 선택.
  const [birthYear, setBirthYear] = useState<number>(() => editing?.birthYear ?? defaultBirthYearForBand(editing?.ageBand));
  const [avatarKey, setAvatarKey] = useState<ChildAvatarKey>(
    (editing?.avatarKey as ChildAvatarKey) ?? CHILD_AVATARS[0].key,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        await editChild(editing.id, { name: name.trim(), birthYear, ageBand: ageBandFromBirthYear(birthYear), avatarKey });
      } else {
        const ageBand = ageBandFromBirthYear(birthYear);
        await addChild({ name: name.trim(), birthYear, ageBand, avatarKey });
        void trackBetaEvent('child_registered', { age_years: ageYearsFromBirthYear(birthYear), age_band: ageBand });
      }
      onClose();
    } catch (submitError: unknown) {
      const message = messageForError(submitError, isEdit ? '아이 프로필을 저장하지 못했어요.' : '아이 프로필을 만들지 못했어요.');
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.body}>
      <TextField
        label="이름 또는 별명"
        value={name}
        onChangeText={setName}
        placeholder="예: 민준"
        maxLength={40}
      />

      <BirthYearChips value={birthYear} onChange={setBirthYear} />

      <View style={styles.group}>
        <Text style={styles.groupLabel}>아바타</Text>
        <View style={styles.avatarGrid}>
          {CHILD_AVATARS.map((preset) => {
            const selected = preset.key === avatarKey;
            return (
              <Pressable
                key={preset.key}
                accessibilityRole="radio"
                accessibilityLabel={preset.label}
                aria-checked={selected}
                onPress={() => setAvatarKey(preset.key)}
                style={({ pressed }) => [
                  styles.avatarChoice,
                  { borderColor: selected ? preset.accent : 'transparent', backgroundColor: `${preset.accent}22` },
                  pressed && styles.chipPressed,
                ]}
              >
                <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          disabled={submitting}
          style={({ pressed }) => [styles.cancelButton, pressed && styles.chipPressed]}
        >
          <Text style={styles.cancelLabel}>취소</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit}
          disabled={!canSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !canSubmit && styles.submitButtonDisabled,
            pressed && styles.chipPressed,
          ]}
        >
          <Text style={[styles.submitLabel, !canSubmit && styles.submitLabelDisabled]}>
            {submitting ? '저장 중…' : isEdit ? '저장' : '아이 추가하기'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  group: { gap: 8 },
  groupLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  chipPressed: { opacity: 0.85 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarChoice: {
    width: 52,
    height: 52,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  avatarEmoji: { fontSize: 28 },
  error: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: 'transparent',
  },
  cancelLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  submitButton: {
    flex: 1.4,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.primary,
  },
  submitButtonDisabled: { backgroundColor: storybookTheme.color.disabledBackground },
  submitLabelDisabled: { color: storybookTheme.color.disabledText },
  // 버튼 배경이 primary(#1E293B)라 흰 글자 - onContent도 #1E293B여서 활성화되면 글자가 사라졌다.
  submitLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
});

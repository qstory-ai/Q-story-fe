import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Modal, TextField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import {
  AGE_BANDS,
  AGE_BAND_LABELS,
  CHILD_AVATARS,
  useChildren,
  type AgeBand,
  type Child,
  type ChildAvatarKey,
} from '@/entities/child';

type Props = {
  visible: boolean;
  onClose: () => void;
  /**
   * 지정하면 편집 모드가 된다 - 폼이 이 아이의 값으로 초기화되고, 저장 시 editChild를 호출한다.
   * 지정하지 않으면(기존 호출부: 홈의 "아이 추가" 버튼) 새 아이를 만드는 등록 모드로 동작한다.
   */
  editing?: Child | null;
};

/**
 * 아이 프로필 등록/편집 시트 - 홈(ChildSelector), 마이페이지의 "아이 관리" 두 곳에서 재사용한다.
 * 필드는 IA의 "아이 등록/수정" 스텝을 그대로 가져왔다: 이름 · 연령대 · 아바타(성별은 아직 표시 전용).
 * 부모 계정 소유임은 ChildrenProvider가 이미 보장하므로 여기선 caller가 PARENT인지 다시 확인하지 않는다.
 *
 * <p>편집 대상이 바뀔 때 폼을 다시 채우는 것은 내부 <ChildFormBody /> 컴포넌트에 key로
 * editing?.id를 넘겨 매번 remount시키는 방식으로 해결한다 - 예전엔 useEffect + setState로
 * 리셋했지만 그 방식은 렌더 사이 cascading state 업데이트를 만들어 lint 규칙에 걸렸다.
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

/**
 * Modal이 렌더하는 본문 - 자기 상태로 폼을 관리하고 Save/Cancel 버튼도 여기서 그린다.
 * 예전엔 Modal의 positive/negativeAction으로 넘겼지만, editing 전환 시 폼과 함께 저장 상태도
 * 함께 초기화되어야 해서 여기 안으로 흡수했다 - Modal은 여전히 두 버튼을 위한 공간을 남긴다.
 */
function ChildFormBody({ editing, onClose }: { editing: Child | null; onClose: () => void }) {
  const { addChild, editChild } = useChildren();
  const isEdit = editing !== null;

  const [name, setName] = useState(editing?.name ?? '');
  const [ageBand, setAgeBand] = useState<AgeBand>(editing?.ageBand ?? '6-7');
  const [avatarKey, setAvatarKey] = useState<ChildAvatarKey>(
    (editing?.avatarKey as ChildAvatarKey) ?? CHILD_AVATARS[0].key,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length > 0 && !submitting, [name, submitting]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (isEdit && editing) {
        await editChild(editing.id, { name: name.trim(), ageBand, avatarKey });
      } else {
        await addChild({ name: name.trim(), ageBand, avatarKey });
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

      <View style={styles.group}>
        <Text style={styles.groupLabel}>연령대</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {AGE_BANDS.map((band) => {
            const selected = band === ageBand;
            return (
              <Pressable
                key={band}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setAgeBand(band)}
                style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.chipPressed]}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                  {AGE_BAND_LABELS[band]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

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
                accessibilityState={{ selected }}
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
          <Text style={styles.submitLabel}>
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
  // xs(12)였던 걸 sm(14)로 - 취소/추가 버튼 라벨(sm)보다도 작아서 정작 채워야 할 폼 내용이
  // 자기보다 덜 중요한 액션보다 더 눈에 안 띄는 위계 역전이 있었다.
  groupLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14,
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
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  chipLabelSelected: { color: storybookTheme.color.onContent },
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
  submitLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
});

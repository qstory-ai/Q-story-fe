import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Modal, TextField, storybookTheme } from '@/shared/ui';
import {
  AGE_BANDS,
  AGE_BAND_LABELS,
  CHILD_AVATARS,
  useChildren,
  type AgeBand,
  type ChildAvatarKey,
} from '@/entities/child';

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * "아이 추가" 시트 - 홈 우측 상단의 원형 + 버튼과 마이페이지의 "아이 관리" 두 곳에서 재사용한다.
 * 필드는 IA의 "아이 등록" 스텝을 그대로 가져왔다: 이름 · 연령대 · 아바타(성별은 아직 표시 전용).
 * 부모 계정 소유임은 ChildrenProvider가 이미 보장하므로 여기선 캘러가 PARENT인지 다시 확인하지 않는다.
 */
export function AddChildModal({ visible, onClose }: Props) {
  const { addChild } = useChildren();
  const [name, setName] = useState('');
  const [ageBand, setAgeBand] = useState<AgeBand>('6-7');
  const [avatarKey, setAvatarKey] = useState<ChildAvatarKey>(CHILD_AVATARS[0].key);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => name.trim().length > 0 && !submitting, [name, submitting]);

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await addChild({ name: name.trim(), ageBand, avatarKey });
      // 성공 시 폼 초기화 - 다음에 열 때 이전 값이 남아 있으면 헷갈린다.
      setName('');
      setAgeBand('6-7');
      setAvatarKey(CHILD_AVATARS[0].key);
      onClose();
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : '아이 프로필을 만들지 못했어요.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      visible={visible}
      accessibilityLabel="아이 추가"
      eyebrow="아이 등록"
      title="새 아이 프로필"
      positiveAction={{
        label: submitting ? '만드는 중…' : '아이 추가하기',
        onPress: handleSubmit,
        disabled: !canSubmit,
        loading: submitting,
      }}
      negativeAction={{ label: '취소', onPress: onClose, disabled: submitting }}
    >
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 16 },
  group: { gap: 8 },
  groupLabel: {
    fontSize: storybookTheme.type.xs,
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
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  chipLabelSelected: { color: storybookTheme.color.onDark },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  avatarChoice: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
});

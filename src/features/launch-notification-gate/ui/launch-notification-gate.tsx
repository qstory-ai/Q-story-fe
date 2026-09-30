import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal, ModalBody, TextField, storybookTheme } from '@/shared/ui';
import type { ChildGender } from '@/entities/launch-notification';

import { useLaunchNotificationGate } from '../model/use-launch-notification-gate';

const GENDER_OPTIONS: { value: ChildGender; label: string }[] = [
  { value: 'GIRL', label: '여자아이' },
  { value: 'BOY', label: '남자아이' },
  { value: 'UNSPECIFIED', label: '비공개' },
];

/**
 * 무료 데모("/demo")에 들어가기 전 거치는 연락처 수집 모달 - DemoStoryRoute 전용(정식 플레이
 * 경로는 이미 가입한 사용자라 걸지 않는다). "연락 받고 싶어요"/"괜찮아요" 둘 다 같은 필드를
 * 요구하고 서버에 보내며, 차이는 wantsContact 플래그뿐이다. linkAction/scrim 닫기를 주지 않아
 * 정보 없이 지나치는 경로를 막는다.
 */
export function LaunchNotificationGate({ children }: { children: ReactNode }) {
  const form = useLaunchNotificationGate();
  // 미완성 상태로 한 번 누른 뒤부터 어떤 항목이 비었는지 각 필드 아래 보여준다.
  const [showValidation, setShowValidation] = useState(false);

  if (form.passed) return <>{children}</>;

  const attempt = (wantsContact: boolean) => {
    if (!form.canSubmit) {
      setShowValidation(true);
      return;
    }
    void form.submit(wantsContact);
  };

  const fieldError = (valid: boolean, message: string) =>
    showValidation && !valid ? message : undefined;
  const genderError = fieldError(form.childGender !== null, '아이 성별을 선택해 주세요.');

  return (
    <Modal
      visible
      eyebrow="정식 출시 소식 받기"
      title="이야기가 준비되면 가장 먼저 알려드릴게요"
      positiveAction={{
        label: '연락 받고 싶어요',
        onPress: () => attempt(true),
        disabled: form.submittingIntent !== null,
        loading: form.submittingIntent === 'contact',
      }}
      negativeAction={{
        label: '괜찮아요',
        onPress: () => attempt(false),
        disabled: form.submittingIntent !== null,
        loading: form.submittingIntent === 'decline',
      }}
      accessibilityLabel="정식 출시 알림 신청"
    >
      <ModalBody>
        전화로는 연락드리지 않아요. 정식 출시 소식은 이메일과 문자로만 안내해 드려요.
      </ModalBody>
      <Text style={styles.requiredNotice}>
        무료 데모를 시작하려면 아래 항목을 모두 입력해야 해요 (이메일 제외).
      </Text>

      <TextField
        label="보호자 이름"
        value={form.parentName}
        onChangeText={form.setParentName}
        placeholder="홍길동"
        errorText={fieldError(form.parentName.trim().length > 0, '보호자 이름을 입력해 주세요.')}
      />
      <TextField
        label="이메일 (선택)"
        value={form.email}
        onChangeText={form.setEmail}
        keyboardType="email-address"
        placeholder="parent@example.com"
      />
      <TextField
        label="전화번호"
        value={form.phone}
        onChangeText={form.setPhone}
        keyboardType="phone-pad"
        placeholder="010-0000-0000"
        errorText={fieldError(form.phone.trim().length > 0, '전화번호를 입력해 주세요.')}
      />

      <View style={styles.field}>
        <Text style={styles.label}>아이 성별</Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              onPress={() => form.setChildGender(option.value)}
              style={[styles.genderButton, form.childGender === option.value && styles.genderButtonActive]}
            >
              <Text
                style={[
                  styles.genderButtonText,
                  form.childGender === option.value && styles.genderButtonTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {genderError ? <Text style={styles.fieldErrorText}>{genderError}</Text> : null}
      </View>

      <TextField
        label="아이 나이"
        value={form.childAge}
        onChangeText={form.setChildAge}
        placeholder="예: 5세, 3개월"
        errorText={fieldError(form.childAge.trim().length > 0, '아이 나이를 입력해 주세요. (예: 5세, 3개월)')}
      />
      <TextField
        label="큐스토리를 어떻게 알게 되셨나요?"
        value={form.discoverySource}
        onChangeText={form.setDiscoverySource}
        placeholder="예: 인스타그램, 지인 추천"
        errorText={
          fieldError(form.discoverySource.trim().length > 0, '어떻게 알게 되셨는지 알려주세요.') ??
          form.error ??
          undefined
        }
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  requiredNotice: {
    marginTop: -4,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.linkOnLight,
    textAlign: 'center',
  },
  field: {
    gap: storybookTheme.spacing.xs,
  },
  label: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.medium,
    color: storybookTheme.color.onLightHeading,
  },
  fieldErrorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
  },
  genderRow: {
    flexDirection: 'row',
    gap: storybookTheme.spacing.sm,
  },
  genderButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: storybookTheme.radius.input,
    backgroundColor: storybookTheme.color.disabledBackground,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: storybookTheme.spacing.sm,
  },
  genderButtonActive: {
    backgroundColor: storybookTheme.color.primary,
    borderColor: storybookTheme.color.primary,
  },
  genderButtonText: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onLightHeading,
  },
  genderButtonTextActive: {
    color: storybookTheme.color.surfaceWhite,
  },
});

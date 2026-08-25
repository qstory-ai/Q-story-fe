import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Modal, ModalBody, TextField, storybookTheme } from '@/shared/ui';
import type { ChildGender } from '@/entities/launch-notification';
import { useAuth } from '@/entities/auth';

import { useLaunchNotificationGate } from '../model/use-launch-notification-gate';

const GENDER_OPTIONS: { value: ChildGender; label: string }[] = [
  { value: 'GIRL', label: '여자아이' },
  { value: 'BOY', label: '남자아이' },
  { value: 'UNSPECIFIED', label: '비공개' },
];

/**
 * 무료 데모("/demo")에 들어가기 전 반드시 거쳐야 하는 연락처 수집 모달 - DemoStoryRoute
 * 전용이다(StoryPlayerRoute의 정식 플레이 경로에는 걸지 않는다 - 그쪽은 이미 가입을 거친
 * 사용자라 다시 물을 이유가 없고, 이 코드베이스는 라우트별로 다른 관문을 두는 걸 선호한다 -
 * StoryPlayerRoute.tsx 참고). "연락 받고 싶어요"와 "괜찮아요" 둘 다 같은 필드를 요구하며,
 * 둘 다 정보를 동일하게 서버로 보낸다 - 차이는 wantsContact 플래그뿐이다(괜찮아요는
 * 능동적으로 연락하지 않겠다는 의미일 뿐, 신청 자체를 건너뛰는 게 아니다). 필수 항목이 비어
 * 있으면 버튼은 눌러도 제출되지 않고 대신 어떤 항목이 비었는지 각 필드 아래 보여준다(그냥
 * 조용히 막기만 하면 왜 안 되는지 알 수 없다). Modal에 linkAction/scrim 닫기를 주지 않아
 * 아무 정보도 없이 그냥 지나치는 경로만 구조적으로 없앴다.
 *
 * 통과 여부는 로그인 상태면 계정 단위로, 익명이면 기존처럼 브라우저 단위로 기억한다 -
 * 브라우저 하나로만 묶으면 한 계정(혹은 익명 상태)에서 한 번 통과한 뒤로는 다른 계정으로
 * 로그인해도 다시는 뜨지 않는 문제가 있었다.
 */
export function LaunchNotificationGate({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const accountId = auth.status === 'authenticated' ? auth.user.id : null;
  const form = useLaunchNotificationGate(accountId);
  // 필드가 비었어도 버튼은 그냥 눌리지 않기만 할 뿐 아무 설명이 없었다 - 한 번이라도 눌러
  // 보면(canSubmit이 false인 채로) 그때부터 어떤 항목이 비었는지 각 필드 아래 보여준다.
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
        {fieldError(form.childGender !== null, '아이 성별을 선택해 주세요.') ? (
          <Text style={styles.fieldErrorText}>아이 성별을 선택해 주세요.</Text>
        ) : null}
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
    fontWeight: '700',
    color: '#6E428B',
    textAlign: 'center',
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: '#503267',
  },
  fieldErrorText: {
    fontSize: storybookTheme.type.xs,
    color: '#E46647',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  genderButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#F0E8F5',
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  genderButtonActive: {
    backgroundColor: '#43225F',
    borderColor: '#43225F',
  },
  genderButtonText: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '600',
    color: '#503267',
  },
  genderButtonTextActive: {
    color: '#FFFFFF',
  },
});

import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import {
  Checkbox,
  FILTER_CHIP_ROW_GAP,
  FieldError,
  FieldLabel,
  FilterChip,
  Modal,
  ModalBody,
  TextField,
  storybookTheme,
} from '@/shared/ui';

import { useLaunchNotificationGate } from '../model/use-launch-notification-gate';
import { CHILD_AGE_OPTIONS, DISCOVERY_OPTIONS, DISCOVERY_OTHER } from '../model/launch-notification-form';
import type { ChildGender } from '../api/launch-notification-api';

const GENDER_OPTIONS: { value: ChildGender; label: string }[] = [
  { value: 'GIRL', label: '여자아이' },
  { value: 'BOY', label: '남자아이' },
  { value: 'UNSPECIFIED', label: '비공개' },
];

type Props = {
  children: ReactNode;
  /** 양식 뒤에 흐리게 깔 동화 그림. 없으면 어두운 바탕만 보인다. */
  backdrop?: ImageSourcePropType;
};

/**
 * 무료 데모("/demo")에 들어가기 전 거치는 짧은 신청 양식. DemoStoryRoute 전용이다(정식 플레이 경로는
 * 이미 가입한 사용자라 걸지 않는다).
 *
 * 예전에는 글자 입력 칸 여섯 개와 버튼 두 개("소식 받고"/"소식 없이")였다. 지금은
 * - 아이 나이·성별·알게 된 경로를 칩으로 누르게 해 타이핑은 보호자 이름 한 칸뿐이고
 * - 출시 소식은 체크박스로 받는다. 켜야 휴대폰 번호 칸이 열린다(기본은 꺼짐, 마케팅 수신 동의라서)
 * - 버튼은 "데모 시작하기" 하나다. 서버에는 예전처럼 wantsContact 플래그로 구분해 보낸다.
 * 닫기 링크나 배경 탭 닫기는 두지 않아 정보 없이 지나치는 경로는 여전히 없다.
 */
export function LaunchNotificationGate({ children, backdrop }: Props) {
  const form = useLaunchNotificationGate();
  // 빈 칸이 있는 채로 한 번 누른 뒤부터 어떤 항목이 비었는지 각 항목 아래 보여 준다.
  const [showValidation, setShowValidation] = useState(false);

  if (form.passed) return <>{children}</>;

  const start = () => {
    if (!form.canSubmitFor(form.wantsContact)) {
      setShowValidation(true);
      return;
    }
    void form.submit(form.wantsContact);
  };

  const errorFor = (valid: boolean, message: string) => (showValidation && !valid ? message : undefined);
  const ageError = errorFor(form.childAge.length > 0, '아이 나이를 골라 주세요.');
  const genderError = errorFor(form.childGender !== null, '아이 성별을 골라 주세요.');
  const discoveryError =
    form.discoveryChoice === DISCOVERY_OTHER
      ? undefined
      : errorFor(form.discoveryChoice !== null, '어떻게 알게 되셨는지 골라 주세요.');

  return (
    <View style={styles.page}>
      {backdrop ? <Image source={backdrop} style={styles.backdrop} resizeMode="cover" blurRadius={6} /> : null}
      <Modal
        visible
        eyebrow="무료 데모 · 헨젤과 그레텔"
        title="시작 전에 몇 가지만 알려 주세요"
        pinActions
        positiveAction={{
          label: '데모 시작하기',
          onPress: start,
          disabled: form.submittingIntent !== null,
          loading: form.submittingIntent !== null,
        }}
        actionsNote={form.error ? <Text style={styles.submitError}>{form.error}</Text> : undefined}
        accessibilityLabel="무료 데모 시작 전 신청"
      >
        <View style={styles.body}>
          <ModalBody>아이에게 맞는 이야기를 만드는 데 써요. 30초면 끝나요.</ModalBody>

          <TextField
            label="보호자 이름"
            value={form.parentName}
            onChangeText={form.setParentName}
            placeholder="홍길동"
            returnKeyType="done"
            errorText={errorFor(form.parentName.trim().length > 0, '보호자 이름을 적어 주세요.')}
          />

          <ChipQuestion label="아이 나이" error={ageError}>
            {CHILD_AGE_OPTIONS.map((age) => (
              <FilterChip
                key={age}
                tone="filled"
                label={age}
                selected={form.childAge === age}
                onPress={() => form.setChildAge(age)}
              />
            ))}
          </ChipQuestion>

          <ChipQuestion label="아이 성별" error={genderError}>
            {GENDER_OPTIONS.map((option) => (
              <FilterChip
                key={option.value}
                tone="filled"
                label={option.label}
                selected={form.childGender === option.value}
                onPress={() => form.setChildGender(option.value)}
              />
            ))}
          </ChipQuestion>

          <ChipQuestion label="큐스토리를 어떻게 알게 되셨나요?" error={discoveryError}>
            {DISCOVERY_OPTIONS.map((source) => (
              <FilterChip
                key={source}
                tone="filled"
                label={source}
                selected={form.discoveryChoice === source}
                onPress={() => form.setDiscoveryChoice(source)}
              />
            ))}
          </ChipQuestion>
          {form.discoveryChoice === DISCOVERY_OTHER ? (
            <TextField
              label=""
              accessibilityLabel="알게 된 경로 직접 적기"
              value={form.discoveryOther}
              onChangeText={form.setDiscoveryOther}
              placeholder="예: 블로그, 행사"
              autoFocus
              errorText={errorFor(form.discoveryOther.trim().length > 0, '어디서 알게 되셨는지 적어 주세요.')}
            />
          ) : null}

          <View style={styles.contactBox}>
            <Checkbox
              checked={form.wantsContact}
              onChange={form.setWantsContact}
              label="정식 출시 소식 문자로 받기 (선택)"
              description="출시일과 새 이야기만 알려 드려요. 전화는 걸지 않아요."
            />
            {form.wantsContact ? (
              <View style={styles.contactFields}>
                <TextField
                  label="휴대폰 번호"
                  value={form.phone}
                  onChangeText={form.setPhone}
                  keyboardType="phone-pad"
                  placeholder="010-0000-0000"
                  autoFocus
                  errorText={errorFor(form.phone.trim().length > 0, '소식을 받으시려면 번호를 적어 주세요.')}
                />
                <TextField
                  label="이메일 (선택)"
                  value={form.email}
                  onChangeText={form.setEmail}
                  keyboardType="email-address"
                  placeholder="parent@example.com"
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function ChipQuestion({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.question} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.chips}>{children}</View>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: '100%' as unknown as number,
    backgroundColor: storybookTheme.color.onLightHeading,
    overflow: 'hidden',
  },
  backdrop: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
  },
  body: {
    gap: 18,
  },
  question: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: FILTER_CHIP_ROW_GAP,
  },
  contactBox: {
    gap: 12,
    padding: 14,
    borderRadius: storybookTheme.radius.input,
    backgroundColor: storybookTheme.color.disabledBackground,
  },
  contactFields: {
    gap: 12,
  },
  submitError: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});

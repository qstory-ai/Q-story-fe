import { useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import {
  Checkbox,
  FieldError,
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

          <Question label="보호자 이름">
            <TextField
              label=""
              accessibilityLabel="보호자 이름"
              value={form.parentName}
              onChangeText={form.setParentName}
              placeholder="홍길동"
              returnKeyType="done"
              errorText={errorFor(form.parentName.trim().length > 0, '보호자 이름을 적어 주세요.')}
            />
          </Question>

          <ChipQuestion label="아이 나이" error={ageError}>
            {CHILD_AGE_OPTIONS.map((age) => (
              <Chip
                key={age}
                label={age}
                selected={form.childAge === age}
                onPress={() => form.setChildAge(age)}
              />
            ))}
          </ChipQuestion>

          <ChipQuestion label="아이 성별" error={genderError}>
            {GENDER_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={form.childGender === option.value}
                onPress={() => form.setChildGender(option.value)}
              />
            ))}
          </ChipQuestion>

          <ChipQuestion label="큐스토리를 어떻게 알게 되셨나요?" error={discoveryError}>
            {DISCOVERY_OPTIONS.map((source) => (
              <Chip
                key={source}
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

          <View style={[styles.contactBox, form.wantsContact && styles.contactBoxOn]}>
            <Checkbox
              checked={form.wantsContact}
              onChange={form.setWantsContact}
              label="정식 출시 소식 문자로 받기 (선택)"
              description="출시일과 새 이야기만 알려 드려요. 전화는 걸지 않아요."
            />
            {form.wantsContact ? (
              <View style={styles.contactFields}>
                <View style={styles.contactField}>
                  <TextField
                    label="휴대폰 번호"
                    value={form.phone}
                    onChangeText={form.setPhone}
                    keyboardType="phone-pad"
                    placeholder="010-0000-0000"
                    autoFocus
                    errorText={errorFor(form.phone.trim().length > 0, '소식을 받으시려면 번호를 적어 주세요.')}
                  />
                </View>
                <View style={styles.contactField}>
                  <TextField
                    label="이메일 (선택)"
                    value={form.email}
                    onChangeText={form.setEmail}
                    keyboardType="email-address"
                    placeholder="parent@example.com"
                  />
                </View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** 질문 제목 + 내용. 제목은 칩·입력칸보다 진하게 써서 어디까지가 한 질문인지 보이게 한다. */
function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ChipQuestion({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View style={styles.question} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.questionLabel}>{label}</Text>
      <View style={styles.chips}>{children}</View>
      {error ? <FieldError>{error}</FieldError> : null}
    </View>
  );
}

/**
 * 하나만 고르는 칩. 공용 FilterChip은 목록 필터용이라 보이는 높이가 30px대로 작다. 태블릿에서 아이 옆에 앉아
 * 손가락으로 누르는 화면이라 보이는 크기 자체를 44px로 키웠다.
 */
function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.chipPressed]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelOn]}>{label}</Text>
    </Pressable>
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
    gap: 20,
  },
  question: {
    gap: 8,
  },
  questionLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onLightHeading,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 16,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1.5,
    borderColor: storybookTheme.color.accentBorderLight,
    backgroundColor: storybookTheme.color.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: storybookTheme.color.primary,
    backgroundColor: storybookTheme.color.primary,
  },
  chipPressed: {
    opacity: 0.8,
  },
  chipLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onLightHeading,
  },
  chipLabelOn: {
    color: storybookTheme.color.surfaceWhite,
  },
  contactBox: {
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: storybookTheme.radius.input,
    borderWidth: 1.5,
    borderColor: storybookTheme.color.accentBorderLight,
    backgroundColor: storybookTheme.color.surfaceWhite,
  },
  contactBoxOn: {
    borderColor: storybookTheme.color.primary,
    backgroundColor: storybookTheme.semantic.brand.secondary,
  },
  // 넓은 카드에서는 번호와 이메일을 한 줄에 둬서 체크해도 카드가 길어지지 않게 한다. 좁으면 위아래로 쌓인다.
  contactFields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  contactField: {
    flexGrow: 1,
    flexBasis: 200,
  },
  submitError: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});

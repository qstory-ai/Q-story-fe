import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Checkbox, storybookTheme } from '@/shared/ui';

/**
 * IA "회원가입 > 약관 동의" - 필수 두 개(서비스 이용약관·개인정보 수집·이용)와 선택 하나
 * (마케팅 정보 수신 동의). 전체 동의 상단 토글은 필수 두 개만 켜도 회원가입은 진행 가능하지만
 * "전체" 상태는 세 개가 모두 켜졌을 때만 반영된다.
 *
 * 각 항목 옆의 "자세히" 링크는 정식 URL이 확정되면 붙일 자리 - 지금은 안내 콜백만 호출한다.
 */

export type TermsConsentState = {
  service: boolean;
  privacy: boolean;
  marketing: boolean;
};

export const EMPTY_TERMS_CONSENT: TermsConsentState = { service: false, privacy: false, marketing: false };

export function termsConsentIsValid(consent: TermsConsentState): boolean {
  return consent.service && consent.privacy;
}

type Props = {
  value: TermsConsentState;
  onChange: (next: TermsConsentState) => void;
  /** "자세히" 링크를 눌렀을 때 호출 - 정식 문서 URL이 아직 없어 상위에서 안내 처리한다. */
  onOpenDoc?: (kind: 'service' | 'privacy' | 'marketing') => void;
};

export function TermsConsent({ value, onChange, onOpenDoc }: Props) {
  const allChecked = useMemo(() => value.service && value.privacy && value.marketing, [value]);

  function toggleAll(next: boolean) {
    onChange({ service: next, privacy: next, marketing: next });
  }

  return (
    <View style={styles.container}>
      <View style={styles.allRow}>
        <Checkbox checked={allChecked} onChange={toggleAll} label="전체 동의" />
      </View>
      <View style={styles.divider} />
      <ConsentRow
        label="[필수] 서비스 이용약관"
        checked={value.service}
        onChange={(next) => onChange({ ...value, service: next })}
        onOpenDoc={() => onOpenDoc?.('service')}
      />
      <ConsentRow
        label="[필수] 개인정보 수집·이용 동의"
        checked={value.privacy}
        onChange={(next) => onChange({ ...value, privacy: next })}
        onOpenDoc={() => onOpenDoc?.('privacy')}
      />
      <ConsentRow
        label="[선택] 마케팅 정보 수신 동의"
        checked={value.marketing}
        onChange={(next) => onChange({ ...value, marketing: next })}
        onOpenDoc={() => onOpenDoc?.('marketing')}
      />
    </View>
  );
}

function ConsentRow({
  label,
  checked,
  onChange,
  onOpenDoc,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  onOpenDoc: () => void;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        <Checkbox checked={checked} onChange={onChange} label={label} />
      </View>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={`${label} 자세히`}
        onPress={onOpenDoc}
        hitSlop={6}
      >
        <Text style={styles.detailLink}>자세히</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
    padding: 14,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    backgroundColor: storybookTheme.color.surfaceWhite,
  },
  allRow: { paddingVertical: 4 },
  divider: {
    height: 1,
    backgroundColor: storybookTheme.color.pillBorder,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  itemMain: { flex: 1 },
  detailLink: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.primary,
    fontWeight: storybookTheme.type.weight.semibold,
    textDecorationLine: 'underline',
  },
});

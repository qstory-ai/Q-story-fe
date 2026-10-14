import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Checkbox, storybookTheme } from '@/shared/ui';

import {
  GUARDIAN_CONSENT_LABEL,
  ORG_GUARDIAN_ACK_DESCRIPTION,
  ORG_GUARDIAN_ACK_LABEL,
  OVERSEAS_TRANSFER_DOMESTIC_NOTE,
  OVERSEAS_TRANSFER_LABEL,
  OVERSEAS_TRANSFER_RECIPIENTS,
  OVERSEAS_TRANSFER_REFUSAL,
  OVERSEAS_TRANSFER_SUMMARY,
  OVERSEAS_TRANSFER_TIMING,
} from '../model/overseas-transfer';

/**
 * IA "회원가입 > 약관 동의" - 필수(서비스 이용약관·개인정보 수집·이용·개인정보 국외 이전, 보호자는 법정대리인 확인까지)와
 * 선택(마케팅 정보 수신 동의). 전체 동의 상단 토글은 화면에 보이는 항목이 모두 켜졌을 때만 켜진 것으로 보인다.
 *
 * 보호자 가입에는 선택 항목 "화면 녹화 허용"(recording)이 하나 더 붙는다 - 약관 동의 기록(consents)이 아니라
 * 가입 뒤 계정의 화면 녹화 결정(POST /v1/me/recording-consent)으로 남긴다. 체크하지 않아도 결정으로 남는다.
 *
 * 각 항목 옆의 "자세히" 링크는 정식 URL이 확정되면 붙일 자리 - 지금은 안내 콜백만 호출한다.
 */

export type TermsConsentRole = 'PARENT' | 'TUTOR' | 'DIRECTOR';

export type TermsConsentState = {
  service: boolean;
  privacy: boolean;
  marketing: boolean;
  /** 만 14세 미만 아이의 법정대리인 확인 - 보호자 가입에만 보이고 필수다. */
  guardian: boolean;
  /** 개인정보 국외 이전 동의 - 모든 가입에 필수. */
  overseas: boolean;
};

export const EMPTY_TERMS_CONSENT: TermsConsentState = {
  service: false,
  privacy: false,
  marketing: false,
  guardian: false,
  overseas: false,
};

export function termsConsentIsValid(consent: TermsConsentState, role: TermsConsentRole): boolean {
  return consent.service && consent.privacy && consent.overseas && (role !== 'PARENT' || consent.guardian);
}

/** 개인정보 수집·이용 항목의 설명 - 연락처는 가려 저장하고, 리포트에는 아이가 한 말이 그대로 보인다(A2, Q-39). */
export const PRIVACY_CONSENT_DESCRIPTION =
  '아이가 말하거나 쓴 질문 문장과 캐릭터의 답은 서비스 개선을 위해 1년 보관하고, 전화번호·이메일 같은 연락처는 가려서 저장해요. 리포트에는 아이가 한 말이 그대로 보여요. 아이 음성 원본은 보호자가 따로 동의한 경우에만 1년 보관해요.';

type Props = {
  value: TermsConsentState;
  onChange: (next: TermsConsentState) => void;
  /** 가입하는 역할 - 보호자에게만 법정대리인 확인 항목이 보인다. */
  role: TermsConsentRole;
  /** "자세히" 링크를 눌렀을 때 호출 - 정식 문서 URL이 아직 없어 상위에서 안내 처리한다. */
  onOpenDoc?: (kind: 'service' | 'privacy' | 'marketing') => void;
  /** 보호자 가입의 선택 항목 "화면 녹화 허용". 없으면 보이지 않는다. */
  recording?: { checked: boolean; onChange: (next: boolean) => void };
};

export function TermsConsent({ value, onChange, role, onOpenDoc, recording }: Props) {
  const showGuardian = role === 'PARENT';
  const allChecked =
    value.service &&
    value.privacy &&
    value.marketing &&
    value.overseas &&
    (showGuardian ? value.guardian : true) &&
    (recording ? recording.checked : true);

  function toggleAll(next: boolean) {
    onChange({ service: next, privacy: next, marketing: next, overseas: next, guardian: showGuardian ? next : false });
    recording?.onChange(next);
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
        description={PRIVACY_CONSENT_DESCRIPTION}
        checked={value.privacy}
        onChange={(next) => onChange({ ...value, privacy: next })}
        onOpenDoc={() => onOpenDoc?.('privacy')}
      />
      <OverseasTransferConsent checked={value.overseas} onChange={(next) => onChange({ ...value, overseas: next })} />
      {showGuardian ? (
        <GuardianConsent checked={value.guardian} onChange={(next) => onChange({ ...value, guardian: next })} />
      ) : null}
      <ConsentRow
        label="[선택] 마케팅 정보 수신 동의"
        checked={value.marketing}
        onChange={(next) => onChange({ ...value, marketing: next })}
        onOpenDoc={() => onOpenDoc?.('marketing')}
      />
      {recording ? (
        <View style={styles.itemRow}>
          <View style={styles.itemMain}>
            <Checkbox
              checked={recording.checked}
              onChange={recording.onChange}
              label="[선택] 화면 녹화 허용"
              description="서비스 개선용, 1년 보관. 입력한 글자는 가려요. 허용하지 않아도 똑같이 이용할 수 있어요."
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** 법정대리인(보호자) 확인 - 가입 동의와 다시 동의 화면이 함께 쓴다. */
export function GuardianConsent({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        <Checkbox
          checked={checked}
          onChange={onChange}
          label={GUARDIAN_CONSENT_LABEL}
          description="아이는 직접 가입하지 않고 보호자 계정에서 이용해요. 아이 이름·출생연도와 이야기 중 질문 문장은 보호자 동의로 처리해요."
        />
      </View>
    </View>
  );
}

/** 기관 등록의 "원아의 보호자 동의를 받아 이용해요" 확인 - 기관 가입·기관 등록·다시 동의 화면이 함께 쓴다. */
export function OrgGuardianAck({ checked, onChange }: { checked: boolean; onChange: (next: boolean) => void }) {
  return (
    <Checkbox
      checked={checked}
      onChange={onChange}
      label={ORG_GUARDIAN_ACK_LABEL}
      description={ORG_GUARDIAN_ACK_DESCRIPTION}
    />
  );
}

/** 개인정보 국외 이전 동의 - "표 보기"로 이전받는 업체·국가·항목·목적·보관 기간을 펼친다. */
export function OverseasTransferConsent({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.overseasBlock}>
      <View style={styles.itemRow}>
        <View style={styles.itemMain}>
          <Checkbox
            checked={checked}
            onChange={onChange}
            label={OVERSEAS_TRANSFER_LABEL}
            description={OVERSEAS_TRANSFER_SUMMARY}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={open ? '국외 이전 표 접기' : '국외 이전 표 보기'}
          aria-expanded={open}
          onPress={() => setOpen((prev) => !prev)}
          hitSlop={6}
        >
          <Text style={styles.detailLink}>{open ? '접기' : '표 보기'}</Text>
        </Pressable>
      </View>
      {open ? (
        <View style={styles.transferTable}>
          {OVERSEAS_TRANSFER_RECIPIENTS.map((row) => (
            <View key={row.recipient} style={styles.transferRow}>
              <Text style={styles.transferTitle}>
                {row.recipient} · {row.country}
              </Text>
              <Text style={styles.transferText}>보내는 정보: {row.items}</Text>
              <Text style={styles.transferText}>목적: {row.purpose}</Text>
              <Text style={styles.transferText}>보관: {row.retention}</Text>
              {row.optional ? <Text style={styles.transferText}>끄는 방법: {row.optional}</Text> : null}
            </View>
          ))}
          <Text style={styles.transferText}>시기·방법: {OVERSEAS_TRANSFER_TIMING}</Text>
          <Text style={styles.transferText}>{OVERSEAS_TRANSFER_DOMESTIC_NOTE}</Text>
          <Text style={styles.transferText}>{OVERSEAS_TRANSFER_REFUSAL}</Text>
        </View>
      ) : null}
    </View>
  );
}

function ConsentRow({
  label,
  description,
  checked,
  onChange,
  onOpenDoc,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  onOpenDoc: () => void;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={styles.itemMain}>
        <Checkbox checked={checked} onChange={onChange} label={label} description={description} />
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
  overseasBlock: { gap: 6 },
  transferTable: {
    gap: 8,
    padding: 10,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.pillBorder,
  },
  transferRow: { gap: 2 },
  transferTitle: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  transferText: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardMuted,
  },
});

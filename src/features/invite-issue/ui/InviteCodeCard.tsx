import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';

/**
 * IA "코드 발급 → 연결" 흐름에서 발급 결과(짧은 코드 + URL)를 한 카드에 노출한다. 선생님이
 * 학생 부모에게, 그리고 기관 관리자가 선생님에게 전달하는 두 경우가 완전히 같은 형태로 렌더된다.
 * 복사 버튼은 navigator.clipboard가 있는 브라우저에서만 활성화하고, 없는 환경에서는 값을
 * 그대로 보여주기만 한다.
 */

type Props = {
  shortCode: string;
  link: string;
  /** 만료 표기 - 상위에서 이미 포맷팅한 문자열(예: "8월 24일 오후 4시")을 그대로 넘긴다. */
  expiresLabel?: string;
  onDismiss?: () => void;
};

async function copy(value: string) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

export function InviteCodeCard({ shortCode, link, expiresLabel, onDismiss }: Props) {
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator?.clipboard);
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>발급된 초대</Text>
      <Text style={styles.description}>
        아래 코드 또는 링크를 상대방에게 전달해 주세요. 한 번만 사용할 수 있고, 사용된 뒤에는 다시 쓸 수 없어요.
      </Text>

      <View style={styles.row}>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>코드</Text>
          <Text style={styles.codeText} accessibilityLabel={`초대 코드 ${shortCode}`}>{shortCode}</Text>
        </View>
        <CopyButton value={shortCode} enabled={canCopy} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>링크</Text>
          <Text style={styles.linkText} numberOfLines={1}>{link}</Text>
        </View>
        <CopyButton value={link} enabled={canCopy} />
      </View>

      {expiresLabel ? <Text style={styles.footnote}>{expiresLabel}까지 유효해요.</Text> : null}
      {onDismiss ? (
        <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismissLink}>
          <Text style={styles.dismissLinkText}>닫기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CopyButton({ value, enabled }: { value: string; enabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${value} 복사`}
      disabled={!enabled}
      onPress={() => { void copy(value); }}
      style={({ pressed }) => [styles.copyButton, !enabled && styles.copyButtonDisabled, pressed && styles.pressed]}
    >
      <Text style={[styles.copyLabel, !enabled && styles.copyLabelDisabled]}>복사</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.gold,
    // spacing.md(16)와 ml(20) 사이 - 초대 카드는 좁은 폭에서도 여유 있게 보여야 해 18 유지.
    padding: 18,
    gap: storybookTheme.spacing.sm,
  },
  eyebrow: {
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.gold,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardBody,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  rowBody: { flex: 1, gap: 2 },
  rowLabel: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onCardMuted,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  codeText: {
    fontSize: storybookTheme.type.lg,
    letterSpacing: 2,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  linkText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardBody,
  },
  copyButton: {
    // pill 버튼 안쪽 여백 - spacing.ms(12)와 md(16) 사이. 코드 두 글자짜리 라벨에 맞춘 14 유지.
    paddingHorizontal: 14,
    paddingVertical: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.primary,
  },
  copyButtonDisabled: { backgroundColor: storybookTheme.color.disabledBackground },
  pressed: { opacity: 0.85 },
  copyLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDark,
  },
  copyLabelDisabled: { color: storybookTheme.color.disabledText },
  footnote: {
    marginTop: storybookTheme.spacing.xs,
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onCardMuted,
  },
  dismissLink: {
    alignSelf: 'flex-end',
    // 닫기 링크 히트 영역 - xs(4)와 sm(8) 사이의 컴팩트 값, 링크 텍스트 주변 여백만 확보.
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  dismissLinkText: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
    textDecorationLine: 'underline',
  },
});

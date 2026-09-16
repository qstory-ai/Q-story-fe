import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, storybookTheme } from '@/shared/ui';

/**
 * IA "코드 발급 → 연결" 흐름에서 발급 결과(짧은 코드 + URL)를 한 카드에 노출한다. 선생님이
 * 학생 부모에게, 그리고 기관 관리자가 선생님에게 전달하는 두 경우가 완전히 같은 형태로 렌더된다.
 * 복사 버튼은 navigator.clipboard가 있는 브라우저에서만 활성화하고, 없는 환경에서는 값을
 * 그대로 보여주기만 한다. 폰(navigator.share가 있는 환경)에서는 "공유하기"로 카카오톡/문자 등
 * OS 공유 시트를 곧장 연다 - 선생님이 실제로 초대를 건네는 순간은 거의 항상 폰이라서.
 */

type Props = {
  shortCode: string;
  link: string;
  /** 만료 표기 - 상위에서 이미 포맷팅한 문자열(예: "8월 24일 오후 4시")을 그대로 넘긴다. */
  expiresLabel?: string;
  /** 공유 시트/복사에 실릴 안내 문장 - 예: "민서 부모님, Q-Story 수업 연결 초대예요." */
  shareMessage?: string;
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

const COPIED_FEEDBACK_MS = 1600;

export function InviteCodeCard({ shortCode, link, expiresLabel, shareMessage, onDismiss }: Props) {
  const canCopy = typeof navigator !== 'undefined' && Boolean(navigator?.clipboard);
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const shareText = `${shareMessage ? `${shareMessage}\n` : ''}초대 코드: ${shortCode}\n${link}`;
  const [shareError, setShareError] = useState<string | null>(null);

  const onShare = async () => {
    setShareError(null);
    try {
      await navigator.share({ text: shareText });
    } catch (failure) {
      // 사용자가 시트를 그냥 닫으면 AbortError - 오류가 아니다.
      if (failure instanceof Error && failure.name === 'AbortError') return;
      setShareError('공유 창을 열지 못했어요. 아래 복사 버튼을 대신 써 주세요.');
    }
  };

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
          {/* numberOfLines={1}이던 걸 지웠다 - 토큰이 길어(32자) 한 줄로 자르면 항상
              "https://…" 형태로 잘려 사용자가 실제로 뭘 복사하는지 확인할 수 없었다.
              그대로 줄바꿈해 전체 링크가 보이게 한다. */}
          <Text style={styles.linkText}>{link}</Text>
        </View>
        <CopyButton value={link} enabled={canCopy} />
      </View>

      {canShare ? (
        <View style={styles.shareRow}>
          <ActionButton variant="gold" label="카카오톡·문자로 공유하기" onPress={() => { void onShare(); }} />
        </View>
      ) : canCopy ? (
        <View style={styles.shareRow}>
          <CopyButton value={shareText} enabled label="안내 문장과 함께 복사" wide />
        </View>
      ) : null}
      {shareError ? <Text style={styles.shareError}>{shareError}</Text> : null}

      {expiresLabel ? <Text style={styles.footnote}>{expiresLabel}까지 유효해요.</Text> : null}
      {onDismiss ? (
        <Pressable accessibilityRole="button" onPress={onDismiss} style={styles.dismissLink}>
          <Text style={styles.dismissLinkText}>닫기</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function CopyButton({
  value,
  enabled,
  label = '복사',
  wide = false,
}: {
  value: string;
  enabled: boolean;
  label?: string;
  wide?: boolean;
}) {
  // 눌렀을 때 "복사됨"으로 잠깐 바뀌어야 실제로 복사됐는지 알 수 있다 - 예전엔 아무 반응이
  // 없어서 여러 번 누르거나 정말 복사됐는지 붙여넣어 확인해야 했다.
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onPress = async () => {
    const ok = await copy(value);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
  };

  return (
    <Pressable
      accessibilityRole="button"
      // 코드/링크 두 버튼이 나란히 있으니 무엇을 복사하는지 값으로 구분해 읽어 준다.
      accessibilityLabel={`${label === '복사' ? `${value} 복사` : label}${copied ? ', 복사됨' : ''}`}
      accessibilityLiveRegion="polite"
      disabled={!enabled}
      onPress={() => { void onPress(); }}
      style={({ pressed }) => [
        styles.copyButton,
        wide && styles.copyButtonWide,
        copied && styles.copyButtonCopied,
        !enabled && styles.copyButtonDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.copyLabel, !enabled && styles.copyLabelDisabled]}>
        {copied ? '복사됨 ✓' : label}
      </Text>
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
    // xs(12)였던 걸 sm(14)로 - 카드 안에서 가장 먼저 읽는 안내 문장인데 아래 라벨류보다도
    // 작아서 정작 중요한 설명이 눈에 덜 띄었다.
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
  },
  row: {
    flexDirection: 'row',
    // 링크 텍스트가 이제 여러 줄로 줄바꿈될 수 있어(아래 linkText) center로 맞추면 복사
    // 버튼이 어중간하게 걸린다 - 버튼을 첫 줄 높이에 맞춰 위쪽 정렬한다.
    alignItems: 'flex-start',
    gap: storybookTheme.spacing.sm,
    paddingVertical: storybookTheme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  rowBody: { flex: 1, gap: 4 },
  rowLabel: {
    // xxs(10)였던 걸 xs(12)로 - 코드/링크가 뭘 가리키는지 알려주는 라벨이 본문보다도 작아
    // 잘 안 읽혔다.
    fontSize: storybookTheme.type.xs,
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
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  shareRow: { marginTop: storybookTheme.spacing.xs },
  shareError: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.error },
  copyButton: {
    // pill 버튼 안쪽 여백 - spacing.ms(12)와 md(16) 사이. 코드 두 글자짜리 라벨에 맞춘 14 유지.
    paddingHorizontal: 14,
    paddingVertical: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.primary,
    minWidth: 64,
    alignItems: 'center',
  },
  copyButtonWide: { alignSelf: 'stretch', minHeight: 48, justifyContent: 'center' },
  copyButtonCopied: { backgroundColor: storybookTheme.semantic.positive.default },
  copyButtonDisabled: { backgroundColor: storybookTheme.color.disabledBackground },
  pressed: { opacity: 0.85 },
  copyLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.semantic.brand.onBrand,
  },
  copyLabelDisabled: { color: storybookTheme.color.disabledText },
  footnote: {
    marginTop: storybookTheme.spacing.xs,
    fontSize: storybookTheme.type.xs,
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

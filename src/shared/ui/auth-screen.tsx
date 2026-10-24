import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BrandLockup } from './brand-lockup';
import { SafeAreaView } from './safe-area-view';
import { storybookTheme } from './theme';
import { radius, responsive, semanticColors, shadow, space } from './tokens';

const L = semanticColors.light;

type AuthColumnProps = {
  children: ReactNode;
  /** 왼쪽 위 되돌아가기 링크. 생략하면 숨긴다. */
  onBack?: () => void;
  /** 되돌아가기 링크 문구 - 기본 "← 이전". */
  backLabel?: string;
  /** 워드마크(BrandLockup compact, 제목과 같은 왼쪽 축). 기본 표시. */
  showLogo?: boolean;
};

/**
 * 로그인·가입·재설정·온보딩·재동의 화면이 함께 쓰는 한 줄 컬럼 - 폭 420(layout.contentMaxWidth), 좌우 20,
 * 위에서부터 쌓는다. 되돌아가기 링크와 로고는 컬럼 안 왼쪽 위에 두어 제목과 같은 축에 선다.
 * 바깥 셸이 따로 있는 화면(AppNavShell 안의 기관 등록)은 이것만 쓴다.
 */
export function AuthColumn({ children, onBack, backLabel = '← 이전', showLogo = true }: AuthColumnProps) {
  return (
    <View style={styles.column}>
      {onBack ? (
        <Pressable accessibilityRole="link" hitSlop={8} style={styles.backLink} onPress={onBack}>
          <Text style={styles.backLinkText}>{backLabel}</Text>
        </Pressable>
      ) : null}
      {showLogo ? (
        <View style={[styles.logo, !onBack && styles.logoTop]}>
          <BrandLockup size="compact" />
        </View>
      ) : null}
      {children}
    </View>
  );
}

type AuthScreenProps = AuthColumnProps;

/** 인증 흐름 화면 셸 - 따뜻한 아이보리 바탕 + 스크롤 + AuthColumn. */
export function AuthScreen(props: AuthScreenProps) {
  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.screen}>
      {/* 가입 폼은 폰 세로 화면보다 길어 스크롤한다. keyboardShouldPersistTaps로 입력 중 버튼 탭이
          키보드 닫기에 먹히지 않게 한다. */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <AuthColumn {...props} />
      </ScrollView>
    </SafeAreaView>
  );
}

/** 폼 카드는 태블릿(744) 이상에서만 - 폰에서는 카드 padding이 화면 여백과 겹쳐 입력 폭이 줄어서 두지 않는다. */
export function useAuthFormCardStyle() {
  const { width } = useWindowDimensions();
  return width >= responsive.frame.tablet ? styles.formCard : null;
}

type AuthLinkProps = {
  label: string;
  onPress: () => void;
  /** 링크 앞 보통 글씨(예: "이미 계정이 있으신가요? "). */
  prefix?: string;
  /** 기본은 주 버튼 아래 가운데. "비밀번호를 잊으셨나요?"만 오른쪽. */
  align?: 'center' | 'end';
  accessibilityRole?: 'link' | 'button';
  accessibilityLabel?: string;
  disabled?: boolean;
};

/** 인증 화면의 보조 링크(12 bold 밑줄) - 주 버튼 아래 가운데가 기본. */
export function AuthLink({
  label,
  onPress,
  prefix,
  align = 'center',
  accessibilityRole = 'link',
  accessibilityLabel,
  disabled = false,
}: AuthLinkProps) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      aria-disabled={disabled}
      disabled={disabled}
      hitSlop={4}
      onPress={onPress}
      style={[styles.linkRow, align === 'end' ? styles.linkRowEnd : styles.linkRowCenter]}
    >
      {prefix ? <Text style={authText.note}>{prefix}</Text> : null}
      <Text style={[authText.link, disabled && styles.linkDisabled]}>{label}</Text>
    </Pressable>
  );
}

/** 인증 화면 글자 스타일 - 눈썹·제목(24 bold)·리드(왼쪽)·보조 글·링크. */
export const authText = StyleSheet.create({
  eyebrow: {
    color: storybookTheme.color.primary,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    letterSpacing: 0.4,
    marginTop: 8,
  },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.bold,
    marginTop: 4,
  },
  lead: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
    fontWeight: storybookTheme.type.weight.light,
    textAlign: 'left',
  },
  note: { color: storybookTheme.color.onContentMuted, fontSize: storybookTheme.type.sm },
  link: {
    color: storybookTheme.color.linkOnLight,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    textDecorationLine: 'underline',
  },
});

const styles = StyleSheet.create({
  // 랜딩처럼 따뜻한 아이보리 바탕.
  screen: { flex: 1, width: '100%', backgroundColor: L.bg.warm },
  scroll: { flex: 1, width: '100%' },
  scrollContent: { flexGrow: 1, width: '100%' },
  column: {
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  backLink: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backLinkText: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  logo: { alignItems: 'flex-start', marginTop: space[8], marginBottom: space[8] },
  logoTop: { marginTop: space[16] },
  formCard: {
    marginTop: space[8],
    padding: space[24],
    borderRadius: radius[24],
    backgroundColor: L.bg.primary,
    borderWidth: 1,
    borderColor: L.border.secondary,
    ...shadow(2),
  },
  linkRow: { flexDirection: 'row', flexWrap: 'wrap', minHeight: 44, alignItems: 'center' },
  linkRowCenter: { justifyContent: 'center', alignSelf: 'stretch' },
  linkRowEnd: { alignSelf: 'flex-end' },
  linkDisabled: { opacity: 0.5 },
});

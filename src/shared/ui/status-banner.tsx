import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type StatusBannerProps = {
  label: string;
  body?: string;
  variant?: 'info' | 'warning' | 'success';
};

/**
 * 라이트 카드 위의 작은 상태 배너. info/warning은 theme.status, success는 theme.semantic.positive를 쓴다.
 */
export function StatusBanner({ label, body, variant = 'info' }: StatusBannerProps) {
  const isWarning = variant === 'warning';
  const isSuccess = variant === 'success';
  return (
    <View
      style={[styles.base, isWarning ? styles.warning : isSuccess ? styles.success : styles.info]}
      accessibilityLiveRegion="polite"
      accessibilityRole={isWarning ? 'alert' : undefined}
    >
      <Text style={styles.label}>{label}</Text>
      {body ? (
        <Text style={[styles.body, isWarning && styles.bodyWarning, isSuccess && styles.bodySuccess]}>
          {body}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  info: {
    backgroundColor: storybookTheme.status.info.background,
    borderColor: storybookTheme.status.info.border,
  },
  warning: {
    backgroundColor: storybookTheme.status.warning.background,
    borderColor: storybookTheme.status.warning.border,
  },
  success: {
    backgroundColor: storybookTheme.semantic.positive.background,
    borderColor: storybookTheme.semantic.positive.border,
  },
  label: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onLightHeading,
  },
  body: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.regular,
    color: storybookTheme.color.onLightBody,
  },
  bodyWarning: {
    color: storybookTheme.status.warning.text,
  },
  bodySuccess: {
    color: storybookTheme.semantic.positive.text,
  },
});

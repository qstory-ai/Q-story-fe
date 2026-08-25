import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type StatusBannerProps = {
  label: string;
  body?: string;
  variant?: 'info' | 'warning';
};

/**
 * 라이트 카드 위의 작은 상태 배너 - organization-signup의 구독 상태 카드와 staff-scene의
 * "stale" 카드가 각자 미묘하게 다른 근접값을 하드코딩하던 걸 하나로 모았다.
 */
export function StatusBanner({ label, body, variant = 'info' }: StatusBannerProps) {
  const isWarning = variant === 'warning';
  return (
    <View style={[styles.base, isWarning ? styles.warning : styles.info]}>
      <Text style={styles.label}>{label}</Text>
      {body ? <Text style={[styles.body, isWarning && styles.bodyWarning]}>{body}</Text> : null}
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
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: storybookTheme.color.onLightHeading,
  },
  body: {
    fontSize: 12,
    fontWeight: '400',
    color: storybookTheme.color.onLightBody,
  },
  bodyWarning: {
    color: storybookTheme.status.warning.text,
  },
});

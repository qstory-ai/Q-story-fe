import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type StatusBannerProps = {
  label: string;
  body?: string;
  variant?: 'info' | 'warning' | 'success';
};

/**
 * 라이트 카드 위의 작은 상태 배너 - organization-signup의 구독 상태 카드와 staff-scene의
 * "stale" 카드가 각자 미묘하게 다른 근접값을 하드코딩하던 걸 하나로 모았다.
 * success는 theme.ts의 semantic.positive를 쓴다 - 이 앱에 성공/긍정 배너 색이 없어서
 * 새로 추가한 시맨틱 컬러 램프를 여기서 처음 실사용한다.
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

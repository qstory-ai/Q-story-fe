import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

export type ActionButtonVariant =
  | 'primary'
  | 'secondary'
  | 'secondaryFull'
  | 'record'
  | 'stop';

type ActionButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ActionButtonVariant;
  disabled?: boolean;
  icon?: string;
  /** Solid 2.0 버튼 상태 카탈로그의 Loading - 라벨 대신 스피너를 보여주고 프레스를 막는다. */
  loading?: boolean;
};

/**
 * 제품 화면에서 "하나의 Text 레이블을 감싼 Pressable"이라는 동일한 마크업이
 * 약 15곳의 호출부에서 반복됐고, variant에 따라 색상/너비만 달랐다.
 * 이를 하나의 컴포넌트로 통합한다.
 */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
  loading = false,
}: ActionButtonProps) {
  const isSecondary = variant === 'secondary' || variant === 'secondaryFull';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'secondaryFull' && styles.secondaryFull,
        variant === 'record' && styles.record,
        variant === 'stop' && styles.stop,
        disabled && !loading && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={isSecondary ? '#503267' : '#FFFFFF'} />
      ) : (
        <>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          <Text style={isSecondary ? styles.secondaryText : styles.primaryText}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
  },
  primary: {
    backgroundColor: '#43225F',
  },
  secondary: {
    flex: 1,
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#F0E8F5',
    paddingHorizontal: 12,
  },
  secondaryFull: {
    width: '100%',
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#F0E8F5',
    paddingHorizontal: 12,
  },
  record: {
    minHeight: 60,
    backgroundColor: '#E46647',
    borderRadius: 18,
  },
  stop: {
    minHeight: 56,
    backgroundColor: '#E46647',
    borderRadius: 17,
  },
  disabled: {
    opacity: 0.56,
  },
  icon: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryText: {
    color: '#503267',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});

import { Pressable, StyleSheet, Text } from 'react-native';

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
};

/**
 * The product screen repeated the same "Pressable wrapping one Text label"
 * markup across ~15 call sites with only the color/width varying by variant.
 * This consolidates that into one component.
 */
export function ActionButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  icon,
}: ActionButtonProps) {
  const isSecondary = variant === 'secondary' || variant === 'secondaryFull';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'secondaryFull' && styles.secondaryFull,
        variant === 'record' && styles.record,
        variant === 'stop' && styles.stop,
        disabled && styles.disabled,
      ]}
    >
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={isSecondary ? styles.secondaryText : styles.primaryText}>
        {label}
      </Text>
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
    fontWeight: '900',
  },
  secondaryText: {
    color: '#503267',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
  },
});

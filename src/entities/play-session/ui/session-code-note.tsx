import { StyleSheet, Text } from 'react-native';

import { storybookTheme } from '@/shared/ui';

import { sessionShortCode } from '../model/types';

/**
 * UT 회차 코드(Q-40) - 관찰자가 화면을 보고 적어 두면 UT 대시보드에서 같은 회차를 찾는다.
 * 회차 id가 없으면(옛 기록·로그인 전 체험) 그리지 않는다.
 */
export function SessionCodeNote({ sessionId, code }: { sessionId?: string | null; code?: string | null }) {
  const value = code ?? sessionShortCode(sessionId);
  if (!value) return null;
  return (
    <Text style={styles.note} accessibilityLabel={`회차 코드 ${value.split('').join(' ')}`} selectable>
      회차 코드 {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  note: {
    alignSelf: 'center',
    marginTop: storybookTheme.spacing.sm,
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
    letterSpacing: 0.5,
  },
});

import { Pressable, StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from './theme';

type AccountLinkRowProps = {
  onMyPage: () => void;
  onLogout: () => void;
};

/**
 * "마이페이지"/"로그아웃" 링크 한 쌍 - 계정에서 빠져나갈 다른 방법이 없는 대시보드형
 * 화면(ParentHomePage/ClassDashboardPage/OrganizationSignupPage/StaffHomePage)에서 반복되던
 * 걸 하나로 모았다. shared/ui는 entities에 의존하지 않는 레이어라 useAuth()/useNavigate()를
 * 직접 쓰지 않고 콜백을 props로 받는다 - 실제 훅 호출은 각 페이지가 담당한다.
 */
export function AccountLinkRow({ onMyPage, onLogout }: AccountLinkRowProps) {
  return (
    <View style={styles.row}>
      <Pressable onPress={onMyPage} accessibilityRole="link" hitSlop={8} style={styles.linkTarget}>
        <Text style={styles.link}>마이페이지</Text>
      </Pressable>
      <Pressable onPress={onLogout} accessibilityRole="button" hitSlop={8} style={styles.linkTarget}>
        <Text style={styles.link}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  linkTarget: {
    minHeight: 44,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    fontSize: 13,
    color: storybookTheme.color.onLightMuted,
    fontWeight: '500',
  },
});

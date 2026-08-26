import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, storybookTheme } from '@/shared/ui';

/** 매칭되지 않는 모든 경로에 대한 캐치올 - 이게 없으면 오타가 있거나 오래된 링크는 그냥 빈 페이지를 렌더링하게 된다. */
export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">이 페이지를 찾을 수 없어요</Text>
        <Text style={styles.body}>주소가 바뀌었거나 잘못 입력된 것 같아요.</Text>
        <ActionButton label="처음 화면으로" onPress={() => navigate('/')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
  },
  title: {
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: '600',
    color: storybookTheme.color.onDark,
    textAlign: 'center',
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onDarkMuted,
    textAlign: 'center',
  },
});

import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AccountLinkRow, ActionButton, SafeAreaView } from '@/shared/ui';
import { useAuth } from '@/entities/auth';

/**
 * 의도적으로 최소한만 구현했다 - 특정 학급 세션을 다시 재생하는 기능은 Phase 2(인증 계획 문서 참고)에서 다룬다.
 * 이 화면은 부모가 로그인되어 있는지만 확인하고 오늘의 이야기로 이동시켜 줄 뿐이다.
 */
export function ParentHomePage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>안녕하세요, {state.user.displayName}님</Text>
        <Text style={styles.body}>아이와 함께 오늘의 이야기를 시작해 보세요.</Text>
        <ActionButton label="이야기 시작하기" onPress={() => navigate('/home')} />
        <AccountLinkRow onMyPage={() => navigate('/mypage')} onLogout={logout} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F1FB',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#43225F',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#6B5478',
    textAlign: 'center',
  },
});

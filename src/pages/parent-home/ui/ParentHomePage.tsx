import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView } from '@/shared/ui';
import { useAuth } from '@/entities/auth';

/**
 * Minimal by design - replaying a specific class session is Phase 2 (see the auth plan doc).
 * This just confirms the parent is signed in and gets them to today's story.
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
        <ActionButton label="이야기 시작하기" onPress={() => navigate('/demo')} />
        <Pressable onPress={logout} accessibilityRole="button">
          <Text style={styles.logout}>로그아웃</Text>
        </Pressable>
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
    fontWeight: '900',
    color: '#43225F',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: '#6B5478',
    textAlign: 'center',
  },
  logout: {
    fontSize: 13,
    color: '#9C87AC',
    textAlign: 'center',
    fontWeight: '700',
  },
});

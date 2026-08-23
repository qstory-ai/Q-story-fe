import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView } from '@/shared/ui';
import { AuthApiError, fetchClass, useAuth, type ClassResponse } from '@/entities/auth';

/** Minimal by design for this phase - just enough for a teacher to find today's join code and start the story. */
export function ClassDashboardPage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const [classGroup, setClassGroup] = useState<ClassResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const classId = state.status === 'authenticated' ? state.user.classId : null;
  const token = state.status === 'authenticated' ? state.token : null;

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'CLASS_ACCOUNT') {
      navigate('/', { replace: true });
      return;
    }
    if (!token || !classId) return;
    fetchClass(token, classId)
      .then(setClassGroup)
      .catch((failure) =>
        setError(failure instanceof AuthApiError ? failure.message : '반 정보를 불러오지 못했어요.'),
      );
  }, [state, token, classId, navigate]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{classGroup?.name ?? '우리 반'}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {classGroup ? (
          <View style={styles.card}>
            <Text style={styles.label}>반 코드</Text>
            <Text style={styles.code}>{classGroup.joinCode}</Text>
            <Text style={styles.body}>학부모님께 이 코드를 알려주세요.</Text>
          </View>
        ) : null}
        <ActionButton label="오늘 이야기 시작하기" onPress={() => navigate('/')} />
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
    fontSize: 22,
    fontWeight: '900',
    color: '#43225F',
    textAlign: 'center',
  },
  card: {
    gap: 6,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0D3EA',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#503267',
  },
  code: {
    fontSize: 28,
    fontWeight: '900',
    color: '#43225F',
    letterSpacing: 2,
  },
  body: {
    fontSize: 13,
    color: '#6B5478',
    textAlign: 'center',
  },
  error: {
    fontSize: 13,
    color: '#E46647',
  },
  logout: {
    fontSize: 13,
    color: '#9C87AC',
    textAlign: 'center',
    fontWeight: '700',
  },
});

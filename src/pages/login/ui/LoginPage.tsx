import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField } from '@/shared/ui';
import { AuthApiError, login, useAuth, type UserSummary } from '@/entities/auth';

export function homePathFor(user: UserSummary): string {
  switch (user.role) {
    case 'DIRECTOR':
      return '/organization';
    case 'CLASS_ACCOUNT':
      return '/home';
    case 'PARENT':
      return '/home';
    case 'STAFF':
      return '/staff';
    default:
      return '/';
  }
}

/** 역할과 무관함 - loginId는 DIRECTOR/PARENT의 경우 이메일이고, CLASS_ACCOUNT의 경우 원장이 발급한 핸들이다. */
export function LoginPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await login({ loginId: loginId.trim(), password });
      setSession(response.token, response.user);
      navigate(homePathFor(response.user), { replace: true });
    } catch (failure) {
      setError(failure instanceof AuthApiError ? failure.message : '로그인하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [loginId, password, navigate, setSession]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>로그인</Text>
        <TextField
          label="아이디"
          value={loginId}
          onChangeText={setLoginId}
          placeholder="이메일 또는 반 아이디"
          keyboardType="email-address"
        />
        <TextField
          label="비밀번호"
          value={password}
          onChangeText={setPassword}
          placeholder="비밀번호"
          secureTextEntry
          errorText={error ?? undefined}
        />
        <ActionButton
          label="로그인"
          loading={submitting}
          onPress={onSubmit}
          disabled={!loginId.trim() || !password}
        />
        <View style={styles.links}>
          <Pressable onPress={() => navigate('/signup?role=organization')} accessibilityRole="link">
            <Text style={styles.link}>기관 및 단체를 운영하시나요? 등록하기</Text>
          </Pressable>
          <Pressable onPress={() => navigate('/signup?role=parent')} accessibilityRole="link">
            <Text style={styles.link}>학부모이신가요? 반 코드로 가입하기</Text>
          </Pressable>
        </View>
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
    fontWeight: '700',
    color: '#43225F',
    textAlign: 'center',
    marginBottom: 8,
  },
  links: {
    marginTop: 12,
    gap: 8,
    alignItems: 'center',
  },
  link: {
    color: '#7A4FA0',
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'none',
  },
});

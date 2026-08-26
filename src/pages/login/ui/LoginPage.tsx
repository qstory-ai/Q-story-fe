import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { AuthApiError, homePathFor, login, useAuth, type UserSummary } from '@/entities/auth';
import { SocialLoginButtons } from '@/features/oauth-login';

/** Role-agnostic - loginId is an email for DIRECTOR/PARENT or a director-issued handle for CLASS_ACCOUNT. */
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

  const onAuthed = useCallback(
    (token: string, user: UserSummary) => {
      setSession(token, user);
      navigate(homePathFor(user), { replace: true });
    },
    [navigate, setSession],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">로그인</Text>
        <View style={styles.card}>
          <TextField
            label="아이디"
            value={loginId}
            onChangeText={setLoginId}
            placeholder="아이디"
          />
          <View style={styles.passwordField}>
            <TextField
              label="비밀번호"
              value={password}
              onChangeText={setPassword}
              placeholder="비밀번호"
              secureTextEntry
              errorText={error ?? undefined}
            />
            <Pressable onPress={() => navigate('/reset-password')} accessibilityRole="link" style={styles.forgotPasswordLink}>
              <Text style={styles.forgotPasswordText}>비밀번호를 잊으셨나요?</Text>
            </Pressable>
          </View>
          <ActionButton
            label={submitting ? '로그인 중…' : '로그인'}
            onPress={onSubmit}
            disabled={submitting || !loginId.trim() || !password}
          />
          <SocialLoginButtons onAuthed={onAuthed} onDark={false} />
        </View>
        <Pressable onPress={() => navigate('/signup')} accessibilityRole="link" style={styles.signupLinkRow}>
          <Text style={styles.body}>아직 계정이 없으신가요? </Text>
          <Text style={styles.signupLink}>회원가입</Text>
        </Pressable>
        <View style={styles.links}>
          <Pressable onPress={() => navigate('/organization')} accessibilityRole="link">
            <Text style={styles.link}>원장이신가요? 유치원 등록하기</Text>
          </Pressable>
          <Pressable onPress={() => navigate('/join')} accessibilityRole="link">
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
    backgroundColor: storybookTheme.color.shellBackground,
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
    fontSize: storybookTheme.type.lg,
    fontWeight: '900',
    color: storybookTheme.color.onLightHeading,
    textAlign: 'center',
    marginBottom: 8,
  },
  card: {
    gap: 16,
    padding: 24,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceWhite,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
    ...storybookTheme.elevation.low,
  },
  passwordField: {
    gap: 6,
  },
  forgotPasswordLink: {
    alignSelf: 'flex-end',
    minHeight: 32,
    justifyContent: 'center',
  },
  forgotPasswordText: {
    fontSize: storybookTheme.type.xs,
    fontWeight: '600',
    color: storybookTheme.color.linkOnLight,
  },
  signupLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: 32,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onLightBody,
  },
  signupLink: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '700',
    color: storybookTheme.color.linkOnLight,
  },
  links: {
    marginTop: 12,
    gap: 8,
    alignItems: 'center',
  },
  link: {
    color: storybookTheme.color.linkOnLight,
    fontSize: storybookTheme.type.sm,
    fontWeight: '700',
    textDecorationLine: 'none',
  },
});

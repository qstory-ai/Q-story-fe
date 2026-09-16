import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, SafeAreaView, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { confirmPasswordReset, homePathFor, requestPasswordReset, useAuth } from '@/entities/auth';
import { messageForError } from '@/shared/api';
import { PASSWORD_MIN_LENGTH } from '@/features/onboarding';

/**
 * `token` 쿼리 파라미터로 갈리는 두 단계 - SignupPage의 `role`/`invite` 파라미터와 같은 형태다.
 * 토큰이 없으면 "재설정 요청" 단계(loginId를 입력받아 항상 성공 응답을 반환한다 - 이유는
 * AuthService.requestPasswordReset 참고); 토큰이 있으면 "새 비밀번호 설정" 단계(재설정 과정에서
 * 전달됐을 링크)다. 로그인 폼의 "비밀번호를 잊으셨나요?"가 여기로 오며, 그때 입력 중이던 아이디를
 * navigate state로 넘겨 받아 미리 채운다.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  return token ? <ConfirmStep token={token} /> : <RequestStep />;
}

function BackToLogin() {
  const navigate = useNavigate();
  return (
    <Pressable
      accessibilityRole="link"
      hitSlop={8}
      style={styles.backLink}
      onPress={() => navigate('/login', { replace: true })}
    >
      <Text style={styles.backLinkText}>← 로그인으로</Text>
    </Pressable>
  );
}

function RequestStep() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialLoginId = (location.state as { loginId?: string } | null)?.loginId ?? '';
  const [loginId, setLoginId] = useState(initialLoginId);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = useCallback(async () => {
    if (!loginId.trim()) return;
    setSubmitting(true);
    try {
      await requestPasswordReset({ loginId: loginId.trim() });
    } catch {
      // 계정 존재 여부를 알려주지 않기 위해 실패해도 성공과 같은 화면을 보여준다.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }, [loginId]);

  if (sent) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <BackToLogin />
        <View style={styles.content}>
          <Text style={styles.title} accessibilityRole="header">안내를 보냈어요</Text>
          <Text style={styles.body}>
            입력하신 아이디로 등록된 계정이 있다면, 가입 때 적은 이메일로 재설정 방법을 안내해 드려요.
            메일이 보이지 않으면 스팸함도 확인해 주세요.
          </Text>
          <ActionButton label="로그인으로 돌아가기" onPress={() => navigate('/login', { replace: true })} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <BackToLogin />
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">비밀번호 재설정</Text>
        <Text style={styles.body}>가입할 때 쓴 아이디를 입력해 주세요.</Text>
        <TextField
          label="아이디"
          value={loginId}
          onChangeText={setLoginId}
          placeholder="아이디"
          autoComplete="username"
          returnKeyType="go"
          onSubmitEditing={() => { void onSubmit(); }}
        />
        <ActionButton
          label="재설정 방법 받기"
          loading={submitting}
          onPress={onSubmit}
          disabled={!loginId.trim()}
        />
      </View>
    </SafeAreaView>
  );
}

function ConfirmStep({ token }: { token: string }) {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const tooShort = newPassword.length > 0 && newPassword.length < PASSWORD_MIN_LENGTH;
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = newPassword.length >= PASSWORD_MIN_LENGTH && newPassword === confirmPassword && !submitting;

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await confirmPasswordReset({ token, newPassword });
      setSession(response.token, response.user);
      navigate(homePathFor(response.user), { replace: true });
    } catch (failure) {
      setError(
        messageForError(failure, '비밀번호를 바꾸지 못했어요. 재설정 링크가 만료됐거나 이미 사용됐을 수 있어요.'),
      );
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, token, newPassword, navigate, setSession]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <BackToLogin />
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">새 비밀번호 설정</Text>
        <TextField
          label="새 비밀번호"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          autoComplete="new-password"
          description={`${PASSWORD_MIN_LENGTH}자 이상`}
          errorText={tooShort ? `${PASSWORD_MIN_LENGTH}자 이상 입력해 주세요.` : undefined}
        />
        <TextField
          label="새 비밀번호 확인"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          returnKeyType="go"
          onSubmitEditing={() => { void onSubmit(); }}
          errorText={mismatch ? '비밀번호가 서로 달라요.' : undefined}
        />
        {error ? <StatusBanner variant="warning" label={error} /> : null}
        <ActionButton
          label="비밀번호 바꾸기"
          loading={submitting}
          onPress={onSubmit}
          disabled={!canSubmit}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
  },
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  backLinkText: {
    color: storybookTheme.color.onContentMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    paddingBottom: 48,
    maxWidth: storybookTheme.layout.contentMaxWidth,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
    textAlign: 'center',
  },
});

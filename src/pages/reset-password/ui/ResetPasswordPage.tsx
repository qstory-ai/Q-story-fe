import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { AuthApiError, confirmPasswordReset, requestPasswordReset, useAuth } from '@/entities/auth';
import { homePathFor } from '@/pages/login';

/**
 * `token` 쿼리 파라미터로 갈리는 두 단계 - SignupPage의 `role`/`invite` 파라미터와 같은 형태다.
 * 토큰이 없으면 "재설정 요청" 단계(loginId를 입력받아 항상 성공 응답을 반환한다 - 이유는
 * AuthService.requestPasswordReset 참고); 토큰이 있으면 "새 비밀번호 설정" 단계(재설정 과정에서
 * 전달됐을 링크)다. 아직 이메일 전송 provider가 연결되지 않아서 이 페이지는 LoginPage에서
 * 링크로 연결되어 있지 않다 - 지금은 URL로만 접근 가능하고, 실제로 재설정 메일이 발송되기
 * 시작하면 연결할 준비만 되어 있는 상태다.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  return token ? <ConfirmStep token={token} /> : <RequestStep />;
}

function RequestStep() {
  const [loginId, setLoginId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = useCallback(async () => {
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
        <View style={styles.content}>
          <Text style={styles.title}>비밀번호 재설정</Text>
          <Text style={styles.body}>
            입력하신 아이디로 등록된 계정이 있다면, 재설정 방법을 안내해 드려요.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>비밀번호 재설정</Text>
        <Text style={styles.body}>가입할 때 쓴 이메일을 입력해 주세요.</Text>
        <TextField
          label="아이디"
          value={loginId}
          onChangeText={setLoginId}
          placeholder="이메일"
          keyboardType="email-address"
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
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await confirmPasswordReset({ token, newPassword });
      setSession(response.token, response.user);
      navigate(homePathFor(response.user), { replace: true });
    } catch (failure) {
      setError(
        failure instanceof AuthApiError ? failure.message : '비밀번호를 바꾸지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [token, newPassword, navigate, setSession]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>새 비밀번호 설정</Text>
        <TextField
          label="새 비밀번호"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          errorText={error ?? undefined}
        />
        <ActionButton
          label="비밀번호 바꾸기"
          loading={submitting}
          onPress={onSubmit}
          disabled={newPassword.length < 8}
        />
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
    fontSize: 22,
    fontWeight: '700',
    color: storybookTheme.color.onLightHeading,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: storybookTheme.color.onLightBody,
    textAlign: 'center',
  },
});

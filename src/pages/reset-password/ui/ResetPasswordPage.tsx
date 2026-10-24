import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, AuthScreen, authText, enterFadeUp, StatusBanner, TextField, useAuthFormCardStyle } from '@/shared/ui';
import {
  confirmPasswordReset,
  homePathFor,
  isPasswordLongEnough,
  PASSWORD_RULE_HINT,
  PASSWORD_TOO_SHORT_MESSAGE,
  requestPasswordReset,
  useAuth,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';

/**
 * `token` 쿼리 파라미터로 갈리는 두 단계. 토큰이 없으면 "재설정 요청" 단계(loginId를 받아 항상 성공
 * 응답 - AuthService.requestPasswordReset 참고), 토큰이 있으면 메일 링크로 들어온 "새 비밀번호 설정"
 * 단계다. 로그인 폼의 "비밀번호를 잊으셨나요?"가 입력 중이던 아이디를 navigate state로 넘겨 미리 채운다.
 */
export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  return token ? <ConfirmStep token={token} /> : <RequestStep />;
}

/** 인증 셸 + 왼쪽 위 "← 로그인으로". */
function ResetScreen({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const formCard = useAuthFormCardStyle();
  return (
    // replace가 아니라 push - 메일로 받은 ?token= 링크 화면을 히스토리에서 지우면 뒤로가기로 못 돌아온다.
    <AuthScreen onBack={() => navigate('/login')} backLabel="← 로그인으로">
      <View style={[styles.form, formCard]}>{children}</View>
    </AuthScreen>
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
      <ResetScreen>
        <Text style={authText.title} accessibilityRole="header">안내를 보냈어요</Text>
        <Text style={authText.lead}>
          입력하신 아이디로 등록된 계정이 있다면, 가입 때 적은 이메일로 재설정 방법을 안내해 드려요.
          메일이 보이지 않으면 스팸함도 확인해 주세요.
        </Text>
        <ActionButton variant="gold" label="로그인으로 돌아가기" onPress={() => navigate('/login')} />
      </ResetScreen>
    );
  }

  return (
    <ResetScreen>
      <Text style={authText.title} accessibilityRole="header">비밀번호 재설정</Text>
      <Text style={authText.lead}>가입할 때 쓴 아이디를 입력해 주세요.</Text>
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
        variant="gold"
        label="재설정 방법 받기"
        loading={submitting}
        onPress={onSubmit}
        disabled={!loginId.trim()}
      />
    </ResetScreen>
  );
}

function ConfirmStep({ token }: { token: string }) {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const tooShort = newPassword.length > 0 && !isPasswordLongEnough(newPassword);
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit = isPasswordLongEnough(newPassword) && newPassword === confirmPassword && !submitting;

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
    <ResetScreen>
      <Text style={authText.title} accessibilityRole="header">새 비밀번호 설정</Text>
      <TextField
        label="새 비밀번호"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoComplete="new-password"
        description={PASSWORD_RULE_HINT}
        errorText={tooShort ? PASSWORD_TOO_SHORT_MESSAGE : undefined}
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
        variant="gold"
        label="비밀번호 바꾸기"
        loading={submitting}
        onPress={onSubmit}
        disabled={!canSubmit}
      />
    </ResetScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 14, ...enterFadeUp },
});

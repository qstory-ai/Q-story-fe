import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, Checkbox, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { AuthApiError, joinClass, signupParent, useAuth } from '@/entities/auth';

/**
 * This is parent signup - there is no separate "parent signup" page/route. Two backend paths
 * feed the same screen: ClassService.join() (exactly one of classCode/inviteToken) for a parent
 * whose child is enrolled in a partnered kindergarten, or AuthService.signupParent() (no class at
 * all) for a parent who isn't - the "우리 아이 반이 있어요" checkbox picks between them. An invite
 * link already answers that question, so the checkbox only shows without one.
 */
export function JoinClassPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [hasClass, setHasClass] = useState(true);
  const [classCode, setClassCode] = useState('');
  const [loginId, setLoginId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const useJoinFlow = Boolean(inviteToken) || hasClass;
  const showClassCodeField = !inviteToken && hasClass;

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const input = { loginId: loginId.trim(), email: email.trim(), password, displayName: displayName.trim() };
      const response = useJoinFlow
        ? await joinClass({
            ...(inviteToken ? { inviteToken } : { classCode: classCode.trim().toUpperCase() }),
            ...input,
          })
        : await signupParent(input);
      setSession(response.token, response.user);
      navigate('/parent', { replace: true });
    } catch (failure) {
      setError(failure instanceof AuthApiError ? failure.message : '가입하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [inviteToken, useJoinFlow, classCode, loginId, email, password, displayName, navigate, setSession]);

  const canSubmit =
    (showClassCodeField ? classCode.trim().length > 0 : true) &&
    loginId.trim() &&
    email.trim() &&
    password &&
    displayName.trim();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">학부모 가입</Text>
        {inviteToken ? (
          <Text style={styles.body}>초대 링크로 반이 확인됐어요.</Text>
        ) : (
          <>
            <Checkbox checked={hasClass} onChange={setHasClass} label="기관/단체에서 코드를 받았어요" />
            {hasClass ? (
              <TextField
                label="반 코드"
                value={classCode}
                onChangeText={setClassCode}
                autoCapitalize="characters"
                placeholder="선생님께 받은 코드"
              />
            ) : (
              <Text style={styles.body}>반 코드 없이 학부모 계정만 만들어요.</Text>
            )}
          </>
        )}
        <TextField label="아이디" value={loginId} onChangeText={setLoginId} placeholder="로그인에 쓸 아이디" />
        <TextField label="이메일" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField
          label="이름"
          value={displayName}
          onChangeText={setDisplayName}
          errorText={error ?? undefined}
        />
        <ActionButton
          label={submitting ? '가입 중…' : '가입하기'}
          onPress={onSubmit}
          disabled={submitting || !canSubmit}
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
    fontSize: storybookTheme.type.lg,
    fontWeight: '900',
    color: storybookTheme.color.onLightHeading,
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onLightBody,
  },
});

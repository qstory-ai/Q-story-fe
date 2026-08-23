import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField } from '@/shared/ui';
import { AuthApiError, joinClass, useAuth } from '@/entities/auth';

/**
 * This is parent signup - there is no separate "parent signup" page/route. Exactly one of
 * classCode or inviteToken is sent, matching ClassService.resolveClassGroup()'s XOR requirement.
 */
export function JoinClassPage() {
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [classCode, setClassCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await joinClass({
        ...(inviteToken ? { inviteToken } : { classCode: classCode.trim().toUpperCase() }),
        email: email.trim(),
        password,
        displayName: displayName.trim(),
      });
      setSession(response.token, response.user);
      navigate('/parent', { replace: true });
    } catch (failure) {
      setError(failure instanceof AuthApiError ? failure.message : '가입하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [inviteToken, classCode, email, password, displayName, navigate, setSession]);

  const canSubmit =
    (inviteToken ? true : classCode.trim().length > 0) && email.trim() && password && displayName.trim();

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>학부모 가입</Text>
        {inviteToken ? (
          <Text style={styles.body}>초대 링크로 반이 확인됐어요.</Text>
        ) : (
          <TextField
            label="반 코드"
            value={classCode}
            onChangeText={setClassCode}
            autoCapitalize="characters"
            placeholder="선생님께 받은 코드"
          />
        )}
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
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    color: '#6B5478',
  },
});

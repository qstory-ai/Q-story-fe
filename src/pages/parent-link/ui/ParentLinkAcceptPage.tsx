import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { homePathFor, login, useAuth, AuthApiError } from '@/entities/auth';
import { acceptTutorInvite, previewTutorInvite, TutorApiError, type TutorInvitePreview } from '@/entities/tutor';

type Stage = 'loading' | 'preview' | 'account' | 'consent' | 'error';

const SHARED_ITEMS = ['선생님이 진행한 질문·장면·리포트'];
const HIDDEN_ITEMS = ['가정 구독·결제·다른 이야기', '음성 원본과 아이의 성향 평가'];

/**
 * 방문 선생님의 부모 초대 수락 화면("/tutor-invite/:token") - q-story-flow-prototype.tsx의
 * ParentLinkScreen(preview→account→child→consent)을 이식했다. "child" 단계는 미리보기 카드가
 * 이미 그 역할을 겸하므로 생략했다 - 별도 재확인 단계를 추가하지 않는다.
 */
export function ParentLinkAcceptPage() {
  const { token: rawToken } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { state, setSession } = useAuth();
  const [stage, setStage] = useState<Stage>('loading');
  const [preview, setPreview] = useState<TutorInvitePreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 계정 단계 - 이미 로그인돼 있으면(state.status==='authenticated') 건너뛴다.
  const [hasAccount, setHasAccount] = useState(true);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [newLoginId, setNewLoginId] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [loggedInToken, setLoggedInToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!rawToken) return;
    previewTutorInvite(rawToken)
      .then((response) => {
        setPreview(response);
        setStage('preview');
      })
      .catch((failure) => {
        setErrorMessage(failure instanceof TutorApiError ? failure.message : '초대 링크를 확인하지 못했어요.');
        setStage('error');
      });
  }, [rawToken]);

  const onAccountSubmit = useCallback(async () => {
    setErrorMessage(null);
    setSubmitting(true);
    try {
      if (hasAccount) {
        const response = await login({ loginId: loginId.trim(), password });
        setLoggedInToken(response.token);
      }
      setStage('consent');
    } catch (failure) {
      setErrorMessage(failure instanceof AuthApiError ? failure.message : '로그인하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [hasAccount, loginId, password]);

  const onAccept = useCallback(async () => {
    if (!rawToken) return;
    setErrorMessage(null);
    setSubmitting(true);
    try {
      const token = state.status === 'authenticated' ? state.token : loggedInToken;
      const response = await acceptTutorInvite(rawToken, token
        ? { token }
        : { loginId: newLoginId.trim(), email: newEmail.trim(), password, displayName: displayName.trim() });
      setSession(response.token, response.user);
      navigate(homePathFor(response.user), { replace: true });
    } catch (failure) {
      setErrorMessage(failure instanceof TutorApiError ? failure.message : '연결을 완료하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }, [rawToken, state, loggedInToken, newLoginId, newEmail, password, displayName, setSession, navigate]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.content}>
        {stage === 'loading' && (
          <View style={styles.centerBox}>
            <ActivityIndicator color={storybookTheme.color.gold} />
          </View>
        )}

        {stage === 'error' && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {stage === 'preview' && preview && (
          <>
            <Text style={styles.eyebrow}>{preview.tutorDisplayName}이 보낸 안전한 초대 링크</Text>
            <Text style={styles.title} accessibilityRole="header">{preview.studentName}의 오늘 이야기 기록이{'\n'}도착했어요</Text>
            <View style={styles.previewCard}>
              <Text style={styles.previewName}>{preview.studentName} · {preview.ageBand}</Text>
              <Text style={styles.previewNote}>{preview.tutorDisplayName}이 전달한 정보예요.</Text>
            </View>
            <ActionButton
              variant="gold"
              label="내 아이 기록인지 확인하기"
              onPress={() => setStage(state.status === 'authenticated' ? 'consent' : 'account')}
            />
          </>
        )}

        {stage === 'account' && (
          <>
            <Text style={styles.title} accessibilityRole="header">{hasAccount ? '로그인하고 계속하기' : '계정을 만들고 계속하기'}</Text>
            <ActionButton
              variant="secondaryFull"
              label={hasAccount ? '계정이 없어요 · 새로 만들기' : '이미 계정이 있어요 · 로그인'}
              onPress={() => setHasAccount((value) => !value)}
            />
            {hasAccount ? (
              <>
                <TextField label="아이디" value={loginId} onChangeText={setLoginId} />
                <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry errorText={errorMessage ?? undefined} />
              </>
            ) : (
              <>
                <TextField label="아이디" value={newLoginId} onChangeText={setNewLoginId} />
                <TextField label="이메일" value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" />
                <TextField label="비밀번호" value={password} onChangeText={setPassword} secureTextEntry />
                <TextField label="이름" value={displayName} onChangeText={setDisplayName} errorText={errorMessage ?? undefined} />
              </>
            )}
            <ActionButton
              variant="gold"
              label={submitting ? '확인 중…' : '다음'}
              onPress={hasAccount ? onAccountSubmit : () => setStage('consent')}
              loading={submitting}
              disabled={
                hasAccount
                  ? !loginId.trim() || !password
                  : !newLoginId.trim() || !newEmail.trim() || !password || !displayName.trim()
              }
            />
          </>
        )}

        {stage === 'consent' && preview && (
          <>
            <Text style={styles.title} accessibilityRole="header">부모님이 확인할 내용</Text>
            <View style={styles.consentCard}>
              <Text style={styles.consentGroupLabel}>부모가 받음</Text>
              {SHARED_ITEMS.map((item) => (
                <Text key={item} style={styles.consentItemAllowed}>· {item}</Text>
              ))}
              <Text style={styles.consentGroupLabel}>공유 안 됨</Text>
              {HIDDEN_ITEMS.map((item) => (
                <Text key={item} style={styles.consentItemBlocked}>· {item}</Text>
              ))}
            </View>
            <Text style={styles.footnote}>연결해도 선생님은 가정 구독 정보나 다른 이야기 기록을 볼 수 없어요.</Text>
            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
            <ActionButton variant="gold" label={submitting ? '연결하는 중…' : '동의하고 연결 완료'} onPress={onAccept} loading={submitting} />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: storybookTheme.color.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
    paddingVertical: 40,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
  centerBox: { alignItems: 'center', paddingVertical: 40 },
  eyebrow: { color: storybookTheme.color.gold, fontSize: storybookTheme.type.xs, fontWeight: '600' },
  title: {
    color: storybookTheme.color.onDark,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: '700',
  },
  previewCard: {
    gap: 4,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderRadius: storybookTheme.radius.card,
    padding: 16,
  },
  previewName: { fontSize: storybookTheme.type.md, fontWeight: '700', color: storybookTheme.color.onCardTitle },
  previewNote: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  consentCard: {
    gap: 4,
    backgroundColor: storybookTheme.color.panelOnDarkBackground,
    borderWidth: 1,
    borderColor: storybookTheme.color.panelOnDarkBorder,
    borderRadius: storybookTheme.radius.card,
    padding: 16,
  },
  consentGroupLabel: { fontSize: storybookTheme.type.xxs, fontWeight: '700', color: storybookTheme.color.gold, marginTop: 8, letterSpacing: 0.4 },
  consentItemAllowed: { fontSize: storybookTheme.type.sm, lineHeight: 20, color: storybookTheme.color.onDark },
  consentItemBlocked: { fontSize: storybookTheme.type.sm, lineHeight: 20, color: storybookTheme.color.onDarkMuted },
  footnote: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onDarkMuted },
  errorText: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error, textAlign: 'center' },
});

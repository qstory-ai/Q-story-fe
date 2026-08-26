import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, TextField, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { FeedbackApiError, submitFeedback } from '@/entities/feedback';

/** 개선사항 요청 - 로그인한 사용자가 자유 텍스트로 남기는 앱 내 피드백 폼. */
export function MyPageFeedbackPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;
  const { user, token } = state;

  async function handleSubmit() {
    setError(null);
    setSubmitted(false);
    setSubmitting(true);
    try {
      await submitFeedback(token, { message });
      setMessage('');
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof FeedbackApiError ? err.message : '제출하지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <View style={styles.card}>
          <TextField
            label="어떤 점이 개선되면 좋을까요?"
            value={message}
            onChangeText={setMessage}
            placeholder="자유롭게 의견을 남겨 주세요"
            multiline
            numberOfLines={6}
            style={styles.multiline}
          />
          {submitted ? <StatusBanner label="소중한 의견 감사해요!" /> : null}
          {error ? <StatusBanner variant="warning" label={error} /> : null}
          <ActionButton label="제출" onPress={handleSubmit} loading={submitting} disabled={!message.trim()} />
        </View>
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 24,
    gap: 16,
    ...storybookTheme.elevation.high,
  },
  multiline: {
    minHeight: 140,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Modal, RadioGroup, StatusBanner, TextareaField, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, deleteAccount, useAuth } from '@/entities/auth';
import { messageForError } from '@/shared/api';

/** 백엔드 AuthService.DELETE_REASON_CATEGORIES와 문구를 맞춰야 한다. */
const REASON_CATEGORIES = [
  '이용료가 부담돼요',
  '아이가 흥미를 느끼지 못해요',
  '원하는 콘텐츠가 없어요',
  '다른 서비스를 이용해요',
  '기타',
];

/** 회원 탈퇴 + 설문 - 소프트 삭제라 데이터가 완전히 사라진다고 말하지 않고, 로그인이 즉시 막힌다고만 안내한다. */
export function MyPageDeleteAccountPage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const [reasonCategory, setReasonCategory] = useState<string | null>(null);
  const [reasonDetail, setReasonDetail] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;
  const { user, token } = state;

  async function handleConfirmDelete() {
    if (!reasonCategory) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount(token, { reasonCategory, reasonDetail: reasonDetail.trim() || undefined });
      setConfirming(false);
      logout();
      navigate('/', { replace: true });
    } catch (err) {
      setConfirming(false);
      setError(messageForError(err, '탈퇴 처리 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate('/mypage/account')}>
      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>정말 탈퇴하시겠어요?</Text>
          <Text style={styles.body}>탈퇴하면 이 아이디로는 더 이상 로그인할 수 없어요.</Text>

          <Text style={styles.sectionTitle}>탈퇴하는 이유를 알려주세요</Text>
          <RadioGroup
            accessibilityLabel="탈퇴하는 이유"
            options={REASON_CATEGORIES.map((reason) => ({ value: reason, label: reason }))}
            value={reasonCategory}
            onChange={setReasonCategory}
          />

          <TextareaField
            label="더 자세히 알려주시면 도움이 돼요 (선택)"
            value={reasonDetail}
            onChangeText={setReasonDetail}
            numberOfLines={4}
            style={styles.multiline}
          />

          {error ? <StatusBanner variant="warning" label={error} /> : null}

          <ActionButton
            label="탈퇴하기"
            variant="stop"
            onPress={() => setConfirming(true)}
            disabled={!reasonCategory}
          />
        </View>
      </View>

      <Modal
        visible={confirming}
        title="탈퇴를 진행할까요?"
        positiveAction={{ label: '네, 탈퇴할게요', onPress: handleConfirmDelete, loading: deleting }}
        negativeAction={{ label: '취소', onPress: () => setConfirming(false), disabled: deleting }}
        accessibilityLabel="회원 탈퇴 확인"
      />
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
  title: {
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: '700',
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '400',
    color: storybookTheme.color.onCardMuted,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '700',
    color: storybookTheme.color.onCardTitle,
  },
  multiline: {
    minHeight: 100,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
});

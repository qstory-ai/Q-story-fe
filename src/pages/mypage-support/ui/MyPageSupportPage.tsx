import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, Icon, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { FeedbackModal, type FeedbackKind } from '@/features/feedback-modal';

const SUPPORT_EMAIL = 'support@qstory.co.kr';

/**
 * IA "[4] 마이페이지 > 고객지원" 화면. IA에 열거된 두 액션(기능제안 / 오류제보)은 백엔드의
 * feedback API 하나로 통합돼 있어 여기선 FeedbackModal을 kind prop으로 두 진입점으로 나눠
 * 열어 준다 - 각 kind에 맞춰 모달 제목/힌트/prefix가 달라져 운영 인박스에서 종류를 즉시
 * 구분할 수 있다.
 */
export function MyPageSupportPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  async function openEmail(subject: string) {
    const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
    try {
      await Linking.openURL(href);
    } catch {
      if (typeof window !== 'undefined') window.alert?.(`문의 메일: ${SUPPORT_EMAIL}`);
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">고객지원</Text>

        <ActionCard
          title="기능제안"
          body="이런 기능이 있었으면 좋겠다는 아이디어를 남겨 주세요."
          label="아이디어 남기기"
          onPress={() => setFeedbackKind('suggestion')}
        />

        <ActionCard
          title="오류제보"
          body="이용 중 잘못 동작하는 점이 있다면 알려 주세요. 재현 상황을 함께 적어 주시면 더 빨리 확인할 수 있어요."
          label="오류 남기기"
          onPress={() => setFeedbackKind('bug')}
        />

        <ActionCard
          title="이메일로 문의"
          body={`빠른 답이 필요하면 ${SUPPORT_EMAIL}로 메일을 보내 주세요.`}
          label="메일 앱 열기"
          onPress={() => openEmail('[Q-Story] 문의')}
        />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>자주 묻는 질문</Text>
          <Text style={styles.body}>FAQ 페이지는 곧 준비돼요. 급한 문의는 위 이메일로 부탁드려요.</Text>
        </View>
      </View>

      {/* key로 kind를 걸어 종류가 바뀌면 모달 내부 state가 초기화되도록 remount 시킨다 -
          예전 kind에 남아 있던 입력이 새 kind로 새어 들어가지 않게. */}
      <FeedbackModal
        key={feedbackKind ?? 'closed'}
        visible={feedbackKind !== null}
        kind={feedbackKind ?? undefined}
        token={state.token}
        onClose={() => setFeedbackKind(null)}
      />
    </AppNavShell>
  );
}

function ActionCard({
  title,
  body,
  label,
  onPress,
}: {
  title: string;
  body: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.actionLink, pressed && styles.pressed]}
      >
        <Text style={styles.actionLabel}>{label}</Text>
        <Icon name="chevronRight" size={14} color={storybookTheme.color.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.sm,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.ms,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onDark,
  },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.xs,
  },
  sectionTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  actionLink: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.7 },
  actionLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
});

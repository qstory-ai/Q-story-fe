import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { AppNavShell, Icon, radius, semanticColors, shadow, storybookTheme, SUPPORT_EMAIL, openSupportMail, type IconName } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { FeedbackModal, type FeedbackKind } from '@/features/feedback-modal';

/**
 * IA "[4] 마이페이지 > 고객지원" 화면. IA에 열거된 두 액션(기능제안 / 오류제보)은 백엔드의
 * feedback API 하나로 통합돼 있어 여기선 FeedbackModal을 kind prop으로 두 진입점으로 나눠
 * 열어 준다 - 각 kind에 맞춰 모달 제목/힌트/prefix가 달라져 운영 인박스에서 종류를 즉시
 * 구분할 수 있다.
 */
export function MyPageSupportPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [feedbackKind, setFeedbackKind] = useState<FeedbackKind | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') navigate('/', { replace: true });
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell tone="warm" items={dashboardNavItems(state.user, navigate, pathname)} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">고객지원</Text>

        <ActionCard
          icon="sparkles"
          title="기능제안"
          body="이런 기능이 있었으면 좋겠다는 아이디어를 남겨 주세요."
          label="아이디어 남기기"
          onPress={() => setFeedbackKind('suggestion')}
        />

        <ActionCard
          icon="alert"
          title="오류제보"
          body="이용 중 잘못 동작하는 점이 있다면 알려 주세요. 재현 상황을 함께 적어 주시면 더 빨리 확인할 수 있어요."
          label="오류 남기기"
          onPress={() => setFeedbackKind('bug')}
        />

        <ActionCard
          icon="chat"
          title="이메일로 문의"
          body={`빠른 답이 필요하면 ${SUPPORT_EMAIL}로 메일을 보내 주세요.`}
          label="메일 앱 열기"
          onPress={() => openSupportMail('[Q-Story] 문의')}
        />

        <View style={styles.card}>
          <View style={styles.cardIcon}>
            <Icon name="book" size={16} color={storybookTheme.color.gold} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.sectionTitle}>자주 묻는 질문</Text>
            <Text style={styles.body}>FAQ 페이지는 곧 준비돼요. 급한 문의는 위 이메일로 부탁드려요.</Text>
          </View>
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
  icon,
  title,
  body,
  label,
  onPress,
}: {
  icon: IconName;
  title: string;
  body: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardIcon}>
        <Icon name={icon} size={16} color={storybookTheme.color.gold} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={({ pressed }) => [styles.actionLink, pressed && styles.pressed]}
        >
          <Text style={styles.actionLabel}>{label}</Text>
          <Icon name="chevronRight" size={14} color={storybookTheme.color.gold} />
        </Pressable>
      </View>
    </View>
  );
}

const L = semanticColors.light;

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    // 보호자 하위 화면(LibraryPage/ReportHistoryPage)과 같은 폭.
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: 16,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  // HomeListRow와 같은 흰 행(아이콘 + 제목·설명) - 설명이 길고 행 안에 버튼이 있어 HomeListRow 대신 직접 그린다.
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: L.bg.primary,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: L.border.secondary,
    ...shadow(1),
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.bg.brandSubtle,
  },
  cardText: { flex: 1, gap: 2 },
  sectionTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  body: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  actionLink: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.7 },
  actionLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.goldText,
  },
});

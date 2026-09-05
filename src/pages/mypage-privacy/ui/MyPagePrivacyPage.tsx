import { useEffect } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, Icon, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, useAuth } from '@/entities/auth';

type Section = {
  title: string;
  body: string;
  /** URL/이메일 처럼 클릭 시 실제 행동이 있는 경우. pendingLabel과 배타적. */
  action?: { label: string; onPress: () => void };
  /** 아직 준비되지 않은 액션(URL 미결정 등)의 자리를 지키는 라벨. 클릭 불가능한 pill로 렌더. */
  pendingLabel?: string;
};

/**
 * IA "[4] 마이페이지 > 개인정보 및 데이터" 화면. 실제 약관/정책 문서 URL은 서비스 오픈 시점에
 * 확정되므로 지금은 "곧 공개" pill로 자리를 지키고, 이미 동작하는 계정 삭제·데이터 요청 흐름
 * 으로의 링크는 실제 링크로 둔다. 문서 URL이 결정되면 아래 TERMS_URL/PRIVACY_URL을 채우고
 * makeSection이 자동으로 pendingLabel 대신 action을 붙여 준다.
 */

// TODO: 정식 URL이 확정되면 여기를 채우면 자동으로 클릭 가능한 링크로 바뀐다.
const TERMS_URL = '';
const PRIVACY_URL = '';
const SUPPORT_EMAIL = 'support@qstory.co.kr';

async function openDoc(url: string) {
  try {
    await Linking.openURL(url);
  } catch {
    if (typeof window !== 'undefined') window.alert?.('링크를 열지 못했어요.');
  }
}

/** URL이 있으면 클릭 가능한 action, 없으면 "곧 공개" pill로 자리 지키는 pendingLabel을 만든다. */
function docSection(title: string, body: string, url: string, label: string): Section {
  if (url) {
    return { title, body, action: { label, onPress: () => openDoc(url) } };
  }
  return { title, body, pendingLabel: '곧 공개' };
}

async function openMail(subject: string) {
  const href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  try {
    await Linking.openURL(href);
  } catch {
    if (typeof window !== 'undefined') window.alert?.(`문의 메일: ${SUPPORT_EMAIL}`);
  }
}

export function MyPagePrivacyPage() {
  const navigate = useNavigate();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'loading') return;
    if (
      state.status !== 'authenticated' ||
      (state.user.role !== 'PARENT' && state.user.role !== 'TUTOR')
    ) {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  const sections: Section[] = [
    docSection(
      '서비스 이용약관',
      '서비스를 이용하며 지켜야 할 약속과 회사의 책임 범위를 확인해요.',
      TERMS_URL,
      '약관 보기',
    ),
    docSection(
      '개인정보 처리방침',
      '수집되는 정보와 사용 목적, 보관 기간, 파기 절차를 안내해요.',
      PRIVACY_URL,
      '방침 보기',
    ),
    {
      title: '내 데이터 열람·내보내기',
      body: '프로필, 수업 또는 완주 리포트, 질문 기록 등 계정에 저장된 데이터의 사본을 요청할 수 있어요.',
      action: {
        label: '메일로 요청하기',
        onPress: () => openMail('[Q-Story] 데이터 열람·내보내기 요청'),
      },
    },
    {
      title: '데이터 삭제 (회원 탈퇴)',
      body: '계정을 지우면 아이 프로필과 이용 기록이 함께 정리돼요. 되돌릴 수 없어요.',
      action: { label: '회원 탈퇴 화면으로', onPress: () => navigate('/mypage/delete-account') },
    },
  ];

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">개인정보 및 데이터</Text>

        {sections.map((section) => (
          <View key={section.title} style={styles.card}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
            {section.action ? (
              <Pressable
                accessibilityRole="link"
                onPress={section.action.onPress}
                style={({ pressed }) => [styles.actionLink, pressed && styles.pressed]}
              >
                <Text style={styles.actionLabel}>{section.action.label}</Text>
                <Icon name="chevronRight" size={14} color={storybookTheme.color.primary} />
              </Pressable>
            ) : section.pendingLabel ? (
              <View style={styles.pendingPill}>
                <Text style={styles.pendingLabel}>{section.pendingLabel}</Text>
              </View>
            ) : null}
          </View>
        ))}
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
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.ms,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
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
  actionLink: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pressed: { opacity: 0.7 },
  actionLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.primary,
  },
  // "곧 공개" 상태 pill - 클릭 가능한 액션이 아니라는 신호를 시각적으로 확실히 준다.
  pendingPill: {
    alignSelf: 'flex-start',
    marginTop: storybookTheme.spacing.xs,
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: 4,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.pillBackground,
  },
  pendingLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardMuted,
  },
});

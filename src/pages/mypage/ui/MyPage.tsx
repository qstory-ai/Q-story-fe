import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, Icon, Modal, Pill, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, homePathFor, useAuth, type Role } from '@/entities/auth';
import { FeedbackModal } from '@/features/feedback-modal';

const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: '기관 및 단체',
  CLASS_ACCOUNT: '반 계정',
  PARENT: '학부모',
  TUTOR: '방문 선생님',
  STAFF: '콘텐츠 운영자',
};

/** "뒤로"/주요 액션 라벨 - 역할마다 실제 목적지 이름이 다르다(entities/auth의 homePathFor와 짝을 맞춘다). */
const HOME_LABEL: Record<Role, string> = {
  DIRECTOR: '반 관리로',
  CLASS_ACCOUNT: '우리 반으로',
  PARENT: '홈으로',
  TUTOR: '학생 관리로',
  STAFF: '저작 화면으로',
};

export function MyPage() {
  const navigate = useNavigate();
  const { state, logout } = useAuth();
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [openModal, setOpenModal] = useState<'feedback' | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') {
      navigate('/', { replace: true });
    }
  }, [state.status, navigate]);

  if (state.status !== 'authenticated') return null;

  const { user } = state;
  const homePath = homePathFor(user);
  const initial = user.displayName.trim().charAt(0) || '?';

  return (
    <AppNavShell
      items={dashboardNavItems(user, navigate, 'mypage')}
      onBack={() => navigate(homePath)}
    >
      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{user.displayName}</Text>
          <View style={styles.roleBadgeRow}>
            <Pill label={ROLE_LABEL[user.role]} />
          </View>

          <View style={styles.infoList}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>아이디</Text>
              <Text style={styles.infoValue}>{user.loginId}</Text>
            </View>
            {user.role === 'CLASS_ACCOUNT' && (
              <Pressable
                onPress={() => navigate('/class')}
                accessibilityRole="link"
                style={styles.infoRow}
              >
                <Text style={styles.infoLabel}>우리 반</Text>
                <Text style={styles.infoLink}>반 코드 보기 →</Text>
              </Pressable>
            )}
            {(user.role === 'PARENT' || user.role === 'CLASS_ACCOUNT') && (
              <Pressable
                onPress={() => navigate('/reports')}
                accessibilityRole="link"
                style={styles.infoRow}
              >
                <Text style={styles.infoLabel}>이야기 기록</Text>
                <Text style={styles.infoLink}>지난 리포트 보기 →</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.kind === 'route' ? item.path : item.modal}
              onPress={() => (item.kind === 'route' ? navigate(item.path) : setOpenModal(item.modal))}
              accessibilityRole={item.kind === 'route' ? 'link' : 'button'}
              style={styles.menuRow}
            >
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Text style={styles.menuChevron}>→</Text>
            </Pressable>
          ))}
        </View>

        <ActionButton label={`${HOME_LABEL[user.role]} 돌아가기`} onPress={() => navigate(homePath)} />
        <Pressable
          onPress={() => setConfirmingLogout(true)}
          accessibilityRole="button"
          style={styles.logoutButton}
        >
          <Icon name="logout" size={16} color={storybookTheme.color.onDarkMuted} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
        <Pressable
          onPress={() => navigate('/mypage/delete-account')}
          accessibilityRole="link"
          hitSlop={8}
          style={styles.deleteAccountLink}
        >
          <Text style={styles.deleteAccountText}>회원 탈퇴</Text>
        </Pressable>
      </View>

      <Modal
        visible={confirmingLogout}
        title="로그아웃할까요?"
        positiveAction={{ label: '로그아웃', onPress: logout }}
        negativeAction={{ label: '취소', onPress: () => setConfirmingLogout(false) }}
        accessibilityLabel="로그아웃 확인"
      />
      <FeedbackModal visible={openModal === 'feedback'} token={state.token} onClose={() => setOpenModal(null)} />
    </AppNavShell>
  );
}

/**
 * 마이페이지 하위 화면 메뉴 - 내 정보/계정 관리/구독 관리는 화면을 완전히 전환하는 전체 화면
 * (pages/mypage-*)으로 열고, 개선사항 요청만 이 화면 위에 오버레이되는 모달로 연다.
 */
const MENU_ITEMS: (
  | { kind: 'route'; label: string; path: string }
  | { kind: 'modal'; label: string; modal: 'feedback' }
)[] = [
  { kind: 'route', label: '내 정보 관리', path: '/mypage/profile' },
  { kind: 'route', label: '계정 관리', path: '/mypage/account' },
  { kind: 'route', label: '구독 관리', path: '/mypage/subscription' },
  { kind: 'modal', label: '개선사항 요청', modal: 'feedback' },
];

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
    alignItems: 'center',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 28,
    gap: 10,
    ...storybookTheme.elevation.high,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: storybookTheme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarText: {
    fontSize: storybookTheme.type.xl,
    fontWeight: '600',
    color: storybookTheme.color.gold,
  },
  roleBadgeRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  name: {
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: '600',
    color: storybookTheme.color.onCardTitle,
  },
  infoList: {
    width: '100%',
    marginTop: 12,
    gap: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  infoLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '400',
    color: storybookTheme.color.onCardMuted,
  },
  infoValue: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: storybookTheme.color.onCardBody,
  },
  infoLink: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: storybookTheme.color.primary,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
  },
  logoutText: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: storybookTheme.color.onDarkMuted,
  },
  menuCard: {
    width: '100%',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    paddingHorizontal: 20,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  menuLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '600',
    color: storybookTheme.color.onCardTitle,
  },
  menuChevron: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: storybookTheme.color.onCardMuted,
  },
  deleteAccountLink: {
    alignSelf: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  deleteAccountText: {
    fontSize: storybookTheme.type.xs,
    fontWeight: '500',
    color: storybookTheme.color.onDarkMuted,
    textDecorationLine: 'underline',
  },
});

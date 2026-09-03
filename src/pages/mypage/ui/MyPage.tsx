import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { AppNavShell, Icon, Modal, Pill, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, homePathFor, useAuth, type Role, type UserSummary } from '@/entities/auth';
import { useChildren } from '@/entities/child';
import { FeedbackModal } from '@/features/feedback-modal';

const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: '기관 및 단체',
  CLASS_ACCOUNT: '반 계정',
  PARENT: '학부모',
  TUTOR: '방문 선생님',
  STAFF: '콘텐츠 운영자',
};

/**
 * IA의 [4] 마이페이지를 부모 기준으로 그룹화한 허브 화면. 예전에는 "내 정보/계정/구독" 3개
 * 링크만 있는 평평한 리스트였는데, IA가 요구한 항목(아이 관리/수업 연결/알림 설정/개인정보 및
 * 데이터/고객지원/계정 관리)을 다 담기엔 그 구조로는 부족했다. 그래서 부모용은 4개 그룹으로,
 * 그 외 역할(원장/방문 선생님/반 계정/스태프)은 기존과 유사한 간단한 리스트로 나뉜다.
 *
 * 각 하위 페이지는 별도 라우트로 열리므로(pages/mypage-*), 이 화면 자체는 프로필 카드 + 링크
 * 리스트 + 로그아웃/회원탈퇴 액션까지만 담는다. 개선사항 요청/피드백만 오버레이 모달로 열린다.
 */
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

  return (
    <AppNavShell items={dashboardNavItems(user, navigate, 'mypage')} onBack={() => navigate(homePath)}>
      <View style={styles.content}>
        <ProfileCard user={user} />

        {user.role === 'PARENT' ? (
          <ParentMenu navigate={navigate} onOpenFeedback={() => setOpenModal('feedback')} />
        ) : (
          <GenericMenu user={user} navigate={navigate} onOpenFeedback={() => setOpenModal('feedback')} />
        )}

        <MenuGroup>
          <MenuRow
            label="로그아웃"
            leadingIcon="logout"
            onPress={() => setConfirmingLogout(true)}
            accessibilityRole="button"
          />
          <MenuRow
            label="회원 탈퇴"
            variant="danger"
            onPress={() => navigate('/mypage/delete-account')}
          />
        </MenuGroup>
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

/* -------------------------------------------------------------- profile */

function ProfileCard({ user }: { user: UserSummary }) {
  const { children } = useChildren();
  const initial = user.displayName.trim().charAt(0) || '?';
  const childrenSummary = user.role === 'PARENT'
    ? children.length === 0
      ? '등록된 아이가 없어요'
      : `등록된 아이 ${children.length}명`
    : null;
  return (
    <View style={styles.profileCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initial}</Text>
      </View>
      <Text style={styles.name}>{user.displayName}</Text>
      <View style={styles.roleBadgeRow}>
        <Pill label={ROLE_LABEL[user.role]} />
      </View>
      {childrenSummary ? <Text style={styles.profileMeta}>{childrenSummary}</Text> : null}
    </View>
  );
}

/* -------------------------------------------------------------- menus */

function ParentMenu({
  navigate,
  onOpenFeedback,
}: {
  navigate: (path: string) => void;
  onOpenFeedback: () => void;
}) {
  return (
    <View style={styles.menuGroups}>
      <MenuGroup title="아이">
        <MenuRow label="아이 관리" hint="아이 프로필 추가·수정·삭제" onPress={() => navigate('/mypage/children')} />
      </MenuGroup>

      <MenuGroup title="수업">
        <MenuRow label="수업 연결" hint="선생님·기관 연결과 관리" onPress={() => navigate('/mypage/classes')} />
      </MenuGroup>

      <MenuGroup title="앱 설정">
        <MenuRow label="알림 설정" onPress={() => navigate('/mypage/notifications')} />
        <MenuRow label="개인정보 및 데이터" onPress={() => navigate('/mypage/privacy')} />
        <MenuRow label="고객지원" onPress={() => navigate('/mypage/support')} />
      </MenuGroup>

      <MenuGroup title="계정">
        <MenuRow label="보호자 정보 변경" onPress={() => navigate('/mypage/profile')} />
        <MenuRow label="이용권/결제" onPress={() => navigate('/mypage/subscription')} />
        <MenuRow label="계정 관리 (아이디·비밀번호)" onPress={() => navigate('/mypage/account')} />
        <MenuRow label="개선사항 요청" onPress={onOpenFeedback} accessibilityRole="button" />
      </MenuGroup>
    </View>
  );
}

function GenericMenu({
  user,
  navigate,
  onOpenFeedback,
}: {
  user: UserSummary;
  navigate: (path: string) => void;
  onOpenFeedback: () => void;
}) {
  return (
    <View style={styles.menuGroups}>
      {user.role === 'TUTOR' ? (
        <MenuGroup title="소속">
          <MenuRow
            label="기관 참여"
            hint="초대 코드나 링크로 기관 소속을 완성해요"
            onPress={() => navigate('/tutor/join-organization')}
          />
        </MenuGroup>
      ) : null}
      <MenuGroup title="계정">
        <MenuRow label="내 정보 관리" onPress={() => navigate('/mypage/profile')} />
        <MenuRow label="계정 관리" onPress={() => navigate('/mypage/account')} />
        <MenuRow label="구독 관리" onPress={() => navigate('/mypage/subscription')} />
        <MenuRow label="개선사항 요청" onPress={onOpenFeedback} accessibilityRole="button" />
      </MenuGroup>
    </View>
  );
}

/* -------------------------------------------------------------- menu primitives */

function MenuGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.menuGroup}>
      {title ? <Text style={styles.menuGroupTitle}>{title}</Text> : null}
      <View style={styles.menuCard}>{children}</View>
    </View>
  );
}

function MenuRow({
  label,
  hint,
  leadingIcon,
  variant = 'default',
  onPress,
  accessibilityRole = 'link',
}: {
  label: string;
  hint?: string;
  leadingIcon?: 'logout';
  variant?: 'default' | 'danger';
  onPress: () => void;
  accessibilityRole?: 'link' | 'button';
}) {
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
    >
      <View style={styles.menuLead}>
        {leadingIcon ? (
          <Icon name={leadingIcon} size={16} color={storybookTheme.color.onCardMuted} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.menuLabel, variant === 'danger' && styles.menuLabelDanger]} numberOfLines={1}>
            {label}
          </Text>
          {hint ? <Text style={styles.menuHint} numberOfLines={1}>{hint}</Text> : null}
        </View>
      </View>
      <Icon name="chevronRight" size={16} color={storybookTheme.color.onCardMuted} />
    </Pressable>
  );
}

/* -------------------------------------------------------------- styles */

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.sm,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.ml,
  },
  profileCard: {
    alignItems: 'center',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    // spacing.lg(24)와 xl(32) 중간 - 프로필 카드는 앱 내 최상단 카드라서 살짝 여유있게.
    padding: 28,
    gap: storybookTheme.spacing.sm,
    ...storybookTheme.elevation.high,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: storybookTheme.spacing.xs,
  },
  avatarText: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.gold,
  },
  roleBadgeRow: { flexDirection: 'row', justifyContent: 'center' },
  name: {
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  profileMeta: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardMuted,
    marginTop: storybookTheme.spacing.xs,
  },
  menuGroups: { gap: storybookTheme.spacing.md },
  menuGroup: { gap: storybookTheme.spacing.xs },
  menuGroupTitle: {
    paddingHorizontal: storybookTheme.spacing.xs,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onDarkMuted,
    letterSpacing: 0.4,
  },
  menuCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    paddingHorizontal: storybookTheme.spacing.ml,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 56,
    gap: storybookTheme.spacing.ms,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  pressed: { opacity: 0.7 },
  menuLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.sm },
  menuLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  menuLabelDanger: { color: storybookTheme.color.error },
  menuHint: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
    marginTop: 2,  // 라벨 바로 아래 hint - xs(4)보다 좁은 시각적 결합.
  },
});

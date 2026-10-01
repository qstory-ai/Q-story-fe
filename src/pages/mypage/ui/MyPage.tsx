import { Children, Fragment, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { AppNavShell, Icon, Modal, ModalBody, Pill, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, homePathFor, roleLabel, subscriptionPathFor, useAuth, type UserSummary } from '@/entities/auth';
import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from '@/shared/config';
import { useChildren } from '@/entities/child';

/**
 * IA [4] 마이페이지 허브. 부모는 4개 그룹 메뉴, 그 외 역할(원장/선생님/스태프)은 간단한 리스트를 본다.
 * 하위 화면은 별도 라우트(pages/mypage-*)다.
 */
export function MyPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state, logout } = useAuth();
  const [confirmingLogout, setConfirmingLogout] = useState(false);

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
    <AppNavShell items={dashboardNavItems(user, navigate, pathname)} onBack={() => navigate(homePath)}>
      <View style={styles.content}>
        <ProfileCard user={user} />

        {user.role === 'PARENT' ? (
          <ParentMenu user={user} navigate={navigate} />
        ) : (
          <GenericMenu user={user} navigate={navigate} />
        )}

        <MenuGroup>
          <MenuRow
            label="로그아웃"
            leadingIcon="logout"
            onPress={() => setConfirmingLogout(true)}
            accessibilityRole="button"
          />
        </MenuGroup>
        <Pressable
          accessibilityRole="link"
          onPress={() => navigate('/mypage/delete-account')}
          style={({ pressed }) => [styles.withdrawLink, pressed && styles.pressed]}
        >
          <Text style={styles.withdrawText}>회원 탈퇴</Text>
        </Pressable>
      </View>

      <Modal
        visible={confirmingLogout}
        title="로그아웃할까요?"
        positiveAction={{ label: '로그아웃', onPress: logout }}
        negativeAction={{ label: '취소', onPress: () => setConfirmingLogout(false) }}
        accessibilityLabel="로그아웃 확인"
      >
        <ModalBody>다시 로그인하면 그대로 이어서 쓸 수 있어요.</ModalBody>
      </Modal>
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
      {/* profileImageUrl(현재는 TUTOR만 업로드 가능)이 있으면 사진, 없으면 이니셜. */}
      <View style={styles.avatar}>
        {user.profileImageUrl ? (
          <Image
            source={{ uri: user.profileImageUrl }}
            style={styles.avatarImage}
            accessibilityLabel={`${user.displayName} 프로필 이미지`}
          />
        ) : (
          <Text style={styles.avatarText}>{initial}</Text>
        )}
      </View>
      <View style={styles.profileText}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{user.displayName}</Text>
          <Pill label={roleLabel(user.role)} />
        </View>
        {childrenSummary ? <Text style={styles.profileMeta}>{childrenSummary}</Text> : null}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------- menus */

function ParentMenu({ user, navigate }: { user: UserSummary; navigate: (path: string) => void }) {
  const expiry = user.subscriptionExpiresAt ? ` · ${formatShortDate(user.subscriptionExpiresAt)} 만료` : '';
  return (
    <View style={styles.menuGroups}>
      <MenuGroup title="아이와 수업">
        <MenuRow label="아이 관리" hint="아이 프로필 추가·수정·삭제" onPress={() => navigate('/mypage/children')} />
        <MenuRow label="수업 연결" hint="반 코드로 반에 연결해요" onPress={() => navigate('/mypage/classes')} />
      </MenuGroup>

      <MenuGroup title="계정">
        <MenuRow label="내 정보 관리" onPress={() => navigate('/mypage/profile')} />
        <MenuRow label="계정 관리" hint="아이디 확인·비밀번호 변경" onPress={() => navigate('/mypage/account')} />
        <MenuRow
          label="이용권"
          hint={`${subscriptionStatusLabel(user.subscriptionStatus)}${expiry}`}
          onPress={() => navigate('/mypage/subscription')}
        />
      </MenuGroup>

      <MenuGroup title="설정과 도움">
        <MenuRow label="알림 설정" onPress={() => navigate('/mypage/notifications')} />
        <MenuRow label="개인정보 및 데이터" onPress={() => navigate('/mypage/privacy')} />
        <MenuRow label="고객지원" onPress={() => navigate('/mypage/support')} />
      </MenuGroup>
    </View>
  );
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(value));
}

function GenericMenu({ user, navigate }: { user: UserSummary; navigate: (path: string) => void }) {
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
        <MenuRow label="계정 관리" hint="아이디 확인·비밀번호 변경" onPress={() => navigate('/mypage/account')} />
        <MenuRow
          label="이용권"
          hint={user.role === 'PARENT' ? undefined : user.grantsAccess ? BETA_OPEN_ACCESS_NOTICE : '이용권은 관리자에게 문의해 주세요.'}
          onPress={() => navigate(subscriptionPathFor(user))}
        />
      </MenuGroup>
      <MenuGroup title="설정과 도움">
        <MenuRow label="알림 설정" onPress={() => navigate('/mypage/notifications')} />
        <MenuRow label="개인정보 및 데이터" onPress={() => navigate('/mypage/privacy')} />
        <MenuRow label="고객지원" onPress={() => navigate('/mypage/support')} />
      </MenuGroup>
    </View>
  );
}

/* -------------------------------------------------------------- menu primitives */

function MenuGroup({ title, children }: { title?: string; children: ReactNode }) {
  // 구분선은 행 사이에만 넣는다 - 행마다 위쪽 테두리를 그리면 첫 행 위에도 선이 생겨 카드 테두리와 겹친다.
  const rows = Children.toArray(children);
  return (
    <View style={styles.menuGroup}>
      {title ? <Text style={styles.menuGroupTitle}>{title}</Text> : null}
      <View style={styles.menuCard}>
        {rows.map((row, index) => (
          <Fragment key={index}>
            {index > 0 ? <View style={styles.menuDivider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
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
          {hint ? <Text style={styles.menuHint} numberOfLines={2}>{hint}</Text> : null}
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
    // 같은 사이드바 레이아웃의 홈 화면들과 폭을 맞춘다(contentMaxWidth는 로그인/가입 폼 전용 폭).
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.ml,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    // spacing.lg(24)와 xl(32) 중간 - 프로필 카드는 앱 내 최상단 카드라서 살짝 여유있게.
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.ml,
    ...storybookTheme.elevation.high,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.goldText,
  },
  profileText: { flex: 1, gap: storybookTheme.spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.sm },
  name: {
    flexShrink: 1,
    fontSize: storybookTheme.type.lg,
    lineHeight: storybookTheme.type.lg * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.lg * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  profileMeta: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardMuted,
  },
  menuGroups: { gap: storybookTheme.spacing.md },
  menuGroup: { gap: storybookTheme.spacing.xs },
  menuGroupTitle: {
    paddingHorizontal: storybookTheme.spacing.xs,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContentMuted,
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
  },
  menuDivider: {
    height: 1,
    backgroundColor: storybookTheme.color.pillBorder,
  },
  pressed: { opacity: 0.7 },
  menuLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.sm },
  menuLabel: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onCardTitle,
  },
  menuLabelDanger: { color: storybookTheme.color.error },
  withdrawLink: { alignSelf: 'center', minHeight: 44, paddingHorizontal: storybookTheme.spacing.ml, justifyContent: 'center' },
  withdrawText: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.error, textDecorationLine: 'underline' },
  menuHint: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
    marginTop: 2,  // 라벨 바로 아래 hint - xs(4)보다 좁은 시각적 결합.
  },
});

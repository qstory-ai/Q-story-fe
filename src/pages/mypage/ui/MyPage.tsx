import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { AppNavShell, Card, enterFadeUp, Icon, Modal, ModalBody, Pill, radius, semanticColors, shadow, space, storybookTheme } from '@/shared/ui';
import { dashboardNavItems, homePathFor, roleLabel, subscriptionPathFor, useAuth, type UserSummary } from '@/entities/auth';
import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from '@/shared/config';
import { useChildren } from '@/entities/child';
import { HomeListRow, HomeSection } from '@/features/home-section';

/**
 * IA [4] 마이페이지 허브. 보호자는 그룹 메뉴, 그 외 역할(원장/선생님/스태프)은 간단한 리스트를 본다.
 * 생김새는 보호자 홈(/parent)과 같다 - 옅은 보라 프로필 카드 + HomeSection 목록(HomeListRow).
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
    <AppNavShell tone="warm" items={dashboardNavItems(user, navigate, pathname)} onBack={() => navigate(homePath)}>
      <View style={styles.content}>
        <ProfileCard user={user} />

        {user.role === 'PARENT' ? (
          <ParentMenu user={user} navigate={navigate} />
        ) : (
          <GenericMenu user={user} navigate={navigate} />
        )}

        {/* 로그아웃은 이동이 아니라 확인 모달을 여는 버튼이라 HomeListRow(link) 대신 같은 모양의 흰 행을 직접 그린다. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setConfirmingLogout(true)}
          style={({ pressed }) => [styles.logoutRow, pressed && styles.pressed]}
        >
          <View style={styles.rowIcon}>
            <Icon name="logout" size={16} color={storybookTheme.color.gold} />
          </View>
          <Text style={styles.logoutLabel} numberOfLines={1}>로그아웃</Text>
          <Icon name="chevronRight" size={16} color={storybookTheme.color.onContentMuted} />
        </Pressable>
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
        <ModalBody>다시 로그인하면 계정 정보와 리포트는 그대로예요. 이 기기에서 읽던 위치는 지워져요.</ModalBody>
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
    <Card variant="tinted" padding="lg" style={styles.profileCard}>
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
    </Card>
  );
}

/* -------------------------------------------------------------- menus */

function ParentMenu({ user, navigate }: { user: UserSummary; navigate: (path: string) => void }) {
  const expiry = user.subscriptionExpiresAt ? ` · ${formatShortDate(user.subscriptionExpiresAt)} 만료` : '';
  return (
    <View style={styles.menuGroups}>
      <HomeSection title="아이와 수업" layout="list">
        <HomeListRow icon="users" label="아이 관리" meta="아이 프로필 추가·수정·삭제" onPress={() => navigate('/mypage/children')} />
        <HomeListRow icon="graduationCap" label="수업 연결" meta="반 코드로 반에 연결해요" onPress={() => navigate('/mypage/classes')} />
      </HomeSection>

      <HomeSection title="계정" layout="list">
        <HomeListRow icon="user" label="내 정보·계정" meta="이름·아이디 확인·비밀번호 변경" onPress={() => navigate('/mypage/account')} />
        <HomeListRow
          icon="calendarDays"
          label="이용권"
          meta={`${subscriptionStatusLabel(user.subscriptionStatus)}${expiry}`}
          onPress={() => navigate('/mypage/subscription')}
        />
      </HomeSection>

      <HomeSection title="설정과 도움" layout="list">
        <HomeListRow icon="bell" label="설정" meta="알림·개인정보와 데이터" onPress={() => navigate('/mypage/settings')} />
        <HomeListRow icon="chat" label="고객지원" onPress={() => navigate('/mypage/support')} />
      </HomeSection>
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
        <HomeSection title="소속" layout="list">
          <HomeListRow
            icon="home"
            label="기관 참여"
            meta="유치원·어린이집 소속 신청 또는 초대 코드로 참여해요"
            onPress={() => navigate('/tutor/join-organization')}
          />
        </HomeSection>
      ) : null}
      <HomeSection title="계정" layout="list">
        <HomeListRow icon="user" label="내 정보·계정" meta="이름·아이디 확인·비밀번호 변경" onPress={() => navigate('/mypage/account')} />
        <HomeListRow
          icon="calendarDays"
          label="이용권"
          meta={user.grantsAccess ? BETA_OPEN_ACCESS_NOTICE : '이용권은 관리자에게 문의해 주세요.'}
          onPress={() => navigate(subscriptionPathFor(user))}
        />
      </HomeSection>
      <HomeSection title="설정과 도움" layout="list">
        <HomeListRow icon="bell" label="설정" meta="알림·개인정보와 데이터" onPress={() => navigate('/mypage/settings')} />
        <HomeListRow icon="chat" label="고객지원" onPress={() => navigate('/mypage/support')} />
      </HomeSection>
    </View>
  );
}

/* -------------------------------------------------------------- styles */

const L = semanticColors.light;

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
    gap: 20,
  },
  // 마이페이지 맨 위 프로필 - 보호자 홈 인사 카드와 같은 옅은 보라 카드(radius 24) + 은은한 등장.
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius[24],
    padding: space[24],
    gap: space[20],
    ...enterFadeUp,
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
    // 보라 원(Purple 500) 위 흰 글자 5.46:1 - 예전 Purple 800 글자는 1.27:1로 거의 안 보였다.
    color: L.text.interactive.inverse,
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
  menuGroups: { gap: 20 },
  // HomeListRow와 같은 흰 행(로그아웃 버튼용).
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: L.bg.primary,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: L.border.secondary,
    ...shadow(1),
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: L.bg.brandSubtle,
  },
  logoutLabel: {
    flex: 1,
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  pressed: { opacity: 0.85 },
  withdrawLink: { alignSelf: 'center', minHeight: 44, paddingHorizontal: storybookTheme.spacing.ml, justifyContent: 'center' },
  withdrawText: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.error, textDecorationLine: 'underline' },
});

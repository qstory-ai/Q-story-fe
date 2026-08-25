import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, Icon, Modal, Pill, SafeAreaView, storybookTheme } from '@/shared/ui';
import { useAuth, type Role } from '@/entities/auth';

const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: '기관 및 단체',
  CLASS_ACCOUNT: '반 계정',
  PARENT: '학부모',
  STAFF: '콘텐츠 운영자',
};

/** "뒤로"와 주요 액션이 모두 돌아가는 곳 - CLASS_ACCOUNT/PARENT는 /home에 실제 서재가 있음; STAFF는 자체 대시보드가 있음; DIRECTOR는 아직 대시보드가 없어서 랜딩 페이지로 대체됨. */
function homePathFor(role: Role): string {
  if (role === 'DIRECTOR') return '/';
  if (role === 'STAFF') return '/staff';
  return '/home';
}

/** 의도적으로 읽기 전용임 - 아직 프로필 업데이트 엔드포인트가 없어서, 필드가 수정 가능한 것처럼 꾸미는 대신 ClassDashboardPage/ParentHomePage와 같은 방식으로 계정을 보여준다. */
export function MyPage() {
  const navigate = useNavigate();
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
  const homePath = homePathFor(user.role);
  const initial = user.displayName.trim().charAt(0) || '?';
  const homeLinkLabel =
    user.role === 'DIRECTOR' ? '← 처음으로' : user.role === 'STAFF' ? '← 저작 화면으로' : '← 서재로';

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Pressable
        onPress={() => navigate(homePath)}
        accessibilityRole="link"
        hitSlop={8}
        style={styles.backLink}
      >
        <Text style={styles.backLinkText}>{homeLinkLabel}</Text>
      </Pressable>

      <View style={styles.content}>
        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{user.displayName}</Text>
          <Pill label={ROLE_LABEL[user.role]} />

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

        <ActionButton
          label={
            user.role === 'DIRECTOR'
              ? '처음 화면으로'
              : user.role === 'STAFF'
                ? '저작 화면으로 돌아가기'
                : '이야기 서재로 돌아가기'
          }
          onPress={() => navigate(homePath)}
        />
        <Pressable
          onPress={() => setConfirmingLogout(true)}
          accessibilityRole="button"
          style={styles.logoutButton}
        >
          <Icon name="logout" size={16} color={storybookTheme.color.onDarkMuted} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </Pressable>
      </View>

      <Modal
        visible={confirmingLogout}
        title="로그아웃할까요?"
        positiveAction={{ label: '로그아웃', onPress: logout }}
        negativeAction={{ label: '취소', onPress: () => setConfirmingLogout(false) }}
        accessibilityLabel="로그아웃 확인"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.background,
  },
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backLinkText: {
    color: storybookTheme.color.onDarkMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
  },
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
  name: {
    fontSize: storybookTheme.type.lg,
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
});

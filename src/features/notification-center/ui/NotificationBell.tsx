import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { Icon, Modal, storybookTheme, type IconName } from '@/shared/ui';
import {
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type Notification,
} from '@/entities/notification';

/**
 * BE의 notification.kind별 시각 표현 - 아이콘과 액센트 톤. BE가 알림을 발행할 때 정하는
 * kind 문자열(예: 'tutor-report')과 여기 키가 정확히 매칭돼야 한다. 새 kind가 추가되면
 * 이 표에 항목을 넣고, 없으면 default가 사용된다.
 *
 * tone은 배지 배경(투명도 낮은)과 아이콘 색을 함께 결정하는 시맨틱 라벨이라, 색 자체가 아니라
 * '이 알림이 어떤 성격인지'를 코드에 남긴다 - gold=콘텐츠 도착, positive=관계 성사, brand=신규 참여.
 */
type Presentation = { icon: IconName; tone: 'gold' | 'positive' | 'brand' };

const KIND_PRESENTATION: Record<string, Presentation> = {
  // 튜터 세션 완주 → 부모: 리포트 도착
  'tutor-report': { icon: 'report', tone: 'gold' },
  // 부모가 튜터 초대 수락 → 튜터: 새 연결 성사
  'tutor-invite-accepted': { icon: 'users', tone: 'positive' },
  // 튜터가 기관 초대 수락 → 원장: 새 소속 선생님
  'org-tutor-invite-accepted': { icon: 'graduationCap', tone: 'positive' },
  // 부모가 반 가입 → 원장: 새 반원
  'class-parent-joined': { icon: 'users', tone: 'brand' },
};

const DEFAULT_PRESENTATION: Presentation = { icon: 'bell', tone: 'gold' };

function presentationFor(kind: string): Presentation {
  return KIND_PRESENTATION[kind] ?? DEFAULT_PRESENTATION;
}

function toneColors(tone: Presentation['tone']): { background: string; icon: string } {
  switch (tone) {
    case 'positive':
      return {
        background: storybookTheme.semantic.positive.background,
        icon: storybookTheme.semantic.positive.text,
      };
    case 'brand':
      return {
        background: storybookTheme.semantic.brand.secondary,
        icon: storybookTheme.color.primary,
      };
    case 'gold':
    default:
      // gold-알파 배경 - accent 계열은 아직 tinted 배경 토큰이 따로 없어 계산값을 그대로 유지.
      return {
        background: 'rgba(246, 198, 77, 0.16)',
        icon: storybookTheme.color.gold,
      };
  }
}

type Props = {
  token: string;
  /** 다크 배경 위에 놓이는 벨 스타일(홈 상단바). 다른 곳에 쓸 일이 생기면 여기서 tone 옵션을 확장. */
  onDark?: boolean;
};

/**
 * 홈 상단바의 알림 벨. 클릭하면 최신 30개를 조회해 모달 드로어로 표시한다.
 *
 * 정책:
 *  - 마운트 즉시 목록을 fetch해 unread 뱃지를 미리 계산한다(뱃지가 열기 전에도 보여야 정보가치가 있다).
 *  - 열기(open) 순간에 다시 fetch해 최신화(첫 로드 이후 새 알림이 왔을 수 있음).
 *  - 항목 클릭 → mark-read 호출 + href가 있으면 이동(모달 닫음). href가 없으면 읽음만 표시.
 *  - "모두 읽음"은 부가 액션으로 lawyer 링크에 둔다 - 대량 unread 상황에서 한 번에 처리.
 *
 * 인증되지 않은 사용자에게는 호출되지 않는다(호출부가 token 존재 여부를 판단).
 */
export function NotificationBell({ token, onDark = true }: Props) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  // loading의 initial=true - 첫 fetch가 끝나기 전까지 드로어를 열면 "불러오는 중" 상태를 본다.
  // setLoading(true)를 사용자 액션(refresh) 외에서 부르지 않아야 setState-in-effect를 피할 수 있다.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 사용자 액션으로만 불리는 재조회 함수 - 초기 fetch는 아래 effect가 별도로 담당한다.
  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    listNotifications(token)
      .then((response) => {
        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
      })
      .catch(() => setError('알림을 불러오지 못했어요.'))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    // 초기 fetch는 effect 안에서 setState를 동기 호출하지 않도록 async 콜백에서만 상태 갱신.
    let cancelled = false;
    listNotifications(token)
      .then((response) => {
        if (cancelled) return;
        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError('알림을 불러오지 못했어요.');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const openDrawer = useCallback(() => {
    setOpen(true);
    refresh();
  }, [refresh]);

  const handleItemPress = useCallback(
    async (n: Notification) => {
      // 낙관적 업데이트: 즉시 read 처리해 뱃지가 반응하게, 실패는 조용히(다음 refresh에서 원복됨).
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: x.readAt ?? new Date().toISOString() } : x)));
      if (n.readAt === null) setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await markNotificationRead(token, n.id);
      } catch {
        // ignore - 다음 열림에서 refresh로 실 상태 확인
      }
      if (n.href) {
        setOpen(false);
        navigate(n.href);
      }
    },
    [token, navigate],
  );

  const handleMarkAll = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(token);
    } catch {
      // 실패해도 UX상 낙관적 상태 유지 - 다음 열림에서 refresh가 실 상태 반영.
    }
  }, [token]);

  const handleDelete = useCallback(
    async (n: Notification) => {
      // 낙관적 제거 - 목록에서 즉시 빼고 unread였다면 뱃지 카운트도 감소.
      setNotifications((prev) => prev.filter((x) => x.id !== n.id));
      if (n.readAt === null) setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await deleteNotification(token, n.id);
      } catch {
        // 실패 시엔 다음 refresh에서 원복 - 알림은 ephemeral이라 짧게 다시 나타나도 큰 문제 아님.
      }
    },
    [token],
  );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unreadCount > 0 ? `알림 (${unreadCount}개 읽지 않음)` : '알림'}
        onPress={openDrawer}
        style={({ pressed }) => [
          styles.bellButton,
          onDark ? styles.bellButtonDark : styles.bellButtonLight,
          pressed && styles.pressed,
        ]}
      >
        <Icon name="bell" size={18} color={onDark ? storybookTheme.color.onContent : storybookTheme.color.primary} />
        {unreadCount > 0 ? <View style={styles.badge} /> : null}
      </Pressable>

      <Modal
        visible={open}
        accessibilityLabel="알림"
        title="알림"
        eyebrow={unreadCount > 0 ? `${unreadCount}개 새 소식` : undefined}
        positiveAction={{ label: '닫기', onPress: () => setOpen(false) }}
        linkAction={unreadCount > 0 ? { label: '모두 읽음', onPress: handleMarkAll } : undefined}
      >
        {loading && notifications.length === 0 ? (
          <Text style={styles.status}>불러오는 중이에요…</Text>
        ) : error ? (
          <Text style={styles.status}>{error}</Text>
        ) : notifications.length === 0 ? (
          <Text style={styles.status}>아직 알림이 없어요.</Text>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {notifications.map((n) => {
              const { icon, tone } = presentationFor(n.kind);
              const colors = toneColors(tone);
              return (
                <View
                  key={n.id}
                  style={[styles.row, n.readAt === null && styles.rowUnread]}
                >
                  <Pressable
                    accessibilityRole={n.href ? 'link' : 'button'}
                    onPress={() => handleItemPress(n)}
                    style={({ pressed }) => [styles.rowMain, pressed && styles.pressed]}
                  >
                    <View style={[styles.rowIconFrame, { backgroundColor: colors.background }]}>
                      <Icon name={icon} size={16} color={colors.icon} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle}>{n.title}</Text>
                      {n.body ? <Text style={styles.rowSubtitle}>{n.body}</Text> : null}
                      <Text style={styles.rowMeta}>{formatRelative(n.createdAt)}</Text>
                    </View>
                    {n.readAt === null ? <View style={styles.rowUnreadDot} /> : null}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${n.title} 알림 삭제`}
                    onPress={() => handleDelete(n)}
                    hitSlop={4}
                    style={({ pressed }) => [styles.rowDeleteButton, pressed && styles.pressed]}
                  >
                    <Icon name="close" size={14} color={storybookTheme.color.onCardMuted} />
                  </Pressable>
                </View>
              );
            })}
          </ScrollView>
        )}
      </Modal>
    </>
  );
}

/** "3분 전 / 2시간 전 / 어제 / 3월 12일" 정도의 대략 상대 시간. 정확도는 벨 목록 UX에 충분. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMinutes = Math.max(0, Math.floor((Date.now() - then) / 60000));
  if (diffMinutes < 1) return '방금 전';
  if (diffMinutes < 60) return `${diffMinutes}분 전`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return '어제';
  if (diffDays < 7) return `${diffDays}일 전`;
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(iso));
}

const styles = StyleSheet.create({
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  bellButtonDark: {
    backgroundColor: storybookTheme.color.contentPanel,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  bellButtonLight: {
    backgroundColor: storybookTheme.color.surfaceCard,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  pressed: { opacity: 0.85 },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.error,
    borderWidth: 1,
    borderColor: storybookTheme.color.background,
  },
  status: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardMuted,
    textAlign: 'center',
    paddingVertical: storybookTheme.spacing.md,
  },
  list: { maxHeight: 360 },
  listContent: { gap: storybookTheme.spacing.sm },
  // 바깥 컨테이너 - 본문(rowMain, 클릭 → mark-read + 이동)과 삭제 버튼(rowDeleteButton)을
  // 나란히 두는 shell. 예전엔 row 전체가 하나의 Pressable이었지만 x 버튼이 추가되면서 두
  // 조각으로 분리됐다. 배경/padding은 여기 컨테이너가 담당.
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: storybookTheme.spacing.xs,
    padding: storybookTheme.spacing.ms,
    borderRadius: storybookTheme.radius.input,
    backgroundColor: storybookTheme.color.pillBackground,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: storybookTheme.spacing.sm,
  },
  rowDeleteButton: {
    width: 24,
    height: 24,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  rowUnread: {
    backgroundColor: storybookTheme.color.pillBorder,
  },
  // kind별 아이콘 프레임 - background/icon 색은 toneColors()가 인라인으로 결정한다.
  rowIconFrame: {
    width: 32,
    height: 32,
    borderRadius: storybookTheme.radius.input,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 오른쪽 unread 점 - 열 자리에 있던 예전 dot을 대체. 아이콘 프레임이 좌측 신호를 담당하고,
  // 이 점은 "아직 안 읽음"을 명확히 알려 주는 이중 시그널.
  rowUnreadDot: {
    width: 8,
    height: 8,
    borderRadius: storybookTheme.radius.pill,
    backgroundColor: storybookTheme.color.gold,
    marginTop: 4,
  },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  rowSubtitle: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
  rowMeta: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onCardMuted,
    marginTop: 2,
  },
});

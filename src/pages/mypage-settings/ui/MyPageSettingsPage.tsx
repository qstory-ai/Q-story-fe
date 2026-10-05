import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import { AppNavShell, ErrorState, Icon, LoadingState, StatusBanner, SwitchField, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth, type UserSummary } from '@/entities/auth';
import {
  getNotificationSettings,
  updateNotificationSettings,
  type NotificationSettings,
} from '@/entities/notification-settings';

import { VoiceResearchConsentSection } from './VoiceResearchConsentSection';

/**
 * 설정(UX 정리 4번) - 예전 "알림 설정"(/mypage/notifications)과 "개인정보 및 데이터"(/mypage/privacy)를
 * 한 화면에 둔다(두 옛 경로는 여기로 넘어온다). 역할 가드는 그대로:
 *  - 알림: BE /v1/me/notification-settings가 모든 로그인 역할을 받으므로 모두에게 보인다.
 *    수업 시작/완료 알림은 보호자에게만 발송되므로 PARENT에게만 스위치를 보인다.
 *  - 약관·개인정보·데이터 요청·탈퇴: 모든 역할.
 *  - 음성 연구 저장 동의: 보호자 동의라 PARENT만(BE도 PARENT만 받는다).
 */
export function MyPageSettingsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated') navigate('/', { replace: true });
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, pathname)} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">설정</Text>

        <Text style={styles.groupTitle} accessibilityRole="header">알림</Text>
        <NotificationSection token={state.token} user={state.user} />

        <Text style={styles.groupTitle} accessibilityRole="header">개인정보와 데이터</Text>
        <PrivacySections onDeleteAccount={() => navigate('/mypage/delete-account')} />
        {state.user.role === 'PARENT' ? <VoiceResearchConsentSection token={state.token} userId={state.user.id} /> : null}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- 알림 */

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; settings: NotificationSettings }
  | { status: 'error'; message: string };

/** 각 스위치는 BE에 즉시 PATCH로 보내는 낙관적 UI - 저장 버튼 없이 토글이 곧 저장이다. */
function NotificationSection({ token, user }: { token: string; user: UserSummary }) {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [savingKey, setSavingKey] = useState<keyof NotificationSettings | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getNotificationSettings(token)
      .then((settings) => {
        if (!cancelled) setLoad({ status: 'ready', settings });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoad({ status: 'error', message: messageForError(error, '알림 설정을 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  async function toggle(key: keyof NotificationSettings, next: boolean) {
    if (load.status !== 'ready') return;
    setSavingKey(key);
    setSaveError(null);
    // 낙관적 업데이트 - 실패 시 롤백한다.
    const previous = load.settings;
    setLoad({ status: 'ready', settings: { ...previous, [key]: next } });
    try {
      const updated = await updateNotificationSettings(token, { [key]: next });
      setLoad({ status: 'ready', settings: updated });
    } catch (error: unknown) {
      setLoad({ status: 'ready', settings: previous });
      setSaveError(messageForError(error, '설정을 저장하지 못했어요.'));
    } finally {
      setSavingKey(null);
    }
  }

  if (load.status === 'loading') return <LoadingState label="알림 설정을 불러오는 중이에요…" />;
  if (load.status === 'error') {
    return (
      <ErrorState
        message={load.message}
        onRetry={() => {
          setLoad({ status: 'loading' });
          setReloadKey((n) => n + 1);
        }}
      />
    );
  }
  return (
    <>
      <View style={styles.switchCard}>
        <SwitchField
          label="새 작품 출시 알림"
          description="새 이야기가 서재에 올라올 때 이메일과 앱 알림으로 알려드려요."
          checked={load.settings.marketingEnabled}
          onChange={(next) => toggle('marketingEnabled', next)}
          disabled={savingKey === 'marketingEnabled'}
        />
        {/* 이 두 알림은 지금 보호자(linkedParentUser)에게만 발송된다(LessonReminderScheduler/
            LessonService/StoryCompletionService) - 선생님 계정에 보여줘도 받는 알림에 영향이
            없어서 보호자 계정에만 노출한다. */}
        {user.role === 'PARENT' ? (
          <>
            <SwitchField
              label="수업 시작 알림"
              description="선생님과의 수업 시작 30분 전에 알려드려요."
              checked={load.settings.lessonReminderEnabled}
              onChange={(next) => toggle('lessonReminderEnabled', next)}
              disabled={savingKey === 'lessonReminderEnabled'}
            />
            <SwitchField
              label="수업 완료 알림"
              description="수업이 끝나면 리포트가 도착했다고 알려드려요."
              checked={load.settings.lessonReportEnabled}
              onChange={(next) => toggle('lessonReportEnabled', next)}
              disabled={savingKey === 'lessonReportEnabled'}
            />
          </>
        ) : null}
      </View>
      {saveError ? <StatusBanner variant="warning" label={saveError} /> : null}
    </>
  );
}

/* -------------------------------------------------------------- 개인정보와 데이터 */

type Section = {
  title: string;
  body: string;
  /** URL/이메일 처럼 클릭 시 실제 행동이 있는 경우. pendingLabel과 배타적. */
  action?: { label: string; onPress: () => void };
  /** 아직 준비되지 않은 액션(URL 미결정 등)의 자리를 지키는 라벨. 클릭 불가능한 pill로 렌더. */
  pendingLabel?: string;
};

// 실제 약관/정책 문서 URL은 서비스 오픈 시점에 확정된다 - 정식 URL이 확정되면 여기를 채우면
// docSection이 "곧 공개" pill 대신 클릭 가능한 링크를 붙여 준다.
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

function PrivacySections({ onDeleteAccount }: { onDeleteAccount: () => void }) {
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
      action: { label: '회원 탈퇴 화면으로', onPress: onDeleteAccount },
    },
  ];

  return (
    <>
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
    </>
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
  groupTitle: {
    marginTop: storybookTheme.spacing.sm,
    paddingHorizontal: storybookTheme.spacing.xs,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContentMuted,
    letterSpacing: 0.4,
  },
  switchCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.ms,
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

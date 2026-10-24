import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';

import {
  ActionButton,
  AppNavShell,
  AuthColumn,
  AuthLink,
  authText,
  BrandLockup,
  enterFadeUp,
  SafeAreaView,
  StatusBanner,
  StoryCard,
  TextField,
  storybookTheme,
  type IconName,
} from '@/shared/ui';
import { NotificationBell } from '@/features/notification-center';
import { OrgGuardianAck } from '@/features/terms-consent';
import {
  CONSENT_VERSION,
  createOrganization,
  dashboardNavItems,
  fetchEntitlement,
  useAuth,
  type EntitlementResponse,
  type UserSummary,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';
import { BETA_OPEN_ACCESS_NOTICE, subscriptionStatusLabel } from '@/shared/config';
import { InstitutionSearch } from '@/features/institution-search';
import { HomeGreetingCard, HomeListRow, HomeSection, timeOfDayGreeting } from '@/features/home-section';
import { listStories, unlockStateFor, type StoryCatalogEntry } from '@/entities/story';
import { storyDestination } from '@/features/story-library';
import { INSTITUTION_KIND_LABEL, type PublicInstitution } from '@/entities/public-institution';

/**
 * DIRECTOR 홈("/organization"). 기관이 없으면 기관 등록, 있으면 대시보드를 보여 준다 - 한 방향으로만
 * 진행하는 두 단계라 라우트를 나누지 않았다. 비로그인 방문자는 /signup?role=organization으로 보낸다.
 */
export function OrganizationSignupPage() {
  const { state } = useAuth();

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.centered}>
          <ActivityIndicator color={storybookTheme.color.primary} />
        </View>
      </SafeAreaView>
    );
  }
  if (state.status === 'authenticated' && state.user.role === 'DIRECTOR') {
    return state.user.organizationId ? (
      <ClassManagementStep token={state.token} organizationId={state.user.organizationId} user={state.user} />
    ) : (
      <CreateOrganizationStep token={state.token} user={state.user} />
    );
  }
  if (state.status === 'authenticated') {
    return <Redirect to="/" />;
  }
  return <Redirect to="/signup?role=organization" />;
}

function Redirect({ to }: { to: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to, { replace: true });
  }, [navigate, to]);
  return null;
}

/**
 * 기관 등록 - 공공데이터 유치원·어린이집 목록에서 고르거나(기본), 목록에 없으면 이름을 직접 입력한다.
 * 목록에서 고른 기관은 서버가 그 이름으로 등록하고, 이미 다른 원장님이 등록한 곳이면 고를 수 없게 막는다.
 */
function CreateOrganizationStep({ token, user }: { token: string; user: UserSummary }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { setSession } = useAuth();
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [picked, setPicked] = useState<PublicInstitution | null>(null);
  const [name, setName] = useState('');
  // 원아 보호자 동의 확인(필수, A5) - 기관 단위로 남는다.
  const [guardianAck, setGuardianAck] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickedTaken = picked?.registered === true;

  const onSubmit = useCallback(async () => {
    setError(null);
    setSubmitting(true);
    try {
      const response = await createOrganization(token, {
        name: mode === 'search' && picked ? picked.name : name.trim(),
        guardianConsentAck: guardianAck,
        consentVersion: CONSENT_VERSION,
        publicInstitutionId: mode === 'search' && picked ? picked.id : null,
      });
      setSession(response.token, response.user);
    } catch (failure) {
      setError(messageForError(failure, '기관을 등록하지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }, [token, mode, picked, name, guardianAck, setSession]);

  return (
    // 가입 흐름의 마지막 단계라 로그인·가입 화면과 같은 컬럼(420, 아이보리)에 둔다 - 내비게이션은 그대로.
    <AppNavShell tone="warm" items={dashboardNavItems(user, navigate, pathname)}>
      <AuthColumn>
        <View style={styles.form}>
          <Text style={authText.title} accessibilityRole="header">기관 등록</Text>
          {mode === 'search' ? (
            <>
              <Text style={authText.lead}>
                거의 다 됐어요. 우리 유치원·어린이집을 찾아 골라 주세요. 목록에서 고르면 선생님들이 검색해 소속을 신청할 수 있어요.
              </Text>
              <InstitutionSearch
                token={token}
                selectedId={picked?.id ?? null}
                onSelect={(institution) => {
                  setPicked(institution);
                  setError(null);
                }}
                badgeFor={(institution) => (institution.registered ? '이미 등록됨' : null)}
              />
              {picked ? (
                pickedTaken ? (
                  <StatusBanner
                    variant="warning"
                    label="이미 다른 관리자가 등록한 기관이에요."
                    body="그 기관의 관리자에게 선생님 초대를 받거나, 잘못 등록됐다면 고객센터로 알려 주세요."
                  />
                ) : (
                  <StatusBanner
                    variant="info"
                    label={`${picked.name}(${INSTITUTION_KIND_LABEL[picked.kind]})으로 등록해요`}
                    body={picked.address ?? undefined}
                  />
                )
              ) : null}
              <OrgGuardianAck checked={guardianAck} onChange={setGuardianAck} />
              {error ? <StatusBanner variant="warning" label={error} /> : null}
              <ActionButton
                variant="gold"
                label="이 기관으로 등록하기"
                loading={submitting}
                onPress={onSubmit}
                disabled={!picked || pickedTaken || !guardianAck}
              />
              <AuthLink
                accessibilityRole="button"
                label="목록에 없어요 · 이름 직접 입력하기"
                onPress={() => {
                  setMode('manual');
                  setError(null);
                }}
              />
            </>
          ) : (
            <>
              <Text style={authText.lead}>기관 이름을 알려주세요. 나중에 목록과 연결할 수도 있어요.</Text>
              <TextField label="기관 이름" value={name} onChangeText={setName} />
              <OrgGuardianAck checked={guardianAck} onChange={setGuardianAck} />
              {error ? <StatusBanner variant="warning" label={error} /> : null}
              <ActionButton
                variant="gold"
                label="등록하기"
                loading={submitting}
                onPress={onSubmit}
                disabled={!name.trim() || !guardianAck}
              />
              <AuthLink
                accessibilityRole="button"
                label="유치원·어린이집 목록에서 찾기"
                onPress={() => {
                  setMode('search');
                  setError(null);
                }}
              />
            </>
          )}
        </View>
      </AuthColumn>
    </AppNavShell>
  );
}

/** 관리자 홈의 바로가기 - IA "관리자"의 각 화면. 가장 자주 쓰는 반/학생 관리가 맨 위. */
const DIRECTOR_SHORTCUTS: Array<{ title: string; body: string; icon: IconName; path: string }> = [
  { title: '반/학생 관리', body: '반을 만들고 담임 선생님을 배정하고 학생 명단을 확인해요.', icon: 'graduationCap', path: '/organization/classes' },
  { title: '선생님 관리', body: '소속 선생님을 초대하고, 선생님이 보낸 소속 신청을 수락해요.', icon: 'users', path: '/organization/tutors' },
  { title: '리포트', body: '이용 현황과 반별 활동을 보고, 수업 기록은 개별 리포트로 열어 봐요.', icon: 'report', path: '/organization/reports' },
  { title: '이용권', body: '기관 이용권 상태와 활성 이용 범위를 확인해요.', icon: 'shield', path: '/organization/subscription' },
];

/**
 * 기관 등록 이후의 관리자 홈 - 보호자 홈(/parent)과 같은 생김새(상단 바 → 인사 카드 → "더 보기"가 달린 섹션).
 * 인사 카드에 이용권 상태, 그 아래 관리 화면 바로가기와 우리 기관 아이들이 읽는 이야기 줄.
 */
function ClassManagementStep({
  token,
  organizationId,
  user,
}: {
  token: string;
  organizationId: string;
  user: UserSummary;
}) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { state } = useAuth();
  const [entitlement, setEntitlement] = useState<EntitlementResponse | null>(null);
  // fetchEntitlement가 조용히 실패해도 대시보드가 살아 있어야 하지만, 로딩 중임을 표시는 해야
  // "구독 상태가 없는 건지, 아직 안 온 건지" 사용자가 혼동하지 않는다. done=true는 성공/실패 무관.
  const [entitlementDone, setEntitlementDone] = useState(false);
  const [stories, setStories] = useState<StoryCatalogEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchEntitlement(token, organizationId)
      .then((response) => {
        if (!cancelled) setEntitlement(response);
      })
      .catch(() => {
        // 구독 상태는 부가 정보라 조회 실패해도 대시보드 자체는 그대로 쓸 수 있어야 한다.
      })
      .finally(() => {
        if (!cancelled) setEntitlementDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, organizationId]);

  useEffect(() => {
    let cancelled = false;
    listStories()
      .then((list) => {
        if (!cancelled) setStories(list);
      })
      .catch(() => {
        // 이야기 줄은 부가 섹션이라 실패하면 줄째 숨긴다.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppNavShell tone="warm" items={dashboardNavItems(user, navigate, pathname)}>
      <View style={styles.homeScroll}>
        <View style={styles.topBar}>
          <BrandLockup size="compact" />
          <NotificationBell token={token} />
        </View>

        <HomeGreetingCard
          title={`${user.displayName}님, ${timeOfDayGreeting()}`}
          body="반과 학생, 소속 선생님, 이용 현황을 이곳에서 한눈에 관리해요."
        >
          {/* grantsAccess=false여도 requiresEntitlement=false인 무료 데모는 계속 열린다
              (EntitlementService.assertAccessible) - 그래서 "구독 후 전체 이야기"라고만 안내한다. */}
          {entitlement ? (
            <View style={styles.entitlementBanner}>
              <StatusBanner
                variant={entitlement.grantsAccess || user.grantsAccess ? 'info' : 'warning'}
                label={subscriptionStatusLabel(entitlement.subscriptionStatus)}
                body={
                  entitlement.grantsAccess
                    ? undefined
                    : user.grantsAccess
                    ? BETA_OPEN_ACCESS_NOTICE
                    : '이용권 없이도 무료 데모 한 편은 계속 이용할 수 있어요. 전체 이야기는 이용권이 있으면 열려요.'
                }
              />
            </View>
          ) : !entitlementDone ? (
            <View style={styles.entitlementLoader}>
              <ActivityIndicator color={storybookTheme.color.primary} />
              <Text style={styles.entitlementLoaderText}>이용권 상태를 확인 중이에요…</Text>
            </View>
          ) : null}
        </HomeGreetingCard>

        <View style={styles.section}>
          <HomeSection title="기관 관리" layout="list">
            {DIRECTOR_SHORTCUTS.map((shortcut) => (
              <HomeListRow
                key={shortcut.path}
                icon={shortcut.icon}
                label={shortcut.title}
                meta={shortcut.body}
                onPress={() => navigate(shortcut.path)}
                accessibilityLabel={shortcut.title}
              />
            ))}
          </HomeSection>
        </View>

        {stories.length > 0 ? (
          <View style={styles.section}>
            <HomeSection title="우리 기관 이야기" subtitle="선생님들이 수업에 쓰는 이야기예요. 눌러서 미리 볼 수 있어요.">
              {stories.slice(0, 8).map((story) => (
                <StoryCard
                  key={story.storyId}
                  size="mini"
                  title={story.title}
                  coverImageUrl={story.coverImageUrl}
                  onPress={() => navigate(storyDestination(story, state))}
                  locked={unlockStateFor(story, state) === 'locked'}
                />
              ))}
            </HomeSection>
          </View>
        ) : null}
      </View>
    </AppNavShell>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, backgroundColor: storybookTheme.color.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  form: { gap: 14, ...enterFadeUp },
  entitlementLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.sm,
  },
  entitlementLoaderText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  homeScroll: {
    flex: 1,
    width: '100%',
    alignItems: 'stretch',
    gap: 20,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingTop: storybookTheme.spacing.lg,
    paddingBottom: storybookTheme.spacing.xl,
  },
  topBar: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    width: '100%',
    maxWidth: storybookTheme.layout.dashboardCardWideMaxWidth,
    alignSelf: 'center',
  },
  entitlementBanner: { marginTop: storybookTheme.spacing.sm },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { ActionButton, ErrorState, LoadingState, SafeAreaView, StatusBanner, storybookTheme } from '@/shared/ui';
import { normalizeInviteCode, teacherTitle } from '@/shared/lib';
import { TUTOR_PATHS, homePathFor, markOnboardingDone, useAuth } from '@/entities/auth';
import {
  acceptHomeroomInviteByCode,
  homeroomInviteFailureKind,
  homeroomInviteFailureMessage,
  previewHomeroomInviteByCode,
  type HomeroomInviteFailureKind,
  type HomeroomInvitePreview,
} from '@/entities/homeroom-invite';
import { formatInviteExpiry } from '@/features/invite-issue';

import {
  selectHomeroomInviteView,
  shouldAutoAccept,
  tutorSignInPath,
  tutorSignUpPath,
  type PreviewLoad,
  type ViewerAuth,
} from '../model/homeroom-invite-view';

type KeyedPreview = { key: string; value: PreviewLoad<HomeroomInvitePreview> };

/**
 * 담임 초대(`/homeroom-invite?code=`). 관리자가 보낸 링크를 선생님이 열면 어느 기관·반의 담임 초대인지 먼저 보고,
 * 선생님 계정으로 가입하거나 로그인한 뒤 수락해 그 반 담임이 된다(기관 소속도 함께). 가입·로그인에서 돌아올 때는
 * accept=1이 붙어 곧바로 수락하고 반 화면으로 간다. 반 초대(/join)·기관 초대(/org-invite)와 같은 짜임이다.
 */
export function HomeroomInvitePage() {
  const [searchParams] = useSearchParams();
  const code = normalizeInviteCode(searchParams.get('code') ?? '');
  const autoAccept = searchParams.get('accept') === '1';
  const navigate = useNavigate();
  const { state, refresh, logout } = useAuth();

  const [attempt, setAttempt] = useState(0);
  const key = `${code}:${attempt}`;
  const [load, setLoad] = useState<KeyedPreview>({ key, value: { status: 'loading' } });
  const [submitting, setSubmitting] = useState(false);
  const [acceptError, setAcceptError] = useState<{ kind: HomeroomInviteFailureKind; message: string } | null>(null);
  const autoTried = useRef(false);

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    previewHomeroomInviteByCode(code)
      .then((preview) => {
        if (!cancelled) setLoad({ key, value: { status: 'ready', preview } });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          key,
          value: {
            status: 'error',
            kind: homeroomInviteFailureKind(failure),
            message: homeroomInviteFailureMessage(failure, '담임 초대를 확인하지 못했어요.'),
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [code, key]);

  const preview: PreviewLoad<HomeroomInvitePreview> = load.key === key ? load.value : { status: 'loading' };
  const auth: ViewerAuth =
    state.status === 'authenticated' ? { status: 'authenticated', role: state.user.role } : { status: state.status };
  const view = selectHomeroomInviteView(code, preview, auth, acceptError?.kind);

  const accept = useCallback(async () => {
    if (state.status !== 'authenticated' || state.user.role !== 'TUTOR' || !code) return;
    setSubmitting(true);
    setAcceptError(null);
    try {
      const classGroup = await acceptHomeroomInviteByCode(state.token, code);
      // 기관에 들어가 반까지 맡았으니 선생님 온보딩(소속 설정)도 끝난 것이다.
      markOnboardingDone('tutor', state.user.id);
      // 기관 소속이 이용권에 반영되도록 /v1/auth/me를 다시 읽는다.
      await refresh();
      navigate(TUTOR_PATHS.classDetail(classGroup.id), { replace: true });
    } catch (failure: unknown) {
      setAcceptError({
        kind: homeroomInviteFailureKind(failure),
        message: homeroomInviteFailureMessage(failure, '담임 초대를 수락하지 못했어요. 잠시 후 다시 시도해 주세요.'),
      });
      setSubmitting(false);
    }
  }, [state, code, refresh, navigate]);

  useEffect(() => {
    if (!shouldAutoAccept(view, autoAccept, autoTried.current)) return;
    autoTried.current = true;
    void accept();
  }, [view, autoAccept, accept]);

  const goHome = () => navigate(state.status === 'authenticated' ? homePathFor(state.user) : '/', { replace: true });

  let body;
  if (view === 'loading') {
    body = <LoadingState label="담임 초대를 확인하는 중이에요…" />;
  } else if (view === 'invalid' || view === 'expired') {
    // 410은 서버가 이유(새 코드로 바뀜·기한 지남·이미 사용)를 safeDetail로 구분해 준다 - 그 문장을 그대로 보여 준다.
    const expiredDetail =
      acceptError?.kind === 'expired' ? acceptError.message : preview.status === 'error' ? preview.message : '';
    body = (
      <View style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {view === 'expired' ? '이 담임 초대는 지금 쓸 수 없어요' : '담임 초대를 찾지 못했어요'}
        </Text>
        {view === 'expired' && expiredDetail ? <Text style={styles.note}>{expiredDetail}</Text> : null}
        <Text style={styles.note}>
          {view === 'expired'
            ? '담임 초대는 한 선생님만, 정해진 기간 안에 쓸 수 있어요. 관리자에게 새 코드를 만들어 달라고 요청해 주세요.'
            : '코드가 잘못 복사됐거나 관리자가 새 코드를 만들었을 수 있어요. 관리자에게 링크를 다시 받아 주세요.'}
        </Text>
        <ActionButton variant="secondaryFull" label="홈으로" onPress={goHome} />
      </View>
    );
  } else if (view === 'error') {
    body = (
      <View style={styles.card}>
        <ErrorState
          message={preview.status === 'error' ? preview.message : '담임 초대를 확인하지 못했어요.'}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      </View>
    );
  } else if (preview.status === 'ready') {
    const invite = preview.preview;
    const expiry = formatInviteExpiry(invite.expiresAt);
    body = (
      <>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>담임 초대</Text>
          <Text style={styles.title} accessibilityRole="header">
            {`${invite.organizationName} ${invite.className}\n담임으로 초대받았어요`}
          </Text>
          <Text style={styles.lead}>
            수락하면 {invite.organizationName}에 선생님으로 소속되고, 바로 {invite.className} 담임이 돼요. 반 학생 명단과 수업, 리포트를 선생님 계정에서 이어 가요.
          </Text>
          {invite.currentHomeroomName ? (
            <Text style={styles.lead}>
              지금 담임은 {teacherTitle(invite.currentHomeroomName)}이에요. 수락하면 담임이 바뀌고, 지난 수업과 리포트는 그때 선생님 것으로 남아요.
            </Text>
          ) : null}
          {expiry ? <Text style={styles.meta}>{expiry}까지 쓸 수 있는 초대예요.</Text> : null}
        </View>

        {view === 'sign-in' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>선생님 계정으로 시작해요</Text>
            <ActionButton
              variant="gold"
              label="처음이에요 · 선생님 계정 만들기"
              onPress={() => navigate(tutorSignUpPath(code))}
            />
            <ActionButton
              variant="secondaryFull"
              label="이미 선생님 계정이 있어요 · 로그인"
              onPress={() => navigate(tutorSignInPath(code))}
            />
            <Text style={styles.note}>가입하거나 로그인하면 이 화면으로 돌아와 바로 담임으로 연결돼요.</Text>
          </View>
        ) : view === 'wrong-role' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>담임 초대는 선생님 계정에서 받을 수 있어요</Text>
            <Text style={styles.note}>
              지금은 선생님이 아닌 계정으로 로그인돼 있어요. 로그아웃한 뒤 선생님 계정으로 로그인하거나 새로 만들어 주세요.
            </Text>
            <ActionButton variant="gold" label="로그아웃하고 선생님으로 계속" onPress={logout} />
            <ActionButton variant="secondaryFull" label="내 홈으로" onPress={goHome} />
          </View>
        ) : (
          <View style={styles.card}>
            {acceptError ? <StatusBanner variant="warning" label={acceptError.message} /> : null}
            <ActionButton
              variant="gold"
              label={submitting ? '연결하는 중…' : '담임으로 시작하기'}
              loading={submitting}
              disabled={submitting}
              onPress={() => { void accept(); }}
            />
          </View>
        )}
      </>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>{body}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: storybookTheme.color.background },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: storybookTheme.spacing.md,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingVertical: storybookTheme.spacing.xxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  hero: { gap: storybookTheme.spacing.sm },
  eyebrow: {
    color: storybookTheme.color.goldText,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  title: {
    color: storybookTheme.color.onContent,
    fontSize: storybookTheme.type.xl,
    lineHeight: storybookTheme.type.xl * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.xl * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.black,
  },
  lead: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
  },
  meta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContentMuted },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
  },
  cardTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  note: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onCardBody,
  },
});

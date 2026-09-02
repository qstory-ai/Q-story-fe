import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, AppNavShell, StatusBanner, storybookTheme } from '@/shared/ui';
import {
  createClassInvite,
  dashboardNavItems,
  fetchClass,
  listClassParents,
  useAuth,
  type ClassMemberResponse,
  type ClassResponse,
} from '@/entities/auth';
import { messageForError } from '@/shared/api';
import { InviteCodeCard } from '@/features/invite-issue';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; classGroup: ClassResponse; parents: ClassMemberResponse[] }
  | { status: 'error'; message: string };

/**
 * IA "반 상세" 화면. 기본 정보(이름/반 코드) + 1회용 초대 링크 발급 + 이 반에 소속된 부모 목록.
 * 반 자체 계정(CLASS_ACCOUNT)의 로그인 정보는 여기서 노출하지 않는다 - 그건 반 계정 홈에서만.
 */
export function OrganizationClassDetailPage() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [issuedInvite, setIssuedInvite] = useState<{ token: string; expiresAt: string } | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  const canView = state.status === 'authenticated' && state.user.role === 'DIRECTOR';

  useEffect(() => {
    if (state.status === 'loading') return;
    if (!canView) {
      navigate('/', { replace: true });
    }
  }, [state.status, canView, navigate]);

  useEffect(() => {
    if (state.status !== 'authenticated' || !classId) return;
    let cancelled = false;
    Promise.all([fetchClass(state.token, classId), listClassParents(state.token, classId).catch(() => [])])
      .then(([classGroup, parents]) => {
        if (!cancelled) setLoad({ status: 'ready', classGroup, parents });
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setLoad({
          status: 'error',
          message: messageForError(failure, '반 정보를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.'),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [state, classId]);

  const onIssueInvite = useCallback(async () => {
    if (state.status !== 'authenticated' || !classId) return;
    setIssuing(true);
    setIssueError(null);
    try {
      const invite = await createClassInvite(state.token, classId);
      setIssuedInvite(invite);
    } catch (failure: unknown) {
      setIssueError(messageForError(failure, '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setIssuing(false);
    }
  }, [state, classId]);

  if (!canView) return null;

  const originBase = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'home')} onBack={() => navigate('/organization/classes')}>
      <View style={styles.content}>
        {load.status === 'loading' && (
          <View style={styles.centerBox}><ActivityIndicator color={storybookTheme.color.gold} /></View>
        )}

        {load.status === 'error' && (
          <View style={styles.centerBox}>
            <Text style={styles.errorText}>{load.message}</Text>
            <ActionButton variant="secondary" label="반 목록으로" onPress={() => navigate('/organization/classes')} />
          </View>
        )}

        {load.status === 'ready' && (
          <>
            <View style={styles.card}>
              <Text style={styles.title} accessibilityRole="header">{load.classGroup.name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>반 코드</Text>
                <Text style={styles.metaValue}>{load.classGroup.joinCode}</Text>
              </View>
              <Text style={styles.body}>
                반 코드는 부모가 회원가입 시 사용할 수 있는 영구 코드예요. 아래에서 1회용 초대 링크도 발급할 수 있어요.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>1회용 초대 발급</Text>
              <Text style={styles.body}>
                반 코드와 별개로, 특정 부모에게만 전달할 1회용 초대 링크를 발급할 수 있어요. 발급된 링크는 14일 후 만료돼요.
              </Text>
              <ActionButton
                label={issuing ? '초대 만드는 중…' : '초대 링크 발급'}
                onPress={onIssueInvite}
                disabled={issuing}
              />
              {issueError ? <StatusBanner variant="warning" label={issueError} /> : null}
              {issuedInvite ? (
                <InviteCodeCard
                  shortCode={issuedInvite.token.slice(0, 8).toUpperCase()}
                  link={`${originBase}/signup?invite=${issuedInvite.token}`}
                  expiresLabel={formatExpires(issuedInvite.expiresAt)}
                  onDismiss={() => setIssuedInvite(null)}
                />
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>반에 속한 부모 {load.parents.length}명</Text>
              {load.parents.length === 0 ? (
                <Text style={styles.body}>아직 반에 참여한 부모가 없어요. 반 코드나 초대 링크를 전달해 보세요.</Text>
              ) : (
                <View style={styles.list}>
                  {load.parents.map((parent) => (
                    <View key={parent.id} style={styles.parentRow}>
                      <View style={styles.parentBody}>
                        <Text style={styles.parentName}>
                          {parent.displayName}
                          {parent.childName ? ` · ${parent.childName} 보호자` : ''}
                        </Text>
                        {parent.email ? <Text style={styles.parentMeta}>{parent.email}</Text> : null}
                        <Text style={styles.parentMeta}>참여: {formatShortDate(parent.joinedAt)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </View>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- helpers */

function formatExpires(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric' }).format(new Date(iso));
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso));
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    width: '100%',
    maxWidth: storybookTheme.layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 14,
  },
  centerBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  errorText: { color: storybookTheme.color.error, fontSize: storybookTheme.type.sm, textAlign: 'center' },
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  metaLabel: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
  metaValue: {
    fontSize: storybookTheme.type.md,
    letterSpacing: 2,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
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
  list: { gap: 8 },
  parentRow: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
    gap: 2,
  },
  parentBody: { gap: 2 },
  parentName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  parentMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
});

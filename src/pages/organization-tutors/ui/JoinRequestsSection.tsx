import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Card, ErrorState, LoadingState, radius, semanticColors, shadow, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { HomeSection } from '@/features/home-section';
import { InstitutionSearch } from '@/features/institution-search';
import {
  INSTITUTION_KIND_LABEL,
  acceptOrganizationJoinRequest,
  fetchOrganizationProfile,
  linkOrganizationPublicInstitution,
  listOrganizationJoinRequests,
  rejectOrganizationJoinRequest,
  type OrganizationJoinRequest,
  type OrganizationProfile,
  type PublicInstitution,
} from '@/entities/public-institution';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; profile: OrganizationProfile | null; requests: OrganizationJoinRequest[] }
  | { status: 'error'; message: string };

/**
 * 선생님 관리 화면 맨 위 - 선생님이 검색으로 보낸 소속 신청(수락·거절)과, 우리 기관이 공공 기관 목록과 연결됐는지.
 * 연결이 안 된 기관(예전에 이름을 직접 입력해 등록)은 선생님 검색에 나오지 않으므로 여기서 연결하게 한다.
 * 수락하면 초대 코드 수락과 같은 소속이 돼 onAccepted로 소속 선생님 목록을 다시 불러오게 한다.
 */
export function JoinRequestsSection({
  token,
  organizationId,
  onAccepted,
}: {
  token: string;
  organizationId: string;
  onAccepted: () => void;
}) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [picked, setPicked] = useState<PublicInstitution | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchOrganizationProfile(token, organizationId).catch(() => null),
      listOrganizationJoinRequests(token, organizationId),
    ])
      .then(([profile, requests]) => {
        if (!cancelled) setLoad({ status: 'ready', profile, requests });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: messageForError(failure, '소속 신청을 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, organizationId, reloadKey]);

  async function decide(request: OrganizationJoinRequest, accept: boolean) {
    setActionError(null);
    setBusyId(request.id);
    try {
      if (accept) await acceptOrganizationJoinRequest(token, organizationId, request.id);
      else await rejectOrganizationJoinRequest(token, organizationId, request.id);
      setLoad((prev) => prev.status === 'ready'
        ? { ...prev, requests: prev.requests.filter((item) => item.id !== request.id) }
        : prev);
      if (accept) onAccepted();
    } catch (failure: unknown) {
      setActionError(messageForError(failure, accept ? '수락하지 못했어요.' : '거절하지 못했어요.'));
      setReloadKey((n) => n + 1);
    } finally {
      setBusyId(null);
    }
  }

  async function link() {
    if (!picked) return;
    setActionError(null);
    setLinking(true);
    try {
      const profile = await linkOrganizationPublicInstitution(token, organizationId, picked.id);
      setLoad((prev) => prev.status === 'ready' ? { ...prev, profile } : prev);
      setPicked(null);
    } catch (failure: unknown) {
      setActionError(messageForError(failure, '목록과 연결하지 못했어요.'));
    } finally {
      setLinking(false);
    }
  }

  if (load.status === 'loading') {
    return (
      <HomeSection title="소속 신청" layout="list">
        <LoadingState compact label="소속 신청을 불러오는 중이에요…" />
      </HomeSection>
    );
  }
  if (load.status === 'error') {
    return (
      <HomeSection title="소속 신청" layout="list">
        <ErrorState message={load.message} onRetry={() => setReloadKey((n) => n + 1)} />
      </HomeSection>
    );
  }

  const linked = load.profile?.publicInstitution ?? null;
  const pickedTaken = picked?.registered === true && picked.organizationId !== organizationId;

  return (
    <HomeSection title={`소속 신청${load.requests.length > 0 ? ` ${load.requests.length}건` : ''}`} layout="list">
      {actionError ? <StatusBanner variant="warning" label={actionError} /> : null}
      {load.requests.length === 0 ? (
        <Text style={styles.emptyText}>
          {linked
            ? '아직 기다리는 신청이 없어요. 선생님이 기관을 검색해 신청하면 여기에 보여요.'
            : '선생님이 검색해서 신청하려면 먼저 우리 기관을 유치원·어린이집 목록과 연결해 주세요.'}
        </Text>
      ) : (
        load.requests.map((request) => (
          // 수락·거절 버튼이 함께 있어 HomeListRow 대신 같은 모양의 흰 행을 직접 그린다.
          <View key={request.id} style={styles.requestRow}>
            <View style={styles.requestInfo}>
              <Text style={styles.requestName}>{request.tutorDisplayName}</Text>
              {request.tutorEmail ? <Text style={styles.meta}>{request.tutorEmail}</Text> : null}
              <Text style={styles.meta}>신청: {formatDate(request.createdAt)}</Text>
            </View>
            <View style={styles.requestActions}>
              <ActionButton
                label="수락"
                size="sm"
                onPress={() => { void decide(request, true); }}
                loading={busyId === request.id}
                disabled={busyId !== null}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${request.tutorDisplayName} 소속 신청 거절`}
                onPress={() => { void decide(request, false); }}
                disabled={busyId !== null}
                style={({ pressed }) => [styles.rejectButton, pressed && styles.pressed]}
              >
                <Text style={styles.rejectLabel}>거절</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}

      {linked ? (
        <Text style={styles.linkedText}>
          목록 연결: {linked.name}({INSTITUTION_KIND_LABEL[linked.kind]}){linked.address ? ` · ${linked.address}` : ''}
        </Text>
      ) : (
        <Card variant="surface" style={styles.linkBox}>
          <Text style={styles.linkTitle}>우리 기관을 목록과 연결하기</Text>
          <InstitutionSearch
            token={token}
            selectedId={picked?.id ?? null}
            onSelect={setPicked}
            badgeFor={(institution) => (institution.registered ? '이미 등록됨' : null)}
          />
          {pickedTaken ? (
            <StatusBanner variant="warning" label="이미 다른 기관이 연결한 곳이에요." />
          ) : null}
          <ActionButton
            label={picked ? `${picked.name}과 연결하기` : '연결할 기관을 골라 주세요'}
            variant="secondaryFull"
            onPress={() => { void link(); }}
            loading={linking}
            disabled={!picked || pickedTaken || linking}
          />
        </Card>
      )}
    </HomeSection>
  );
}

const DATE_FORMAT = new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' });

function formatDate(iso: string) {
  return DATE_FORMAT.format(new Date(iso));
}

const L = semanticColors.light;

const styles = StyleSheet.create({
  emptyText: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
    paddingHorizontal: 4,
  },
  // HomeListRow와 같은 흰 행(radius 16, elevation 1). 좁은 화면에서는 버튼이 아래로 감긴다.
  requestRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.sm,
    backgroundColor: L.bg.primary,
    borderRadius: radius[16],
    borderWidth: 1,
    borderColor: L.border.secondary,
    ...shadow(1),
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  requestInfo: { flexGrow: 1, flexShrink: 1, minWidth: 160, gap: 2 },
  requestName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
  },
  meta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContentMuted },
  linkedText: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContentMuted, paddingHorizontal: 4 },
  requestActions: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.sm },
  rejectButton: {
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.error,
  },
  rejectLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.error,
  },
  pressed: { opacity: 0.8 },
  // 목록 연결 폼 - 공통 Card(surface)에 보호자 홈 카드와 같은 radius 24.
  linkBox: { borderRadius: radius[24], gap: storybookTheme.spacing.sm },
  linkTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
});

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton, Pill, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { InstitutionSearch } from '@/features/institution-search';
import {
  cancelJoinRequest,
  createJoinRequest,
  listMyJoinRequests,
  type JoinRequestStatus,
  type PublicInstitution,
  type TutorJoinRequest,
} from '@/entities/public-institution';

const STATUS_LABEL: Record<JoinRequestStatus, string> = {
  PENDING: '관리자 확인 중',
  ACCEPTED: '수락됨',
  REJECTED: '거절됨',
  CANCELED: '취소함',
};

/**
 * 선생님이 유치원·어린이집을 검색해 소속을 신청한다 → 원장님에게 알림 → 수락하면 초대 코드로 참여한 것과 같은 소속이 된다.
 * Q-Story에 아직 등록되지 않은 기관은 신청할 수 없어 안내만 한다. 내 신청(대기 중은 취소 가능)도 여기서 본다.
 */
export function JoinBySearchSection({
  token,
  memberOrganizationIds,
}: {
  token: string;
  /** 이미 소속된 기관 - 검색 결과에 "소속 중"으로 표시하고 신청 버튼을 막는다. */
  memberOrganizationIds: string[];
}) {
  const [requests, setRequests] = useState<TutorJoinRequest[]>([]);
  const [picked, setPicked] = useState<PublicInstitution | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ variant: 'info' | 'warning'; label: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listMyJoinRequests(token)
      .then((list) => {
        if (!cancelled) setRequests(list);
      })
      .catch(() => {
        // 신청 목록은 부가 정보 - 못 불러와도 검색·신청은 그대로 된다.
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pendingOrgIds = new Set(requests.filter((r) => r.status === 'PENDING').map((r) => r.organizationId));
  const memberIds = new Set(memberOrganizationIds);

  function badgeFor(institution: PublicInstitution): string | null {
    if (!institution.organizationId) return institution.registered === false ? 'Q-Story 미등록' : null;
    if (memberIds.has(institution.organizationId)) return '소속 중';
    if (pendingOrgIds.has(institution.organizationId)) return '신청 중';
    return null;
  }

  async function submit() {
    if (!picked?.organizationId) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const created = await createJoinRequest(token, picked.organizationId);
      setRequests((prev) => [created, ...prev.filter((r) => r.id !== created.id)]);
      setMessage({ variant: 'info', label: `${created.organizationName}에 소속을 신청했어요. 관리자가 수락하면 알려 드릴게요.` });
      setPicked(null);
    } catch (failure: unknown) {
      setMessage({ variant: 'warning', label: messageForError(failure, '소속을 신청하지 못했어요. 잠시 후 다시 시도해 주세요.') });
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(request: TutorJoinRequest) {
    setMessage(null);
    setCancellingId(request.id);
    try {
      const updated = await cancelJoinRequest(token, request.id);
      setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (failure: unknown) {
      setMessage({ variant: 'warning', label: messageForError(failure, '신청을 취소하지 못했어요.') });
    } finally {
      setCancellingId(null);
    }
  }

  const pickedBadge = picked ? badgeFor(picked) : null;
  const canRequest = Boolean(picked?.organizationId) && pickedBadge === null;
  const visibleRequests = requests.filter((r) => r.status !== 'CANCELED').slice(0, 5);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>유치원·어린이집 찾아 소속 신청</Text>
      <Text style={styles.body}>
        기관을 찾아 신청하면 관리자에게 알림이 가요. 관리자가 수락하면 초대 코드로 참여한 것과 똑같이 소속돼요.
      </Text>
      <InstitutionSearch
        token={token}
        selectedId={picked?.id ?? null}
        onSelect={(institution) => {
          setPicked(institution);
          setMessage(null);
        }}
        badgeFor={badgeFor}
      />
      {picked && !picked.organizationId ? (
        <StatusBanner
          variant="warning"
          label="아직 Q-Story에 등록되지 않은 기관이에요."
          body="관리자에게 Q-Story 기관 등록을 부탁하거나, 관리자에게 받은 초대 코드로 참여해 주세요."
        />
      ) : null}
      {message ? <StatusBanner variant={message.variant} label={message.label} /> : null}
      <ActionButton
        label={picked && canRequest ? `${picked.name}에 소속 신청` : '소속 신청'}
        onPress={() => { void submit(); }}
        loading={submitting}
        disabled={!canRequest || submitting}
      />

      {visibleRequests.length > 0 ? (
        <View style={styles.list}>
          <Text style={styles.listTitle}>내 소속 신청</Text>
          {visibleRequests.map((request) => (
            <View key={request.id} style={styles.requestRow}>
              <View style={styles.requestInfo}>
                <Text style={styles.requestName} numberOfLines={2}>{request.organizationName}</Text>
                <View style={styles.pillRow}>
                  <Pill label={STATUS_LABEL[request.status]} tone={request.status === 'PENDING' ? 'accent' : 'onLight'} />
                </View>
              </View>
              {request.status === 'PENDING' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${request.organizationName} 소속 신청 취소`}
                  onPress={() => { void cancel(request); }}
                  disabled={cancellingId !== null}
                  style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
                >
                  <Text style={styles.cancelLabel}>{cancellingId === request.id ? '취소 중…' : '신청 취소'}</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    padding: 20,
    gap: 10,
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
  list: { gap: 4, paddingTop: 4 },
  listTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: storybookTheme.color.pillBorder,
  },
  requestInfo: { flex: 1, minWidth: 0, gap: 4 },
  requestName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  pillRow: { flexDirection: 'row' },
  cancelButton: {
    paddingHorizontal: storybookTheme.spacing.ms,
    paddingVertical: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.pillBorder,
  },
  cancelLabel: {
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardBody,
  },
  pressed: { opacity: 0.8 },
});

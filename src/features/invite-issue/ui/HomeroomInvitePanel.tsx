import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, ErrorState, LoadingState, StatusBanner, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { createHomeroomInvite, fetchCurrentHomeroomInvite, type HomeroomInvite } from '@/entities/homeroom-invite';

import { formatInviteExpiry, homeroomInviteLink, homeroomInviteShareMessage } from '../lib/invite-links';
import { InviteCodeCard } from './InviteCodeCard';

type Props = {
  token: string;
  classId: string;
  className: string;
  organizationName: string | null;
  /** 이미 담임이 있는 반 - 수락하면 담임이 바뀐다고 알린다. */
  replacesHomeroom: boolean;
};

type Load =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; invite: HomeroomInvite | null }
  | { key: string; status: 'error'; message: string };

/**
 * 관리자 반 상세의 "담임 초대" - 지금 쓸 수 있는 코드를 보여 주고, 없으면 만들고, "새 코드 만들기"로 다시 만든다.
 * 다시 만들면 이전 코드는 쓸 수 없다(서버가 바꿔 끼운다).
 */
export function HomeroomInvitePanel({ token, classId, className, organizationName, replacesHomeroom }: Props) {
  const [retry, setRetry] = useState(0);
  const key = `${classId}:${retry}`;
  const [load, setLoad] = useState<Load>({ key, status: 'loading' });
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentHomeroomInvite(token, classId)
      .then((invite) => {
        if (!cancelled) setLoad({ key, status: 'ready', invite });
      })
      .catch((failure: unknown) => {
        if (!cancelled) setLoad({ key, status: 'error', message: messageForError(failure, '담임 초대를 불러오지 못했어요.') });
      });
    return () => {
      cancelled = true;
    };
  }, [token, classId, key]);

  const issue = useCallback(async () => {
    setIssuing(true);
    setIssueError(null);
    try {
      const invite = await createHomeroomInvite(token, classId);
      setLoad({ key, status: 'ready', invite });
    } catch (failure: unknown) {
      setIssueError(messageForError(failure, '담임 초대를 만들지 못했어요. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setIssuing(false);
    }
  }, [token, classId, key]);

  const value: Load = load.key === key ? load : { key, status: 'loading' };

  if (value.status === 'loading') return <LoadingState compact label="담임 초대를 불러오는 중이에요…" />;
  if (value.status === 'error') return <ErrorState message={value.message} onRetry={() => setRetry((n) => n + 1)} />;

  const replaceNote = replacesHomeroom
    ? '이 초대를 받은 선생님이 수락하면 지금 담임 대신 그 선생님이 이 반 담임이 돼요.'
    : null;

  if (!value.invite) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.title} accessibilityRole="header">담임 초대</Text>
        <Text style={styles.body}>
          담임 선생님께 보낼 초대를 만들어요. 선생님이 링크로 가입하면 바로 {className} 담임으로 연결되고, 기관에도 함께 소속돼요.
        </Text>
        {replaceNote ? <Text style={styles.body}>{replaceNote}</Text> : null}
        {issueError ? <StatusBanner variant="warning" label={issueError} /> : null}
        <ActionButton label={issuing ? '만드는 중…' : '담임 초대 만들기'} loading={issuing} onPress={issue} disabled={issuing} />
      </View>
    );
  }

  const { invite } = value;
  return (
    <View style={styles.stack}>
      <InviteCodeCard
        title="담임 초대"
        description={[
          `담임 선생님께 이 링크나 코드를 보내 주세요. 선생님이 가입하면 바로 ${className} 담임으로 연결되고, 기관에도 함께 소속돼요. 한 선생님만 쓸 수 있어요.`,
          replaceNote,
        ].filter(Boolean).join(' ')}
        shortCode={invite.shortCode}
        link={homeroomInviteLink(invite.shortCode)}
        shareMessage={homeroomInviteShareMessage(className, organizationName)}
        expiresLabel={formatInviteExpiry(invite.expiresAt)}
      />
      {issueError ? <StatusBanner variant="warning" label={issueError} /> : null}
      <View style={styles.reissueRow}>
        <ActionButton
          variant="secondary"
          size="sm"
          label={issuing ? '만드는 중…' : '새 코드 만들기'}
          loading={issuing}
          onPress={issue}
          disabled={issuing}
        />
        <Text style={[styles.note, styles.flex]}>새 코드를 만들면 지금 코드와 링크는 더 이상 쓸 수 없어요.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: storybookTheme.spacing.sm },
  emptyCard: {
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.primary,
    padding: 18,
    gap: storybookTheme.spacing.sm,
  },
  title: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
  },
  reissueRow: { flexDirection: 'row', alignItems: 'center', gap: storybookTheme.spacing.sm, flexWrap: 'wrap' },
  flex: { flex: 1, minWidth: 160 },
  note: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onCardMuted },
});

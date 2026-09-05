import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate } from 'react-router-dom';

import { ActionButton, AppNavShell, EmptyState, ErrorState, Icon, LoadingState, Modal, storybookTheme } from '@/shared/ui';
import { messageForError } from '@/shared/api';
import { dashboardNavItems, useAuth } from '@/entities/auth';
import { AGE_BAND_LABELS, findChildAvatar, useChildren, type Child } from '@/entities/child';
import { AddChildModal } from '@/features/child-selector';

/**
 * IA "[4] 마이페이지 > 아이 관리" 전용 화면. 아이 목록/추가/편집/삭제 네 액션이 모두 여기에
 * 모인다. 모든 CRUD는 ChildrenProvider의 훅을 통과하므로 성공 즉시 이 화면(과 홈의 아이
 * 선택기)이 동시에 리렌더된다.
 *
 * 편집/추가는 AddChildModal(editing 프롭 지원)을 재사용하고, 삭제만 여기 안의 확인 모달을
 * 쓴다 - "선택되어 있던 아이를 지우면 첫 아이가 자동 선택"되는 것도 ChildrenProvider 안에서
 * 이미 처리된다.
 */
export function MyPageChildrenPage() {
  const navigate = useNavigate();
  const { state } = useAuth();
  const { children, load, removeChild, reload } = useChildren();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Child | null>(null);
  const [deleting, setDeleting] = useState<Child | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletingInFlight, setDeletingInFlight] = useState(false);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'PARENT') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  if (state.status !== 'authenticated') return null;

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    setDeletingInFlight(true);
    try {
      await removeChild(deleting.id);
      setDeleting(null);
    } catch (error: unknown) {
      setDeleteError(messageForError(error, '아이 프로필을 삭제하지 못했어요.'));
    } finally {
      setDeletingInFlight(false);
    }
  }

  return (
    <AppNavShell items={dashboardNavItems(state.user, navigate, 'mypage')} onBack={() => navigate('/mypage')}>
      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.title} accessibilityRole="header">아이 관리</Text>
          <ActionButton label="아이 추가" onPress={() => setAddOpen(true)} />
        </View>

        {load.status === 'loading' ? (
          <LoadingState label="아이 프로필을 불러오는 중이에요…" />
        ) : load.status === 'error' ? (
          <ErrorState message={load.message} onRetry={() => { void reload(); }} />
        ) : children.length === 0 ? (
          <EmptyState
            title="등록된 아이가 없어요"
            body="“아이 추가” 버튼으로 첫 아이 프로필을 만들어 보세요."
            cta={{ label: '아이 추가', onPress: () => setAddOpen(true) }}
          />
        ) : (
          <View style={styles.list}>
            {children.map((child) => (
              <ChildRow
                key={child.id}
                child={child}
                onEdit={() => setEditing(child)}
                onDelete={() => {
                  setDeleteError(null);
                  setDeleting(child);
                }}
              />
            ))}
          </View>
        )}
      </View>

      <AddChildModal visible={addOpen} onClose={() => setAddOpen(false)} />
      <AddChildModal visible={editing !== null} onClose={() => setEditing(null)} editing={editing} />

      <Modal
        visible={deleting !== null}
        accessibilityLabel="아이 프로필 삭제 확인"
        title={deleting ? `${deleting.name} 프로필을 삭제할까요?` : '아이 프로필 삭제'}
        positiveAction={{
          label: deletingInFlight ? '삭제 중…' : '삭제',
          onPress: confirmDelete,
          disabled: deletingInFlight,
          loading: deletingInFlight,
        }}
        negativeAction={{
          label: '취소',
          onPress: () => setDeleting(null),
          disabled: deletingInFlight,
        }}
      >
        <Text style={styles.deleteBody}>
          이 아이의 프로필과 홈 큐레이션 기록이 함께 정리돼요. 되돌릴 수 없어요.
        </Text>
        {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
      </Modal>
    </AppNavShell>
  );
}

/* -------------------------------------------------------------- row */

function ChildRow({
  child,
  onEdit,
  onDelete,
}: {
  child: Child;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const preset = findChildAvatar(child.avatarKey);
  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: `${preset.accent}33` }]}>
        <Text style={styles.avatarEmoji}>{preset.emoji}</Text>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>{child.name}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>{AGE_BAND_LABELS[child.ageBand]}</Text>
      </View>
      <View style={styles.rowActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${child.name} 편집`}
          onPress={onEdit}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Icon name="pencil" size={16} color={storybookTheme.color.onCardTitle} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${child.name} 삭제`}
          onPress={onDelete}
          style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
        >
          <Icon name="close" size={16} color={storybookTheme.color.error} />
        </Pressable>
      </View>
    </View>
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
    gap: storybookTheme.spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: storybookTheme.spacing.ms,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: storybookTheme.type.xl,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onContent,
  },
  list: { gap: storybookTheme.spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: storybookTheme.spacing.ms,
    padding: storybookTheme.spacing.md,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceCard,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: storybookTheme.type.xl },
  rowBody: { flex: 1, gap: 2 },
  rowName: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onCardTitle,
  },
  rowMeta: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onCardMuted,
  },
  rowActions: { flexDirection: 'row', gap: storybookTheme.spacing.xs },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: storybookTheme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: storybookTheme.color.pillBorder,
  },
  pressed: { opacity: 0.7 },
  deleteBody: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardBody,
    textAlign: 'center',
  },
  errorText: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.error,
    textAlign: 'center',
  },
});

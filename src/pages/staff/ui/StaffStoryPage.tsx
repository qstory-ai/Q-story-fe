import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import {
  editScene,
  listRevisions,
  listScenes,
  listStaleNarration,
  rerenderNarration,
  revertRevision,
  StoryAdminApiError,
  type RevisionView,
  type SceneView,
  type StaleLine,
} from '@/entities/story-admin';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; revision: number; scenes: SceneView[]; stale: StaleLine[]; revisions: RevisionView[] }
  | { status: 'error'; message: string };

function formatDate(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  );
}

/** STAFF의 이야기별 저작 화면 - 하나의 이야기에 국한된 장면, 오래된(대본과 어긋난) 내레이션, 편집 기록을 모두 다룬다. */
export function StaffStoryPage() {
  const { storyId } = useParams<{ storyId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSequence, setEditSequence] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'STAFF') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const reload = useCallback(() => {
    if (state.status !== 'authenticated' || state.user.role !== 'STAFF' || !storyId) return;
    Promise.all([
      listScenes(state.token, storyId),
      listStaleNarration(state.token, storyId),
      listRevisions(state.token, storyId),
    ])
      .then(([scenesResponse, stale, revisions]) =>
        setLoad({ status: 'ready', revision: scenesResponse.revision, scenes: scenesResponse.scenes, stale, revisions }),
      )
      .catch((failure: unknown) =>
        setLoad({ status: 'error', message: failure instanceof StoryAdminApiError ? failure.message : '이야기를 불러오지 못했어요.' }),
      );
  }, [state, storyId]);

  useEffect(reload, [reload]);

  const startEditScene = useCallback((scene: SceneView) => {
    setActionError(null);
    setEditingSceneId(scene.id);
    setEditTitle(scene.title);
    setEditSequence(String(scene.sequence));
  }, []);

  const saveSceneEdit = useCallback(async () => {
    if (state.status !== 'authenticated' || !storyId || !editingSceneId || load.status !== 'ready') return;
    setActionError(null);
    try {
      await editScene(state.token, storyId, editingSceneId, {
        baseRevision: load.revision,
        title: editTitle.trim(),
        sequence: Number(editSequence),
      });
      setEditingSceneId(null);
      reload();
    } catch (failure) {
      setActionError(
        failure instanceof StoryAdminApiError
          ? failure.message
          : '장면을 수정하지 못했어요.',
      );
    }
  }, [state, storyId, editingSceneId, editTitle, editSequence, load, reload]);

  const onRerender = useCallback(
    async (segmentId: string) => {
      if (state.status !== 'authenticated' || !storyId) return;
      setActionError(null);
      try {
        await rerenderNarration(state.token, storyId, segmentId);
        reload();
      } catch (failure) {
        setActionError(failure instanceof StoryAdminApiError ? failure.message : '재녹음하지 못했어요.');
      }
    },
    [state, storyId, reload],
  );

  const onRevert = useCallback(
    async (revision: number) => {
      if (state.status !== 'authenticated' || !storyId || load.status !== 'ready') return;
      setActionError(null);
      try {
        await revertRevision(state.token, storyId, { baseRevision: load.revision, revision });
        reload();
      } catch (failure) {
        setActionError(failure instanceof StoryAdminApiError ? failure.message : '되돌리지 못했어요.');
      }
    },
    [state, storyId, load, reload],
  );

  if (state.status !== 'authenticated' || state.user.role !== 'STAFF' || !storyId) return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Pressable onPress={() => navigate('/staff')} accessibilityRole="link" hitSlop={8} style={styles.backLink}>
        <Text style={styles.backLinkText}>← 이야기 목록으로</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">{storyId}</Text>

        {load.status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        )}
        {load.status === 'error' && <Text style={styles.error}>{load.message}</Text>}
        {actionError && <Text style={styles.error}>{actionError}</Text>}

        {load.status === 'ready' && (
          <>
            <Text style={styles.sectionLabel}>장면 ({load.scenes.length})</Text>
            {load.scenes.map((scene) => (
              <View key={scene.id} style={styles.card}>
                {editingSceneId === scene.id ? (
                  <>
                    <TextField label="제목" value={editTitle} onChangeText={setEditTitle} />
                    <TextField label="순서" value={editSequence} onChangeText={setEditSequence} keyboardType="number-pad" />
                    <View style={styles.rowActions}>
                      <ActionButton label="저장" onPress={saveSceneEdit} />
                      <ActionButton variant="secondary" label="취소" onPress={() => setEditingSceneId(null)} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardTitle}>
                      {scene.sequence + 1}. {scene.title}
                    </Text>
                    <Text style={styles.cardMeta}>{scene.id}</Text>
                    <View style={styles.rowActions}>
                      <Pressable onPress={() => navigate(`/staff/${storyId}/scenes/${scene.id}`)} style={styles.linkTarget}>
                        <Text style={styles.link}>문장 보기 →</Text>
                      </Pressable>
                      <Pressable onPress={() => startEditScene(scene)} style={styles.linkTarget}>
                        <Text style={styles.link}>장면 정보 수정</Text>
                      </Pressable>
                    </View>
                  </>
                )}
              </View>
            ))}

            <Text style={styles.sectionLabel}>오래된 녹음 ({load.stale.length})</Text>
            {load.stale.length === 0 ? (
              <Text style={styles.body}>대본과 어긋난 녹음이 없어요.</Text>
            ) : (
              load.stale.map((line) => (
                <View key={line.segmentId} style={styles.card}>
                  <Text style={styles.cardMeta}>{line.sceneId}</Text>
                  <Text style={styles.staleWritten}>대본: {line.written}</Text>
                  <Text style={styles.staleSpoken}>녹음: {line.spoken ?? '(없음)'}</Text>
                  <ActionButton variant="secondary" label="다시 녹음하기" onPress={() => onRerender(line.segmentId)} />
                </View>
              ))
            )}

            <Text style={styles.sectionLabel}>편집 기록 ({load.revisions.length})</Text>
            {load.revisions.map((revision) => (
              <View key={revision.revision} style={styles.card}>
                <Text style={styles.cardMeta}>
                  #{revision.revision} · {revision.targetType} {revision.operation} · {formatDate(revision.createdAt)}
                </Text>
                {revision.summary && <Text style={styles.body}>{revision.summary}</Text>}
                {revision.before && (
                  <Pressable onPress={() => onRevert(revision.revision)} style={styles.linkTarget}>
                    <Text style={styles.link}>이 변경 되돌리기</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: storybookTheme.color.shellBackground,
  },
  backLink: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backLinkText: {
    color: storybookTheme.color.onLightMuted,
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
  },
  content: {
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: storybookTheme.type.lg,
    fontWeight: '700',
    color: storybookTheme.color.onLightHeading,
  },
  sectionLabel: {
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
    color: storybookTheme.color.onLightHeading,
    marginTop: 8,
  },
  body: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onLightBody,
  },
  error: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.error,
  },
  centered: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.surfaceWhite,
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  cardTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: '600',
    color: storybookTheme.color.onCardTitle,
  },
  cardMeta: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onLightMuted,
  },
  staleWritten: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardTitle,
  },
  staleSpoken: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.status.warning.text,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  linkTarget: {
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: storybookTheme.color.linkOnLight,
  },
});

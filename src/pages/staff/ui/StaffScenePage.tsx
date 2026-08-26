import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigate, useParams } from 'react-router-dom';

import { ActionButton, SafeAreaView, TextField, storybookTheme } from '@/shared/ui';
import { useAuth } from '@/entities/auth';
import { editSegment, listSegments, StoryAdminApiError, type SegmentView } from '@/entities/story-admin';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; revision: number; segments: SegmentView[] }
  | { status: 'error'; message: string };

function payloadText(segment: SegmentView): string {
  const value = segment.payload.text;
  return typeof value === 'string' ? value : '';
}

/** STAFF의 장면별 세그먼트 편집기 - utterance(대사) 줄은 편집 가능하고(내레이션 클립이 맞춰야 할 대본 텍스트), 그 외 종류는 모두 읽기 전용으로 표시한다. */
export function StaffScenePage() {
  const { storyId, sceneId } = useParams<{ storyId: string; sceneId: string }>();
  const navigate = useNavigate();
  const { state } = useAuth();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === 'loading') return;
    if (state.status !== 'authenticated' || state.user.role !== 'STAFF') {
      navigate('/', { replace: true });
    }
  }, [state, navigate]);

  const reload = useCallback(() => {
    if (state.status !== 'authenticated' || state.user.role !== 'STAFF' || !storyId || !sceneId) return;
    listSegments(state.token, storyId, sceneId)
      .then((response) => setLoad({ status: 'ready', revision: response.revision, segments: response.segments }))
      .catch((failure: unknown) =>
        setLoad({ status: 'error', message: failure instanceof StoryAdminApiError ? failure.message : '문장을 불러오지 못했어요.' }),
      );
  }, [state, storyId, sceneId]);

  useEffect(reload, [reload]);

  const startEdit = useCallback((segment: SegmentView) => {
    setActionError(null);
    setEditingSegmentId(segment.id);
    setDraftText(payloadText(segment));
  }, []);

  const saveEdit = useCallback(
    async (segment: SegmentView) => {
      if (state.status !== 'authenticated' || !storyId || load.status !== 'ready') return;
      setSaving(true);
      setActionError(null);
      try {
        await editSegment(state.token, storyId, segment.id, {
          baseRevision: load.revision,
          payload: { ...segment.payload, text: draftText },
        });
        setEditingSegmentId(null);
        reload();
      } catch (failure) {
        setActionError(
          failure instanceof StoryAdminApiError
            ? failure.code === 'STALE_REVISION'
              ? '다른 편집이 먼저 반영됐어요. 새로고침한 뒤 다시 시도해 주세요.'
              : failure.message
            : '문장을 저장하지 못했어요.',
        );
      } finally {
        setSaving(false);
      }
    },
    [state, storyId, load, draftText, reload],
  );

  if (state.status !== 'authenticated' || state.user.role !== 'STAFF' || !storyId || !sceneId) return null;

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <Pressable onPress={() => navigate(`/staff/${storyId}`)} accessibilityRole="link" hitSlop={8} style={styles.backLink}>
        <Text style={styles.backLinkText}>← {storyId}로</Text>
      </Pressable>

      <View style={styles.content}>
        <Text style={styles.title} accessibilityRole="header">{sceneId}</Text>

        {load.status === 'loading' && (
          <View style={styles.centered}>
            <ActivityIndicator />
          </View>
        )}
        {load.status === 'error' && <Text style={styles.error}>{load.message}</Text>}
        {actionError && <Text style={styles.error}>{actionError}</Text>}

        {load.status === 'ready' &&
          load.segments.map((segment) => (
            <View
              key={segment.id}
              style={[styles.card, segment.narrationStale && styles.cardStale]}
            >
              <Text style={styles.cardMeta}>
                {segment.displayOrder}. {segment.kind}
                {segment.branchPoint ? ' · 분기점' : ''}
                {segment.narrationStale ? ' · 녹음과 대본이 달라요' : ''}
              </Text>

              {segment.kind === 'utterance' ? (
                editingSegmentId === segment.id ? (
                  <>
                    <TextField
                      label="문장"
                      value={draftText}
                      onChangeText={setDraftText}
                      multiline
                      numberOfLines={3}
                    />
                    <View style={styles.rowActions}>
                      <ActionButton label={saving ? '저장 중…' : '저장'} onPress={() => saveEdit(segment)} disabled={saving} />
                      <ActionButton variant="secondary" label="취소" onPress={() => setEditingSegmentId(null)} />
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.utteranceText}>{payloadText(segment)}</Text>
                    <Pressable onPress={() => startEdit(segment)} style={styles.linkTarget}>
                      <Text style={styles.link}>수정</Text>
                    </Pressable>
                  </>
                )
              ) : (
                <Text style={styles.payloadDump}>{JSON.stringify(segment.payload)}</Text>
              )}
            </View>
          ))}
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
  centered: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  error: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.error,
  },
  card: {
    gap: 6,
    padding: 14,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: storybookTheme.color.lightCardBorder,
  },
  cardStale: {
    borderColor: storybookTheme.status.warning.border,
    backgroundColor: storybookTheme.status.warning.background,
  },
  cardMeta: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onLightMuted,
  },
  utteranceText: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.onCardTitle,
  },
  payloadDump: {
    fontSize: storybookTheme.type.xxs,
    color: storybookTheme.color.onLightMuted,
  },
  rowActions: {
    flexDirection: 'row',
    gap: 8,
  },
  linkTarget: {
    minHeight: 32,
    justifyContent: 'center',
  },
  link: {
    fontSize: storybookTheme.type.sm,
    fontWeight: '500',
    color: storybookTheme.color.linkOnLight,
  },
});

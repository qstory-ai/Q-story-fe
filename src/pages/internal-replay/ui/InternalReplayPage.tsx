import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  SessionRecordingApiError,
  decodeEvents,
  findRecordedSessions,
  listRecordedChunks,
  type RecordedSession,
} from '@/entities/analytics';
import { useAuth } from '@/entities/auth';
import { ActionButton, LoadingState, TextField, storybookTheme } from '@/shared/ui';

import { splitReplaySegments, type ReplaySegment } from '../model/replay-segments';
import { ReplayPlayer } from './replay-player';

const FORBIDDEN_COPY = '팀 계정으로 로그인해 주세요';
const CODE_PATTERN = /^[0-9A-F]{6}$/;

type Status = { kind: 'idle' } | { kind: 'loading'; label: string } | { kind: 'error'; message: string };

function failureMessage(failure: unknown, fallback: string) {
  if (failure instanceof SessionRecordingApiError && (failure.status === 401 || failure.status === 403)) {
    return FORBIDDEN_COPY;
  }
  return fallback;
}

function formatTime(value: string | number) {
  return new Date(value).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'medium' });
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

/**
 * 팀 내부 화면 녹화 다시 보기(/internal/replay) - 메뉴에 걸지 않는다. 관찰자가 적은 6자리 코드(회차 코드·통계 세션 코드)로
 * 녹화를 찾아 rrweb 플레이어로 본다. 서버가 STAFF만 허용한다.
 */
export function InternalReplayPage() {
  const { state } = useAuth();
  // 서버도 STAFF만 허용한다(401·403) - 화면에서도 미리 막아 요청을 보내지 않는다.
  const token = state.status === 'authenticated' && state.user.role === 'STAFF' ? state.token : null;
  const [code, setCode] = useState('');
  const [sessions, setSessions] = useState<RecordedSession[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [segments, setSegments] = useState<ReplaySegment[]>([]);
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const normalizedCode = code.trim().toUpperCase();
  const codeValid = CODE_PATTERN.test(normalizedCode);

  const search = useCallback(async () => {
    if (!token) {
      setStatus({ kind: 'error', message: FORBIDDEN_COPY });
      return;
    }
    setStatus({ kind: 'loading', label: '녹화를 찾고 있어요.' });
    setSessions(null);
    setSelected(null);
    setSegments([]);
    try {
      setSessions(await findRecordedSessions(token, normalizedCode));
      setStatus({ kind: 'idle' });
    } catch (failure) {
      setStatus({ kind: 'error', message: failureMessage(failure, '녹화를 찾지 못했어요. 잠시 뒤 다시 시도해 주세요.') });
    }
  }, [normalizedCode, token]);

  const open = useCallback(
    async (betaSessionId: string) => {
      if (!token) return;
      setSelected(betaSessionId);
      setSegments([]);
      setSegmentIndex(0);
      setStatus({ kind: 'loading', label: '녹화 조각을 받아 풀고 있어요.' });
      try {
        const { chunks } = await listRecordedChunks(token, betaSessionId);
        const decoded: unknown[] = [];
        for (const chunk of chunks) {
          try {
            decoded.push(...(await decodeEvents(chunk.encoding, chunk.data)));
          } catch {
            // 풀지 못한 조각은 건너뛴다 - 나머지로 재생한다.
          }
        }
        const found = splitReplaySegments(decoded);
        setSegments(found);
        setStatus(found.length > 0 ? { kind: 'idle' } : { kind: 'error', message: '재생할 수 있는 화면 기록이 없어요.' });
      } catch (failure) {
        setStatus({ kind: 'error', message: failureMessage(failure, '녹화 조각을 받아 오지 못했어요.') });
      }
    },
    [token],
  );

  const segment = segments[segmentIndex] ?? null;
  const segmentEvents = useMemo(() => segment?.events ?? [], [segment]);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>팀 내부</Text>
        <Text style={styles.title} accessibilityRole="header">화면 녹화 다시 보기</Text>
        <Text style={styles.body}>회차 코드나 통계 세션 코드(6자리)를 넣어 주세요.</Text>
        <TextField
          label="코드"
          value={code}
          onChangeText={(value) => setCode(value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6))}
          placeholder="예: 3FA2C1"
          autoCapitalize="characters"
          onSubmitEditing={() => {
            if (codeValid) void search();
          }}
        />
        <ActionButton label="찾기" variant="primary" size="md" disabled={!codeValid || !token} onPress={() => void search()} />
      </View>

      {state.status !== 'loading' && !token && <Text style={styles.error}>{FORBIDDEN_COPY}</Text>}
      {status.kind === 'loading' && <LoadingState label={status.label} compact />}
      {status.kind === 'error' && <Text style={styles.error}>{status.message}</Text>}

      {sessions && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>찾은 녹화 {sessions.length}개</Text>
          {sessions.length === 0 && <Text style={styles.body}>이 코드로 남은 녹화가 없어요.</Text>}
          {sessions.map((session) => (
            <Pressable
              key={session.betaSessionId}
              accessibilityRole="button"
              onPress={() => void open(session.betaSessionId)}
              style={({ pressed }) => [
                styles.row,
                selected === session.betaSessionId && styles.rowSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.rowTitle}>
                {session.betaSessionCode} · {formatTime(session.startedAt)} ~ {formatTime(session.endedAt)}
              </Text>
              <Text style={styles.rowMeta}>
                조각 {session.chunkCount}개 · {(session.totalBytes / 1024 / 1024).toFixed(1)}MB · 회차{' '}
                {session.playSessionIds.length}개{session.userId ? ' · 로그인 사용자' : ' · 로그인 전'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {segments.length > 0 && (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>구간</Text>
          <View style={styles.segmentRow}>
            {segments.map((item, index) => (
              <Pressable
                key={item.startedAt}
                accessibilityRole="button"
                onPress={() => setSegmentIndex(index)}
                style={[styles.segment, index === segmentIndex && styles.segmentSelected]}
              >
                <Text style={styles.segmentText}>
                  {index + 1}. {formatTime(item.startedAt)} ({formatDuration(item.endedAt - item.startedAt)})
                </Text>
              </Pressable>
            ))}
          </View>
          {segment && <ReplayPlayer key={segment.startedAt} events={segmentEvents} />}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: storybookTheme.color.background },
  content: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    gap: 16,
    paddingHorizontal: storybookTheme.spacing.ml,
    paddingVertical: storybookTheme.spacing.lg,
  },
  panel: {
    width: '100%',
    gap: 10,
    backgroundColor: storybookTheme.color.contentPanel,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    padding: 20,
  },
  eyebrow: { fontSize: storybookTheme.type.xs, fontWeight: '700', color: storybookTheme.color.error, letterSpacing: 0.4 },
  title: { fontSize: storybookTheme.type.lg, fontWeight: '900', color: storybookTheme.color.onContent },
  body: { fontSize: storybookTheme.type.sm, lineHeight: 21, color: storybookTheme.color.onContentMuted },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error, textAlign: 'center' },
  panelTitle: { fontSize: storybookTheme.type.md, fontWeight: '900', color: storybookTheme.color.onContent },
  row: { gap: 2, paddingVertical: 10, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: storybookTheme.color.contentPanelBorder },
  rowSelected: { backgroundColor: storybookTheme.color.contentSurface },
  pressed: { opacity: 0.85 },
  rowTitle: { fontSize: storybookTheme.type.sm, fontWeight: '700', color: storybookTheme.color.onContent },
  rowMeta: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContentMuted },
  segmentRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segment: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: storybookTheme.radius.pill,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  segmentSelected: { borderColor: storybookTheme.color.primary },
  segmentText: { fontSize: storybookTheme.type.xs, color: storybookTheme.color.onContent },
});

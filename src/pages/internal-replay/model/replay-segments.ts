/**
 * 받아 온 녹화 이벤트를 다시 보기 구간으로 나눈다. 한 통계 세션에는 며칠에 걸친 여러 방문이 섞여 있어,
 * 5분 넘게 비는 곳에서 끊어 구간마다 따로 재생한다(빈 시간을 건너뛰고, 구간마다 첫 화면 스냅숏부터).
 */
export type ReplayEvent = { type: number; timestamp: number };

export type ReplaySegment = { startedAt: number; endedAt: number; events: ReplayEvent[] };

export const SEGMENT_GAP_MS = 5 * 60_000;

/** rrweb 이벤트 종류 - 4 Meta, 2 FullSnapshot. 재생은 이 둘로 시작해야 화면이 그려진다. */
const META = 4;
const FULL_SNAPSHOT = 2;

function isReplayEvent(value: unknown): value is ReplayEvent {
  const event = value as ReplayEvent | null;
  return Boolean(event) && typeof event!.type === 'number' && typeof event!.timestamp === 'number';
}

export function splitReplaySegments(events: readonly unknown[], gapMs = SEGMENT_GAP_MS): ReplaySegment[] {
  const sorted = events.filter(isReplayEvent).sort((left, right) => left.timestamp - right.timestamp);
  const segments: ReplaySegment[] = [];
  let current: ReplayEvent[] = [];
  for (const event of sorted) {
    const previous = current[current.length - 1];
    if (previous && event.timestamp - previous.timestamp > gapMs) {
      segments.push(toSegment(current));
      current = [];
    }
    current.push(event);
  }
  if (current.length > 0) segments.push(toSegment(current));
  // 첫 화면 스냅숏이 없는 구간(앞 조각을 잃은 경우)은 그릴 수 없다 - 뺀다.
  return segments.filter(
    (segment) =>
      segment.events.length >= 2 &&
      segment.events.some((event) => event.type === META) &&
      segment.events.some((event) => event.type === FULL_SNAPSHOT),
  );
}

function toSegment(events: ReplayEvent[]): ReplaySegment {
  // 스냅숏 앞에 놓인 이벤트(앞 조각의 끝부분)는 그릴 수 없으므로 첫 Meta부터 시작한다.
  const firstMeta = events.findIndex((event) => event.type === META);
  const playable = firstMeta > 0 ? events.slice(firstMeta) : events;
  return { startedAt: playable[0].timestamp, endedAt: playable[playable.length - 1].timestamp, events: playable };
}

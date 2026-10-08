import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { storybookTheme } from '@/shared/ui';

import type { ReplayEvent } from '../model/replay-segments';

type PlayerInstance = { $destroy?: () => void; pause?: () => void };

/**
 * rrweb-player를 이 화면에서만 불러와 그린다(CSS 포함) - 다른 화면 번들에는 들어가지 않는다.
 * react-native-web의 View는 DOM div로 그려지므로 그 노드에 플레이어를 붙인다.
 */
export function ReplayPlayer({ events }: { events: ReplayEvent[] }) {
  // react-native-web View ref 타입은 번거롭고 곧바로 HTMLElement로 쓰므로 any로 둔다(social-login-buttons와 같다).
  const hostRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current as HTMLElement | null;
    if (!host) return;
    let player: PlayerInstance | null = null;
    let cancelled = false;
    Promise.all([import('rrweb-player'), import('rrweb-player/dist/style.css')])
      .then(([module]) => {
        if (cancelled) return;
        host.innerHTML = '';
        const width = Math.min(1024, Math.max(320, host.clientWidth || 800));
        player = new module.default({
          target: host,
          props: {
            events: events as never,
            width,
            height: Math.round(width * 0.62),
            autoPlay: false,
            skipInactive: true,
            showController: true,
            speedOption: [1, 2, 4, 8],
          },
        }) as unknown as PlayerInstance;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      try {
        player?.pause?.();
        player?.$destroy?.();
      } catch {
        // 플레이어 정리 실패는 무시한다.
      }
      host.innerHTML = '';
    };
  }, [events]);

  return (
    <View style={styles.wrap}>
      {failed && <Text style={styles.error}>플레이어를 불러오지 못했어요.</Text>}
      <View ref={hostRef} style={styles.host} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 8 },
  host: { width: '100%', minHeight: 320 },
  error: { fontSize: storybookTheme.type.sm, color: storybookTheme.color.error },
});

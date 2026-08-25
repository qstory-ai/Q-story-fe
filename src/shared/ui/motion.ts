import { useEffect, useState } from 'react';

import { storybookTheme } from './theme';

/** Solid 2.0의 easeOutSine/easeInSine과 동일한 CSS cubic-bezier 값 (easings.net 표준값). */
export const EASE_OUT_SINE = 'cubic-bezier(0.61, 1, 0.88, 1)';
export const EASE_IN_SINE = 'cubic-bezier(0.12, 0, 0.39, 0)';

/**
 * 오버레이(모달 등)의 mount/unmount를 CSS transition과 맞춘다. Solid 2.0의 풀 팝업/바텀시트
 * 모션 규칙(진입 easeOutSine, 퇴장 easeInSine)을 그대로 따른다.
 *
 * react-native-web의 Animated API도, "렌더 중 상태 조정" 패턴(prevVisible을 저장해두고
 * 렌더 중 비교)도 둘 다 시도했지만, 둘 다 이 컴포넌트 트리에서 React 19 StrictMode의 이중
 * 렌더/이중 effect 실행과 맞물려 mounted/entered가 엉뚱한 세대에서 되돌아가는 문제가 실제로
 * 관찰됐다. 그래서 가장 단순하고 널리 쓰이는 표준 패턴(effect 안에서 mount -> 다음 프레임에
 * entered -> 언마운트는 setTimeout)으로 되돌아왔다 - eslint-plugin-react-hooks의
 * set-state-in-effect 규칙이 여기서 경고하지만, "다음 틱에 실행돼야 CSS transition이
 * 재생된다"는 게 정확히 이 규칙이 허용하는 "외부 시스템(브라우저의 transition 엔진)과의
 * 동기화" 케이스라 의도적으로 무시한다.
 */
export function usePresenceAnimation(
  visible: boolean,
  durationMs: number = storybookTheme.motion.durationMs.moderate,
) {
  const [mounted, setMounted] = useState(visible);
  const [entered, setEntered] = useState(false);

  // 아래 setMounted/setEntered 호출들은 브라우저의 CSS transition 엔진과 동기화하기 위한
  // 것이다(mount 직후 "시작 상태"를 한 프레임 그린 뒤에 entered를 올려야 실제로 보간되고,
  // 퇴장 시엔 entered를 즉시 꺼야 transition이 시작된다) - eslint-plugin-react-hooks의
  // set-state-in-effect 규칙이 경고하는 "외부 시스템과 동기화" 용도에 정확히 해당해서
  // 의도적으로 무시한다.
  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMounted(true);
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }

    setEntered(false);
    const unmountTimer = setTimeout(() => setMounted(false), durationMs);
    return () => clearTimeout(unmountTimer);
  }, [visible, durationMs]);

  return { mounted, entered, durationMs };
}

import { View, type ViewProps } from 'react-native';

type Edge = 'top' | 'right' | 'bottom' | 'left';

type SafeAreaViewProps = ViewProps & {
  edges?: readonly Edge[];
};

const SAFE_AREA_PADDING: Record<Edge, string> = {
  top: 'paddingTop',
  right: 'paddingRight',
  bottom: 'paddingBottom',
  left: 'paddingLeft',
};

const SAFE_AREA_ENV_VAR: Record<Edge, string> = {
  top: 'env(safe-area-inset-top)',
  right: 'env(safe-area-inset-right)',
  bottom: 'env(safe-area-inset-bottom)',
  left: 'env(safe-area-inset-left)',
};

const DEFAULT_EDGES: readonly Edge[] = ['top', 'right', 'bottom', 'left'];

/**
 * `react-native-safe-area-context`는 실제 React Native / Expo 런타임에만
 * 존재하는 네이티브 inset API를 읽는다. 웹에서는(그리고 Capacitor WebView
 * 내부에서도) 이에 대응하는 것이 브라우저가 이미 노출하는 CSS
 * `env(safe-area-inset-*)` 변수이며, 이 컴포넌트는 그것을 대신 읽는다.
 */
export function SafeAreaView({
  edges = DEFAULT_EDGES,
  style,
  ...rest
}: SafeAreaViewProps) {
  const insetStyle = Object.fromEntries(
    edges.map((edge) => [SAFE_AREA_PADDING[edge], SAFE_AREA_ENV_VAR[edge]]),
  );

  return <View {...rest} style={[insetStyle, style] as ViewProps['style']} />;
}

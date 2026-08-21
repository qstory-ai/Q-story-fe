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
 * `react-native-safe-area-context` reads native inset APIs that only exist
 * in a real React Native / Expo runtime. On web (and inside a Capacitor
 * WebView) the equivalent is the CSS `env(safe-area-inset-*)` variables the
 * browser already exposes, which is what this reads instead.
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

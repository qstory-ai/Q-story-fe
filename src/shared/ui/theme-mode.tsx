import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';
import { View } from 'react-native';
import type { ViewProps } from 'react-native';

import { semanticColors, type ColorMode, type SemanticColors } from './tokens';

const ThemeModeContext = createContext<ColorMode>('light');

/**
 * 색 모드 범위(Light 콘솔 / Dark 리더). 감싸는 View 하나에 `data-theme` 속성을 붙인다(react-native-web dataSet) -
 * design-tokens.css의 `[data-theme="dark"]`·`[data-theme="light"]` 블록이 **그 요소와 하위에만** 적용된다.
 * - 전역(<html>) 속성을 건드리지 않아 body 바탕·::selection·theme-color·포커스 링은 그대로다.
 * - 중첩은 DOM이 해결한다(가장 가까운 조상의 data-theme이 이긴다). 언마운트하면 요소와 함께 사라진다 - 효과(effect)가 없어
 *   StrictMode 이중 마운트·전환 중 공존에도 남는 상태가 없다.
 * - 포털(createPortal로 body에 붙는 Modal)은 이 범위 밖이라 밝은 모달 카드는 밝게 남는다.
 * RN 쪽은 `useSemanticColors()`가 같은 모드의 Semantic 색을 준다. `style`은 감싸는 View 스타일 - 기존 루트 View를 이것으로 바꿔 쓰면
 * 레이아웃 노드가 늘지 않는다.
 */
export function ThemeModeProvider({
  mode,
  style,
  children,
}: {
  mode: ColorMode;
  style?: ViewProps['style'];
  children: ReactNode;
}) {
  return (
    <ThemeModeContext.Provider value={mode}>
      <View style={style} dataSet={themeScopeDataSet(mode)}>
        {children}
      </View>
    </ThemeModeContext.Provider>
  );
}

/** data-theme 속성 값(react-native-web dataSet) - 테스트와 Provider가 같이 쓴다. */
export function themeScopeDataSet(mode: ColorMode): { theme: ColorMode } {
  return { theme: mode };
}

export function useColorMode(): ColorMode {
  return useContext(ThemeModeContext);
}

/** 지금 모드의 Semantic 색 - 모드에 따라 색이 바뀌어야 하는 컴포넌트에서 쓴다. */
export function useSemanticColors(): SemanticColors {
  return semanticColors[useContext(ThemeModeContext)];
}

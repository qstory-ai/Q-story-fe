import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import { semanticColors, type ColorMode, type SemanticColors } from './tokens';

const ThemeModeContext = createContext<ColorMode>('light');

/**
 * 색 모드(Light 콘솔 / Dark 리더)를 아래 트리에 알린다 - `useSemanticColors()`가 그 모드의 Semantic 색을 준다.
 * 웹 CSS의 [data-theme="dark"] 연결(DOM 속성)은 아직 하지 않는다: 리더 컴포넌트를 useSemanticColors로 옮기는 단계에서
 * StoryPlayerRoute(로딩·오류·Suspense fallback 포함) 위에 두고, useLayoutEffect + 중첩 참조 카운트로 붙인다.
 */
export function ThemeModeProvider({ mode, children }: { mode: ColorMode; children: ReactNode }) {
  return <ThemeModeContext.Provider value={mode}>{children}</ThemeModeContext.Provider>;
}

export function useColorMode(): ColorMode {
  return useContext(ThemeModeContext);
}

/** 지금 모드의 Semantic 색 - 모드에 따라 색이 바뀌어야 하는 컴포넌트에서 쓴다. */
export function useSemanticColors(): SemanticColors {
  return semanticColors[useContext(ThemeModeContext)];
}

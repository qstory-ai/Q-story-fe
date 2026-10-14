import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';

import { semanticColors, type ColorMode, type SemanticColors } from './tokens';

const ThemeModeContext = createContext<ColorMode>('light');

/**
 * 색 모드(Light 콘솔 / Dark 리더)를 아래 트리에 알린다.
 * - React Native 스타일: `useSemanticColors()`가 그 모드의 Semantic 색을 준다.
 * - 웹 CSS: 마운트된 동안 `<html data-theme="dark">`를 붙여 design-tokens.css의 [data-theme="dark"] 블록이 적용되게 하고,
 *   빠질 때 원래 값으로 되돌린다(겹쳐 쓰면 가장 안쪽 Provider 값).
 */
export function ThemeModeProvider({ mode, children }: { mode: ColorMode; children: ReactNode }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const previous = root.getAttribute('data-theme');
    if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    return () => {
      if (previous === null) root.removeAttribute('data-theme');
      else root.setAttribute('data-theme', previous);
    };
  }, [mode]);
  return <ThemeModeContext.Provider value={mode}>{children}</ThemeModeContext.Provider>;
}

export function useColorMode(): ColorMode {
  return useContext(ThemeModeContext);
}

/** 지금 모드의 Semantic 색 - 모드에 따라 색이 바뀌어야 하는 컴포넌트에서 쓴다. */
export function useSemanticColors(): SemanticColors {
  return semanticColors[useContext(ThemeModeContext)];
}

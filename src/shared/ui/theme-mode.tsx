import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useLayoutEffect } from 'react';

import { semanticColors, type ColorMode, type SemanticColors } from './tokens';

const ThemeModeContext = createContext<ColorMode>('light');

// SSR·테스트(문서 없음)에서는 useEffect로 - 경고 없이 아무것도 하지 않는다.
const useIsoLayoutEffect = typeof document === 'undefined' ? useEffect : useLayoutEffect;

/**
 * 문서 루트(<html data-theme>)에 붙은 모드 스택. Provider가 겹치거나(리더 안 모달 등) 화면 전환 중 두 Provider가 잠깐
 * 함께 살아 있어도, 가장 나중에 마운트된 것이 이기고 모두 빠지면 속성을 지운다(라이트 = 속성 없음).
 */
const modeStack: Array<{ id: number; mode: ColorMode }> = [];
let nextId = 0;

function applyTop() {
  const top = modeStack[modeStack.length - 1];
  const root = document.documentElement;
  if (top && top.mode === 'dark') root.setAttribute('data-theme', 'dark');
  else root.removeAttribute('data-theme');
}

/**
 * 색 모드(Light 콘솔 / Dark 리더)를 아래 트리에 알린다.
 * - React Native 스타일: `useSemanticColors()`가 그 모드의 Semantic 색을 준다.
 * - 웹 CSS: 마운트된 동안 `<html data-theme="dark">` - design-tokens.css의 [data-theme="dark"] 블록이 적용된다.
 *   useLayoutEffect라 첫 그림 전에 붙고, 빠지면(리더 이탈) 같은 프레임에 원복된다.
 */
export function ThemeModeProvider({ mode, children }: { mode: ColorMode; children: ReactNode }) {
  useIsoLayoutEffect(() => {
    if (typeof document === 'undefined') return;
    const entry = { id: nextId++, mode };
    modeStack.push(entry);
    applyTop();
    return () => {
      const index = modeStack.findIndex((item) => item.id === entry.id);
      if (index >= 0) modeStack.splice(index, 1);
      applyTop();
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

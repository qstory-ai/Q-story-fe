import { Text, TextInput } from 'react-native';

/**
 * react-native-web의 Text/TextInput은 `font: '14px System'`을 자체 기본 스타일로 하드코딩하고 있어서
 * (node_modules/react-native-web/dist/exports/Text/index.js 참고) global.css의
 * `body { font-family: var(--font-display) }`보다 우선 적용된다 - 그래서 Pretendard Variable이
 * 다운로드는 되었지만 실제로는 어디에도 렌더링되지 않았고, 모든 화면이 OS 시스템 폰트로
 * 대체(fallback)되고 있었다. 여기서 defaultProps.style을 오버라이드하는 것이 앱 안의 모든
 * StyleSheet를 건드리지 않고 이 문제를 고칠 수 있는 유일한 지점이다 (RN-web은 여전히
 * 클래스 컴포넌트의 static defaultProps를 존중한다).
 */
const FONT_FAMILY =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

type WithDefaultProps = { defaultProps?: { style?: unknown } };

function applyDefaultFontFamily(component: WithDefaultProps) {
  component.defaultProps = {
    ...component.defaultProps,
    style: [{ fontFamily: FONT_FAMILY }, component.defaultProps?.style],
  };
}

applyDefaultFontFamily(Text as unknown as WithDefaultProps);
applyDefaultFontFamily(TextInput as unknown as WithDefaultProps);

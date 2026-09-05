import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { storybookTheme } from './theme';

/**
 * 앱 전역에서 반복되는 카드 서피스 3종을 하나의 프리미티브로 통합한다.
 *  - `surface` (기본): 다크 배경 위의 크림색 카드 - 리포트/마이페이지/기관 페이지 등에서
 *    "본문 카드" 역할. surfaceCard 배경 + surfaceCardBorder 테두리 + low elevation.
 *  - `panel`: 다크 배경 위의 반투명 패널 - 홈/서재의 서브 섹션에서 씀. panelOnDarkBackground +
 *    panelOnDarkBorder. elevation 없음(다크 위 다크 그림자는 무의미).
 *  - `outlined`: 배경 없이 얇은 테두리만 - 강조도가 가장 낮은 그룹핑에 씀.
 *
 * padding은 spacing 토큰과 매핑해 ml(20) 기본을 쓴다 - 여러 페이지가 18/20/22 등 다른 값을
 * 하드코딩하고 있어서 살짝씩 어긋나 있었다.
 */
export type CardVariant = 'surface' | 'panel' | 'outlined';
export type CardPadding = 'sm' | 'md' | 'lg';

type Props = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  /** 카드 내부 헤더 - variant에 따라 색이 자동으로 바뀐다(surface=onCardTitle, panel=onDark).
   *  개별 화면이 각자 panelTitle/cardTitle 텍스트 스타일을 하드코딩하던 것을 통일한다. */
  title?: string;
  /** gap 없이 그리드/리스트 안에 카드 자체를 배치하고 싶을 때 상위에서 스타일 오버라이드. */
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, variant = 'surface', padding = 'md', title, style }: Props) {
  const paddingValue =
    padding === 'sm' ? storybookTheme.spacing.md
    : padding === 'lg' ? storybookTheme.spacing.lg
    : storybookTheme.spacing.ml;

  // 스타일 배열을 그대로 <View style={[...]}>에 넘기면 elevation.low의 shadow 필드와
  // react-native-web View 시그니처(transformOrigin 등 웹 확장) 사이에 미묘한 불일치가
  // 있어 typecheck가 실패한다. 이 좁힘은 StyleSheet.create가 이미 각 조각의 타입 안전성을
  // 검증한 뒤에만 발생하므로, 여기서만 any 캐스트로 통과시킨다 - 외부 Props.style은 원래
  // 타입 그대로다.
  const composed: any = [
    styles.base,
    { padding: paddingValue },
    variant === 'surface' && styles.surface,
    variant === 'panel' && styles.panel,
    variant === 'outlined' && styles.outlined,
    style,
  ];

  // 라이트 리테마: 모든 variant가 라이트 배경 위에 있으므로 어두운 텍스트로 통일.
  //  - surface(순백 카드) / panel(옅은 회색) / outlined 모두 onCardTitle(다크 네이비/보라) 사용.
  const titleColor = storybookTheme.color.onCardTitle;

  return (
    <View style={composed}>
      {title ? (
        <Text style={[styles.title, { color: titleColor }]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: storybookTheme.radius.card,
    width: '100%',
  },
  // 라이트 리테마: 순백 카드 + 아주 옅은 hairline border. 그림자는 elevation.low 그대로 (알파 낮음).
  surface: {
    backgroundColor: storybookTheme.color.contentSurface,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentSurfaceBorder,
    ...storybookTheme.elevation.low,
  },
  // panel = surface보다 살짝 눌린 sub-section. 흰 배경 위에서 아주 옅은 회색 톤.
  panel: {
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  outlined: {
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    marginBottom: storybookTheme.spacing.sm,
  },
});

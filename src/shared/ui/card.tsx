import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { storybookTheme } from './theme';
import { borderWidth, radius, semanticColors, shadow, space } from './tokens';

const L = semanticColors.light;

/**
 * 앱 전역에서 반복되는 카드 서피스 프리미티브.
 *  - `surface` (기본): 순백 카드 + hairline + low elevation - 리포트/마이페이지/기관 페이지 등의 본문 카드.
 *  - `panel`: surface보다 살짝 눌린 옅은 회색 sub-section. elevation 없음.
 *  - `tinted`: 랜딩 카드처럼 옅은 보라 바탕 + 보라 hairline. 안내·강조 묶음(카드 안 카드 금지는 그대로).
 *
 * elevation(0~5)은 surface에만 의미가 있다 - 기본 2(랜딩 카드 정도의 옅은 그림자).
 *
 * padding은 spacing 토큰과 매핑해 ml(20)을 기본으로 쓴다.
 */
export type CardVariant = 'surface' | 'panel' | 'tinted';
export type CardPadding = 'sm' | 'md' | 'lg';

type Props = {
  children: ReactNode;
  variant?: CardVariant;
  padding?: CardPadding;
  /** 카드 내부 헤더. */
  title?: string;
  /** gap 없이 그리드/리스트 안에 카드 자체를 배치하고 싶을 때 상위에서 스타일 오버라이드. */
  style?: StyleProp<ViewStyle>;
  elevation?: 0 | 1 | 2 | 3 | 4 | 5;
};

export function Card({ children, variant = 'surface', padding = 'md', title, style, elevation = 2 }: Props) {
  const paddingValue =
    padding === 'sm' ? space[16]
    : padding === 'lg' ? space[24]
    : space[24]; // Figma Spacing "Card Padding" 24

  // 스타일 배열을 그대로 <View style={[...]}>에 넘기면 elevation.low의 shadow 필드와
  // react-native-web View 시그니처(transformOrigin 등 웹 확장) 사이에 미묘한 불일치가
  // 있어 typecheck가 실패한다. 이 좁힘은 StyleSheet.create가 이미 각 조각의 타입 안전성을
  // 검증한 뒤에만 발생하므로, 여기서만 any 캐스트로 통과시킨다 - 외부 Props.style은 원래
  // 타입 그대로다.
  const composed: any = [
    styles.base,
    { padding: paddingValue },
    variant === 'surface' && styles.surface,
    variant === 'surface' && shadow(elevation),
    variant === 'panel' && styles.panel,
    variant === 'tinted' && styles.tinted,
    style,
  ];

  return (
    <View style={composed}>
      {title ? (
        // 페이지 제목(h1) 아래 섹션 제목이라 h2로 내린다 - 레벨이 없으면 RNW가 전부 h1로 그린다.
        <Text style={styles.title} accessibilityRole="header" {...({ 'aria-level': 2 } as object)}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius[16],
    width: '100%',
  },
  surface: {
    backgroundColor: L.bg.primary,
    borderWidth: borderWidth[1],
    borderColor: L.border.secondary,
  },
  panel: {
    backgroundColor: L.bg.secondary,
    borderWidth: borderWidth[1],
    borderColor: L.border.secondary,
  },
  tinted: {
    backgroundColor: L.bg.brandSubtle,
    borderWidth: borderWidth[1],
    borderColor: L.border.brandSubtle,
  },
  title: {
    color: L.text.primary,
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.black,
    marginBottom: space[8],
  },
});

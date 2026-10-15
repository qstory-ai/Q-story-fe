import type { ReactNode } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './action-button';
import { storybookTheme } from './theme';
import { borderWidth, iconSize, radius, semanticColors, space } from './tokens';

const L = semanticColors.light;
/** 큐돌이(Q 캐릭터 마크) - 빈 상태의 얼굴. 장식이라 스크린리더에서는 숨긴다. */
const MASCOT_URI = '/brand/qstory-mark.svg';

/**
 * 리스트/데이터 화면의 세 가지 상태(loading / empty / error)를 통일된 표현으로 렌더한다 -
 * 페이지가 각자 재발명하지 않도록 한다.
 */

const styles = StyleSheet.create({
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: storybookTheme.spacing.xl,
    gap: storybookTheme.spacing.sm,
  },
  loadingBoxCompact: {
    paddingVertical: storybookTheme.spacing.ms,
    gap: storybookTheme.spacing.xs,
  },
  loadingLabel: {
    fontSize: storybookTheme.type.sm,
    color: L.text.tertiary,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[40],
    paddingHorizontal: space[24],
    gap: space[8],
    borderRadius: radius[16],
    backgroundColor: L.bg.secondary,
    borderWidth: borderWidth[1],
    borderColor: L.border.secondary,
  },
  mascot: {
    width: iconSize['2x'] + space[8],
    height: (iconSize['2x'] + space[8]) * (294 / 270),
    marginBottom: space[4],
  },
  emptyTitle: {
    fontSize: storybookTheme.type.md,
    fontWeight: storybookTheme.type.weight.bold,
    color: L.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    color: L.text.tertiary,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: storybookTheme.spacing.sm,
    // ActionButton은 자체 minWidth가 없어 empty 카드 안에서 폭이 좁아지면 어색하다 -
    // 명시적 minWidth로 균형 있는 시각.
    minWidth: 160,
  },
  errorBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[32],
    paddingHorizontal: space[20],
    gap: space[8],
    borderRadius: radius[16],
    backgroundColor: L.bg.secondary,
    borderWidth: borderWidth[1],
    borderColor: L.border.secondary,
  },
  errorMessage: {
    fontSize: storybookTheme.type.sm,
    color: L.text.error,
    textAlign: 'center',
  },
  errorRetry: { marginTop: storybookTheme.spacing.sm, minWidth: 160 },
});

/* --------------------------------------------------------------- LoadingState */

type LoadingStateProps = {
  /** 스피너 아래 안내 문구. 없으면 spinner만. */
  label?: string;
  /** 컴팩트 변형 - 인라인 로딩(작은 카드 내부 등)에 씀. 기본은 넉넉한 세로 여백. */
  compact?: boolean;
};

export function LoadingState({ label = '불러오는 중이에요…', compact = false }: LoadingStateProps) {
  return (
    <View style={[styles.loadingBox, compact && styles.loadingBoxCompact]} accessibilityLiveRegion="polite">
      <ActivityIndicator color={L.icon.brand} />
      {label ? <Text style={styles.loadingLabel}>{label}</Text> : null}
    </View>
  );
}

/* --------------------------------------------------------------- EmptyState */

type EmptyStateProps = {
  /** 짧고 사실적인 안내 - "예정된 수업이 없어요" 같은 문구. */
  title: string;
  /** 선택적 부가 설명 한 줄. */
  body?: string;
  /** 사용자가 취할 수 있는 다음 액션이 있으면 CTA 붙임. 예: "새 수업 만들기". */
  cta?: { label: string; onPress: () => void };
  /** 커스텀 노드(아이콘, 이미지 등) 위쪽에 얹고 싶을 때. 주면 큐돌이 대신 들어간다. */
  slot?: ReactNode;
  /** 큐돌이를 숨긴다(작은 카드 안 인라인 빈 상태 등). */
  mascot?: boolean;
};

export function EmptyState({ title, body, cta, slot, mascot = true }: EmptyStateProps) {
  return (
    <View style={styles.emptyBox}>
      {slot ?? (mascot ? (
        <Image source={{ uri: MASCOT_URI }} style={styles.mascot} resizeMode="contain" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden />
      ) : null)}
      <Text style={styles.emptyTitle} accessibilityRole="header">{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
      {cta ? (
        <View style={styles.emptyCta}>
          <ActionButton label={cta.label} onPress={cta.onPress} />
        </View>
      ) : null}
    </View>
  );
}

/* --------------------------------------------------------------- ErrorState */

type ErrorStateProps = {
  message: string;
  /** 있으면 "다시 시도" 버튼 노출. 네트워크 재시도가 가능한 경우 반드시 붙일 것. */
  onRetry?: () => void;
  /** 재시도 버튼 문구 커스텀 - 기본 "다시 시도". */
  retryLabel?: string;
};

export function ErrorState({ message, onRetry, retryLabel = '다시 시도' }: ErrorStateProps) {
  return (
    <View style={styles.errorBox} accessibilityLiveRegion="assertive">
      <Text style={styles.errorMessage}>{message}</Text>
      {onRetry ? (
        <View style={styles.errorRetry}>
          <ActionButton variant="secondary" label={retryLabel} onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

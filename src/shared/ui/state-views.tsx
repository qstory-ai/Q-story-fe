import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './action-button';
import { storybookTheme } from './theme';

/**
 * 리스트/데이터 화면의 세 가지 상태(loading / empty / error)를 통일된 표현으로 렌더한다.
 * 이전에는 페이지마다 spinner 색·유무·placement가 제각각이었고("불러오는 중이에요" 텍스트만
 * 있는 곳도, spinner만 있는 곳도, 둘 다 있는 곳도, 어떤 곳은 centered box이고 어떤 곳은
 * inline이고), 에러 상태에는 "다시 시도" 버튼이 아예 없어 사용자가 매번 새로고침해야 했다.
 * 세 컴포넌트로 통일해 페이지가 각자 재발명하지 않도록 한다.
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
    color: storybookTheme.color.onContentMuted,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: storybookTheme.spacing.xl,
    paddingHorizontal: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  emptyTitle: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.bold,
    color: storybookTheme.color.onContent,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: storybookTheme.type.xs,
    lineHeight: storybookTheme.type.xs * storybookTheme.lineHeight.normal,
    color: storybookTheme.color.onContentMuted,
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
    paddingVertical: storybookTheme.spacing.xl,
    paddingHorizontal: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
    borderRadius: storybookTheme.radius.card,
    backgroundColor: storybookTheme.color.contentPanel,
    borderWidth: 1,
    borderColor: storybookTheme.color.contentPanelBorder,
  },
  errorMessage: {
    fontSize: storybookTheme.type.sm,
    color: storybookTheme.color.error,
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
      <ActivityIndicator color={storybookTheme.color.primary} />
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
  /** 커스텀 노드(아이콘, 이미지 등) 위쪽에 얹고 싶을 때. */
  slot?: ReactNode;
};

export function EmptyState({ title, body, cta, slot }: EmptyStateProps) {
  return (
    <View style={styles.emptyBox}>
      {slot ?? null}
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

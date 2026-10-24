import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Pill, radius, semanticColors, shadow, storybookTheme } from '@/shared/ui';

/**
 * 회차 리포트 맨 위 흰 카드 - 어떤 기록인지(집/반 수업), 동화 제목, 한 줄 설명. 이야기 직후 리포트와 리포트 탭이 같이 쓴다
 * (10/24 QA: 두 화면이 같은 리포트인데 머리·폭·버튼이 달라 다른 화면처럼 보였다).
 */
export function ReportHeader({
  kindLabel,
  title,
  description,
  note,
  children,
}: {
  kindLabel: string;
  title: string;
  description: string;
  /** 설명 아래 작은 안내(예: "이 기록은 리포트 탭에서 다시 볼 수 있어요"). */
  note?: string;
  /** 카드 아래쪽에 붙는 행동(예: 다시 읽기). */
  children?: ReactNode;
}) {
  return (
    <View style={styles.header}>
      <Pill label={kindLabel} tone="accent" />
      <Text style={styles.headerTitle}>{title}</Text>
      <Text style={styles.headerBody}>{description}</Text>
      {note ? <Text style={styles.headerNote}>{note}</Text> : null}
      {children ? <View style={styles.headerAction}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    // 보호자 홈과 같은 흰 카드(radius 24, 옅은 테두리·그림자).
    borderRadius: radius[24],
    backgroundColor: semanticColors.light.bg.primary,
    borderWidth: 1,
    borderColor: semanticColors.light.border.secondary,
    ...shadow(1),
    padding: storybookTheme.spacing.ml,
    gap: storybookTheme.spacing.sm,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: storybookTheme.type.lg,
    fontWeight: storybookTheme.type.weight.black,
    color: storybookTheme.color.onCardTitle,
  },
  headerBody: {
    fontSize: storybookTheme.type.sm,
    lineHeight: 21,
    color: storybookTheme.color.onCardBody,
  },
  headerNote: {
    fontSize: storybookTheme.type.xs,
    lineHeight: 18,
    color: storybookTheme.color.onCardMuted,
  },
  headerAction: {
    alignSelf: 'stretch',
    gap: storybookTheme.spacing.sm,
    marginTop: storybookTheme.spacing.xs,
  },
});

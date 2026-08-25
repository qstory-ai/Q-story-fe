import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from './action-button';
import { EASE_IN_SINE, EASE_OUT_SINE, usePresenceAnimation } from './motion';
import { storybookTheme } from './theme';

type ModalAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
};

type ModalProps = {
  visible: boolean;
  eyebrow?: string;
  title?: string;
  children?: ReactNode;
  /** 오른쪽/기본 액션. Solid 2.0 팝업 규칙상 긍정 액션. */
  positiveAction?: ModalAction;
  /** 부정/취소 액션. */
  negativeAction?: ModalAction;
  /** 팝업을 닫거나 단계를 전환하는 등, 버튼이 아닌 텍스트 링크 액션. */
  linkAction?: { label: string; onPress: () => void };
  accessibilityLabel: string;
};

/**
 * Solid 2.0의 팝업 규칙을 따른다: Container > Title(optional) > Contents > Button(최대 2개).
 * 배경(scrim)에는 onPress를 아예 달지 않아 "딤 영역을 탭해도 닫히지 않는다"를 구조적으로
 * 보장한다 - 닫으려면 버튼이나 linkAction을 명시적으로 눌러야 한다.
 *
 * 카드는 usePresenceAnimation으로 페이드+스케일 인/아웃되지만, 딤 배경 자체는 Solid 2.0
 * 스펙대로("Dimmed 처리에 transition을 적용하지 않음") mount와 함께 즉시 나타나고 사라진다 -
 * 애니메이션은 카드에만 건다.
 */
export function Modal({
  visible,
  eyebrow,
  title,
  children,
  positiveAction,
  negativeAction,
  linkAction,
  accessibilityLabel,
}: ModalProps) {
  const { mounted, entered, durationMs } = usePresenceAnimation(visible);

  if (!mounted) return null;

  return (
    <View
      // position:'fixed'는 뷰포트 기준으로 항상 화면 전체를 덮는다 - position:'absolute'였을 땐
      // 가장 가까운 위치 지정 조상의 높이에 얹혀서, 콘텐츠가 뷰포트보다 짧은 화면(마이페이지 등)
      // 에서 조상 체인의 높이 전파 방식에 따라 스크림이 뷰포트 전체를 못 덮는 문제가 있었다.
      // RN의 position 타입엔 'fixed'가 없어 이 한 스타일만 any로 둔다.
      style={[styles.scrim, { position: 'fixed' } as any]}
      accessibilityViewIsModal
      accessibilityLabel={accessibilityLabel}
    >
      {
        // 카드가 뷰포트보다 길어질 수 있는 폼(예: LaunchNotificationGate)이 생기면서, 그냥
        // View + alignItems:'center'로는 넘치는 아래쪽 필드/버튼이 화면 밖으로 잘려 아예 손이
        // 닿지 않았다 - ScrollView로 감싸 짧은 콘텐츠는 그대로 중앙 정렬되고, 뷰포트보다 긴
        // 콘텐츠는 스크롤해서 끝까지 볼 수 있게 한다.
      }
      <ScrollView
        style={styles.scrimScroll}
        contentContainerStyle={styles.scrimScrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View
          // react-native-web은 transitionProperty 등 웹 전용 CSS 확장을 style로 그대로
          // 통과시켜 주지만, RN의 ViewStyle 타입에는 없어서 이 스타일 객체만 any로 둔다.
          style={[
            styles.card,
            {
              opacity: entered ? 1 : 0,
              transform: [{ scale: entered ? 1 : 0.96 }],
              transitionProperty: 'opacity, transform',
              transitionDuration: `${durationMs}ms`,
              transitionTimingFunction: entered ? EASE_OUT_SINE : EASE_IN_SINE,
            } as any,
          ]}
        >
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
          {positiveAction ? (
            <ActionButton
              variant="primary"
              label={positiveAction.label}
              onPress={positiveAction.onPress}
              disabled={positiveAction.disabled}
              loading={positiveAction.loading}
            />
          ) : null}
          {negativeAction ? (
            <ActionButton
              variant="secondaryFull"
              label={negativeAction.label}
              onPress={negativeAction.onPress}
              disabled={negativeAction.disabled}
              loading={negativeAction.loading}
            />
          ) : null}
          {linkAction ? (
            <Pressable style={styles.linkButton} onPress={linkAction.onPress}>
              <Text style={styles.linkButtonText}>{linkAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

/** Modal 안에서 본문 문단에 쓰는 표준 텍스트 스타일 - one-story 모달 3개가 공유하던 값. */
export function ModalBody({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    zIndex: storybookTheme.zIndex.overlay,
    backgroundColor: storybookTheme.color.scrim,
  },
  scrimScroll: {
    flex: 1,
  },
  scrimScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 520,
    borderRadius: storybookTheme.radius.modalCard,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: storybookTheme.color.surfaceCardOpaque,
    padding: 24,
    gap: 13,
    shadowColor: storybookTheme.color.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
  },
  eyebrow: {
    alignSelf: 'center',
    color: storybookTheme.color.primary,
    backgroundColor: storybookTheme.status.info.background,
    borderRadius: storybookTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
  },
  title: {
    color: storybookTheme.color.onCardTitle,
    fontSize: 25,
    lineHeight: 34,
    fontWeight: '700',
    textAlign: 'center',
  },
  linkButton: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: storybookTheme.color.linkOnLight,
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  body: {
    color: storybookTheme.color.onCardBody,
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
  },
});

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const cardRef = useRef<View>(null);
  const previouslyFocused = useRef<Element | null>(null);

  // 키보드/스크린리더 사용자가 열림과 동시에 카드 안으로 들어오고, 닫히면 원래 있던
  // 요소(트리거 버튼 등)로 돌아가게 한다 - RNW View는 tabIndex를 그대로 DOM에 통과시킨다.
  useEffect(() => {
    if (!visible) return;
    previouslyFocused.current = typeof document !== 'undefined' ? document.activeElement : null;
    const node = cardRef.current as unknown as HTMLElement | null;
    node?.focus?.();
    return () => {
      const previous = previouslyFocused.current as HTMLElement | null;
      previous?.focus?.();
    };
  }, [visible]);

  if (!mounted) return null;

  const scrim = (
    <View
      // position:'fixed'는 뷰포트 기준으로 항상 화면 전체를 덮는다 - position:'absolute'였을 땐
      // 가장 가까운 위치 지정 조상의 높이에 얹혀서, 콘텐츠가 뷰포트보다 짧은 화면(마이페이지 등)
      // 에서 조상 체인의 높이 전파 방식에 따라 스크림이 뷰포트 전체를 못 덮는 문제가 있었다.
      // RN의 position 타입엔 'fixed'가 없어 이 한 스타일만 any로 둔다.
      style={[styles.scrim, { position: 'fixed' } as any]}
      accessibilityViewIsModal
      accessibilityRole="none"
      {...({ role: 'dialog', 'aria-modal': true } as any)}
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
          ref={cardRef}
          // 카드 자체를 포커스 대상으로 만들어 모달이 열리자마자 키보드 포커스가 스크림 뒤
          // 콘텐츠가 아니라 카드 안으로 들어오게 한다 (tabIndex는 RNW가 DOM에 그대로 전달한다).
          {...({ tabIndex: -1 } as any)}
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
              outlineStyle: 'none',
            } as any,
          ]}
        >
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
          {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
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
            <Pressable
              style={styles.linkButton}
              onPress={linkAction.onPress}
              accessibilityRole="button"
              accessibilityLabel={linkAction.label}
            >
              <Text style={styles.linkButtonText}>{linkAction.label}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );

  // react-native-web의 모든 View는 기본 스타일에 position:'relative' + zIndex:0을 깔고 나온다
  // (react-native-web/dist/.../View/index.js의 view$raw) - z-index:auto가 아니라 명시적 0이라
  // "position이 static이 아니고 z-index가 auto가 아닌 요소는 새 stacking context를 만든다"는
  // 규칙에 따라 이 앱의 View 하나하나가 전부 독립된 stacking context다. 그 결과 이 스크림을 평소
  // 트리 안(예: ChildSelector 안)에 그냥 두면, scrim 자체의 zIndex:overlay(20)는 "그 부모 View
  // 내부에서"만 의미가 있을 뿐 - 그 부모보다 DOM 순서상 나중에 오는 형제 섹션(예: 홈의 히어로
  // 추천 카드, 사이드바, 달력)은 여전히 부모 자체의 z-index:0 기준으로 스크림 전체를 덮어버린다
  // (같은 z-index:0끼리는 나중에 오는 DOM이 위에 그려지므로). 즉 이 컴포넌트 안에서 아무리
  // z-index를 올려도 원천적으로 이 문제를 못 피한다 - 실제로 뷰포트 최상단에 뜨려면 DOM
  // 트리에서도 벗어나야 해서, document.body에 직접 포탈로 올린다(React context는 포탈을
  // 통과해도 그대로 유지된다).
  if (typeof document === 'undefined') return scrim;
  return createPortal(scrim, document.body);
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
    ...storybookTheme.elevation.modal,
  },
  eyebrow: {
    alignSelf: 'center',
    color: storybookTheme.color.primary,
    backgroundColor: storybookTheme.status.info.background,
    borderRadius: storybookTheme.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: storybookTheme.type.xxs,
    fontWeight: storybookTheme.type.weight.bold,
  },
  title: {
    color: storybookTheme.color.onCardTitle,
    fontSize: storybookTheme.type.xl,
    lineHeight: storybookTheme.type.xl * storybookTheme.lineHeight.tight,
    letterSpacing: storybookTheme.type.xl * storybookTheme.tracking.heading,
    fontWeight: storybookTheme.type.weight.bold,
    textAlign: 'center',
  },
  linkButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkButtonText: {
    color: storybookTheme.color.linkOnLight,
    fontSize: storybookTheme.type.xs,
    fontWeight: storybookTheme.type.weight.bold,
    textDecorationLine: 'underline',
  },
  body: {
    color: storybookTheme.color.onCardBody,
    fontSize: storybookTheme.type.sm,
    lineHeight: storybookTheme.type.sm * storybookTheme.lineHeight.normal,
    textAlign: 'center',
  },
});

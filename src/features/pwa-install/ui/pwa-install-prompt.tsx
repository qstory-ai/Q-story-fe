import { Capacitor } from '@capacitor/core';
import { useState, useSyncExternalStore } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocation } from 'react-router-dom';

import { ActionButton, storybookTheme } from '@/shared/ui';

import { hasDeferredPrompt, showDeferredPrompt, subscribeDeferredPrompt } from '../model/deferred-install-prompt';
import { INSTALL_DISMISSED_KEY, installPromptKind } from '../model/install-prompt-logic';

function readDismissedAt(): number | null {
  try {
    const value = Number(window.localStorage.getItem(INSTALL_DISMISSED_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * 홈 화면 설치 안내. 화면 아래에 뜨는 작은 카드다(라우터 안에 한 번).
 * 크롬 계열은 "설치" 버튼이 브라우저 설치 창을 띄우고, iOS 사파리는 추가 방법만 알려 준다.
 * 닫으면 2주 동안 다시 뜨지 않는다. 언제 뜨는지는 model/install-prompt-logic.ts가 정한다.
 */
export function PwaInstallPrompt() {
  const { pathname } = useLocation();
  const promptReady = useSyncExternalStore(subscribeDeferredPrompt, hasDeferredPrompt, () => false);
  const [dismissedAt, setDismissedAt] = useState<number | null>(readDismissedAt);
  // 렌더 중에 시계를 읽지 않게 처음 그릴 때의 시각을 잡아 둔다.
  const [now] = useState(() => Date.now());

  const kind = installPromptKind({
    pathname,
    isNativePlatform: Capacitor.isNativePlatform(),
    isStandalone: isStandalone(),
    hasDeferredPrompt: promptReady,
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    dismissedAt,
    now,
  });
  if (!kind) return null;

  const dismiss = () => {
    const closedAt = Date.now();
    try {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, String(closedAt));
    } catch {
      // 저장소를 못 써도 이번 화면에서는 닫는다.
    }
    setDismissedAt(closedAt);
  };

  const install = () => {
    // 설치 창에서 취소해도 다시 조르지 않게 닫은 것으로 친다. 설치하면 appinstalled로 사라진다.
    void showDeferredPrompt().then((outcome) => {
      if (outcome !== 'accepted') dismiss();
    });
  };

  return (
    <View style={styles.anchor} pointerEvents="box-none">
      <View style={styles.card} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <img src="/brand/qstory-icon-192.png" alt="" width={40} height={40} style={{ borderRadius: 10 }} />
        <View style={styles.copy}>
          <Text style={styles.title}>큐스토리를 홈 화면에 추가해 보세요</Text>
          <Text style={styles.body}>
            {kind === 'ios-guide'
              ? '사파리의 공유 버튼을 누르고 "홈 화면에 추가"를 고르면 앱처럼 열 수 있어요.'
              : '앱처럼 바로 열 수 있어요.'}
          </Text>
        </View>
        <View style={styles.actions}>
          {kind === 'native-prompt' ? <ActionButton label="설치" variant="primary" size="sm" onPress={install} /> : null}
          <ActionButton label={kind === 'ios-guide' ? '확인' : '나중에'} variant="ghost" size="sm" onPress={dismiss} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: {
    position: 'fixed' as 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' as unknown as number,
    zIndex: storybookTheme.zIndex.overlay,
  },
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    maxWidth: 520,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: storybookTheme.radius.card,
    borderWidth: 1,
    borderColor: storybookTheme.color.surfaceCardBorder,
    backgroundColor: storybookTheme.color.surfaceCard,
    ...storybookTheme.elevation.high,
  },
  copy: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 180,
    gap: 2,
  },
  title: {
    fontSize: storybookTheme.type.sm,
    fontWeight: storybookTheme.type.weight.semibold,
    color: storybookTheme.color.onLightHeading,
  },
  body: {
    fontSize: storybookTheme.type.xs,
    color: storybookTheme.color.onLightBody,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
});

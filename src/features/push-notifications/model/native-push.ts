import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { PushNotificationsPlugin } from '@capacitor/push-notifications';

import { requestNotificationRefresh } from '@/entities/notification';

import { registerPushToken, removePushToken, type PushPlatform } from '../api/push-token-api';
import { internalHrefOrNull, permissionStep, shouldSendToken, type SentToken } from './push-logic';

/**
 * 태블릿 앱(Capacitor, 안드로이드·아이패드)의 FCM 푸시. 웹에서는 아무것도 하지 않는다.
 * iOS도 FCM 등록 토큰을 받는다 - AppDelegate.swift가 APNs 토큰을 Firebase Messaging에 넘기고 받은 FCM 토큰을
 * 플러그인의 registration 이벤트로 올려 준다(BE는 플랫폼과 관계없이 FCM HTTP v1로 보낸다).
 *
 * 흐름: 앱 시작 → 알림 채널 생성 + 알림 탭 리스너 → 로그인되면 알림 권한을 한 번 묻고 FCM에 등록 →
 * 받은 토큰을 POST /v1/me/push-tokens로 계정에 묶는다(토큰이 갱신되거나 계정이 바뀌면 다시 보냄) →
 * 로그아웃 직전에 POST /v1/me/push-tokens/remove로 풀고 세션 리스너를 뗀다.
 * 앱이 켜져 있을 때 온 푸시는 시스템 알림을 띄우지 않고(안드로이드는 플러그인 기본 동작, iOS는
 * capacitor.config의 presentationOptions: []) 알림 벨만 새로 고친다.
 */

/** BE가 푸시를 보내는 안드로이드 채널 id - AndroidManifest의 default_notification_channel_id와 같다. */
export const PUSH_CHANNEL_ID = 'qstory_default';
const PERMISSION_ASKED_KEY = 'qstory.push.permission-asked';

export function isPushSupported(): boolean {
  return pushPlatform() !== null;
}

function pushPlatform(): Extract<PushPlatform, 'ANDROID' | 'IOS'> | null {
  const platform = Capacitor.getPlatform();
  if (platform === 'android') return 'ANDROID';
  if (platform === 'ios') return 'IOS';
  return null;
}

// 플러그인 객체를 Promise 값으로 그대로 넘기면 안 된다 - Capacitor 플러그인은 프록시라 Promise가 then()이 있는지
// 확인하려고 부르는 순간 '"PushNotifications.then()" is not implemented on android'로 거부된다(운영 기기에서 실제로 발생).
// 그래서 객체에 감싸서 넘긴다.
let pluginPromise: Promise<{ push: PushNotificationsPlugin }> | null = null;
function plugin(): Promise<{ push: PushNotificationsPlugin }> {
  // 웹 번들 첫 화면에 플러그인 코드를 싣지 않도록 네이티브 앱에서만 불러온다.
  pluginPromise ??= import('@capacitor/push-notifications').then((m) => ({ push: m.PushNotifications }));
  return pluginPromise;
}

let fcmToken: string | null = null;
let lastSent: SentToken = null;
let session: { authToken: string; userId: string } | null = null;
let sessionListeners: Promise<PluginListenerHandle[]> | null = null;

function readAsked(): boolean {
  try {
    return globalThis.localStorage?.getItem(PERMISSION_ASKED_KEY) === '1';
  } catch {
    return false;
  }
}

function markAsked(): void {
  try {
    globalThis.localStorage?.setItem(PERMISSION_ASKED_KEY, '1');
  } catch {
    // 저장소가 없으면 다음 실행에 한 번 더 물을 수 있다 - 안드로이드도 두 번 거절하면 더 묻지 않는다.
  }
}

async function syncToken(): Promise<void> {
  const current = session;
  const token = fcmToken;
  const platform = pushPlatform();
  if (!current || !token || !platform || !shouldSendToken(token, current.userId, lastSent)) return;
  try {
    await registerPushToken(current.authToken, token, platform);
    // 보내는 사이 로그아웃·계정 전환이 없었을 때만 기록 - 바뀌었으면 다음 sync가 새 계정으로 다시 보낸다.
    if (session === current) lastSent = { token, userId: current.userId };
  } catch (error) {
    console.warn('[push] 토큰 등록 실패', error);
  }
}

/** 앱 시작 때 한 번 - (안드로이드는) 채널을 만들고 알림 탭을 받는다. 반환 함수로 리스너를 뗀다. */
export async function startPush(onOpenHref: (href: string) => void): Promise<() => void> {
  if (!isPushSupported()) return () => {};
  const { push } = await plugin();
  // 알림 채널은 안드로이드 개념이다 - iOS 플러그인은 createChannel을 구현하지 않는다.
  if (pushPlatform() === 'ANDROID') {
    try {
      await push.createChannel({
        id: PUSH_CHANNEL_ID,
        name: 'Q-Story 알림',
        description: '리포트 도착, 수업 알림 등',
        importance: 4, // IMPORTANCE_HIGH - 헤드업으로 보인다.
        visibility: 1, // VISIBILITY_PUBLIC
      });
    } catch (error) {
      console.warn('[push] 알림 채널 생성 실패', error);
    }
  }
  // 앱이 꺼져 있을 때 알림을 눌러 열어도 플러그인이 이벤트를 붙잡아 뒀다가 리스너가 붙으면 넘긴다.
  // FCM data 키는 두 플랫폼 모두 notification.data로 온다(iOS는 APNs userInfo가 그대로 data가 된다).
  const tap = await push.addListener('pushNotificationActionPerformed', (action) => {
    const href = internalHrefOrNull(action.notification.data?.href);
    if (href) onOpenHref(href);
  });
  return () => {
    void tap.remove();
  };
}

/** 로그인 상태가 되면(앱 시작 시 복원 포함) 부른다. 같은 계정으로 다시 불러도 안전하다. */
export async function beginPushSession(authToken: string, userId: string): Promise<void> {
  if (!isPushSupported()) return;
  session = { authToken, userId };
  const { push } = await plugin();
  sessionListeners ??= Promise.all([
    push.addListener('registration', (t) => {
      fcmToken = t.value;
      void syncToken();
    }),
    push.addListener('registrationError', (error) => console.warn('[push] FCM 등록 실패', error)),
    push.addListener('pushNotificationReceived', () => requestNotificationRefresh()),
  ]);
  await sessionListeners;
  try {
    let step = permissionStep((await push.checkPermissions()).receive, readAsked());
    if (step === 'request') {
      markAsked();
      step = (await push.requestPermissions()).receive === 'granted' ? 'register' : 'skip';
    }
    if (step !== 'register' || session?.authToken !== authToken) return;
    // 이미 등록돼 있으면 같은 토큰으로 registration이 다시 온다 - 계정이 바뀐 경우 syncToken이 새로 보낸다.
    await push.register();
    void syncToken();
  } catch (error) {
    console.warn('[push] 알림 권한·등록 실패', error);
  }
}

/** 로그인이 풀렸을 때. authToken을 주면(로그아웃 직전) 서버에서도 이 기기 토큰을 푼다. */
export function endPushSession(authToken?: string): void {
  if (!isPushSupported()) return;
  if (authToken && fcmToken && lastSent) {
    removePushToken(authToken, fcmToken).catch((error) => console.warn('[push] 토큰 해제 실패', error));
  }
  session = null;
  lastSent = null;
  const listeners = sessionListeners;
  sessionListeners = null;
  void listeners?.then((handles) => handles.forEach((h) => void h.remove()));
}

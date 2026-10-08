import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 태블릿(아이패드 / 갤럭시탭) 네이티브 셸 설정 - 같은 Vite 빌드(dist/)를 Capacitor WebView에
 * 담아 배포한다. 웹과 다른 점은 하나뿐이다: 네이티브 셸에는 같은 출처(same-origin) Vercel
 * 프록시(/api/qstory)가 없으므로, `npm run build:native`가 .env.native의 절대 백엔드 URL로
 * 빌드한다. WebView의 출처는 아래 server.hostname으로 고정돼 Android는 https://app.qstory.ai.kr,
 * iOS는 capacitor://app.qstory.ai.kr 이고, 백엔드는 이 둘을 qstory.native-origins로 항상 허용한다
 * (be application.yml + SecurityConfig). hostname을 바꾸면 백엔드 쪽도 같이 바꾼다.
 *
 * 빌드 순서: npm run build:native → npx cap sync → (android) npm run android:apk
 *                                              → (ios) macOS에서 npx cap open ios 또는 CI(.github/workflows/native-tablet-builds.yml)
 */
const config: CapacitorConfig = {
  appId: 'kr.ai.qstory',
  appName: 'Q-Story',
  webDir: 'dist',
  server: {
    // WebView가 뜨는 가짜 호스트. 기본값 localhost 대신 우리 도메인을 써서 백엔드 CORS 목록에
    // "https://localhost"처럼 아무 로컬 페이지나 해당되는 출처를 넣지 않게 한다. 실제로 이 주소로
    // 네트워크 요청이 나가진 않는다(Capacitor가 로컬 파일을 이 출처로 서빙). 한 번 배포한 뒤 바꾸면
    // localStorage(세션 토큰) 출처가 달라져 사용자가 로그아웃되니 출시 전에만 바꾼다.
    hostname: 'app.qstory.ai.kr',
    // Android WebView 스킴 - Secure Context가 필요한 API(getUserMedia 등)가 그대로 동작한다.
    androidScheme: 'https',
    // allowNavigation은 "WebView 안에서 열어도 되는 호스트" 목록이다(외부 브라우저로 보내는 목록이
    // 아니다). 비워 두면 랜딩(잠시 나가기)·약관 같은 외부 링크는 전부 시스템 브라우저로 열리고, 앱은
    // 그대로 남는다. 랜딩 도메인을 넣으면 랜딩이 앱 안에서 열려 돌아올 길이 없어진다.
  },
  android: {
    // 마이크 녹음(getUserMedia)은 Capacitor가 RECORD_AUDIO 권한을 확인한 뒤 WebView에 허용한다.
    // AndroidManifest.xml에 RECORD_AUDIO/MODIFY_AUDIO_SETTINGS를 선언해 두었다.
    allowMixedContent: false,
    backgroundColor: '#F7F8FA',
  },
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#F7F8FA',
    // 무음 스위치 상태에서도 낭독이 들리게 하는 오디오 세션(playAndRecord)은 AppDelegate.swift에서 잡는다.
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 800,
      backgroundColor: '#FFF7E8',
      showSpinner: false,
    },
    PushNotifications: {
      // iOS는 앱이 켜져 있을 때 온 푸시를 이 옵션대로만 시스템 배너로 띄운다. 비워 두면 안드로이드와 같게
      // 배너 없이 pushNotificationReceived만 와서 알림 벨을 새로 고친다(native-push.ts). 안드로이드는 무시한다.
      presentationOptions: [],
    },
  },
};

export default config;

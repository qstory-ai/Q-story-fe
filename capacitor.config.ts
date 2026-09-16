import type { CapacitorConfig } from '@capacitor/cli';

/**
 * 태블릿(아이패드 / 갤럭시탭) 네이티브 셸 설정 - 같은 Vite 빌드(dist/)를 Capacitor WebView에
 * 담아 배포한다. 웹과 다른 점은 하나뿐이다: 네이티브 셸에는 같은 출처(same-origin) Vercel
 * 프록시(/api/qstory)가 없으므로, `npm run build:native`가 .env.native의 절대 백엔드 URL로
 * 빌드한다. 그래서 WebView의 출처(Android https://localhost, iOS capacitor://localhost)를
 * 백엔드 CORS allowed-origins에 넣어 두었다(be/q-story-backend application*.yml).
 *
 * 빌드 순서: npm run build:native → npx cap sync → (android) npm run android:apk
 *                                              → (ios) macOS에서 npx cap open ios 또는 CI(.github/workflows/native-ios.yml)
 */
const config: CapacitorConfig = {
  appId: 'kr.ai.qstory.app',
  appName: 'Q-Story',
  webDir: 'dist',
  server: {
    // Android WebView 출처를 https://localhost로 고정 - localStorage(세션 토큰) 키가 안정되고,
    // Secure Context가 필요한 API(getUserMedia 등)가 그대로 동작한다.
    androidScheme: 'https',
    // 이야기 재생 화면이 부모/랜딩 링크로 나갈 때 외부 브라우저로 열리도록 앱 도메인만 허용한다.
    allowNavigation: ['qstory.ai.kr', '*.qstory.ai.kr'],
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
    // 자막 오디오가 무음 스위치 상태에서도 나오게 - 동화 낭독이 핵심 기능이라서.
    // (실제 오디오 세션 카테고리는 AppDelegate에서 playback으로 잡는다.)
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      launchShowDuration: 800,
      backgroundColor: '#FFF7E8',
      showSpinner: false,
    },
  },
};

export default config;

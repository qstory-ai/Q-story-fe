# 태블릿(아이패드 · 갤럭시탭) 네이티브 빌드

같은 웹 앱(Vite + react-native-web)을 [Capacitor](https://capacitorjs.com)로 감싼 것이다. 화면·로직은
웹과 100% 같고, 네이티브 프로젝트(`android/`, `ios/`)는 WebView 껍데기와 권한 선언만 갖는다.

## 한눈에

| | 갤럭시탭 (Android) | 아이패드 (iOS) |
|---|---|---|
| 결과물 | `build-output/qstory-tablet-*.apk` | `.ipa` (실기기) / `App.app` (시뮬레이터) |
| 이 PC(Windows)에서 | **가능** - `npm run android:apk` | **불가능** - Xcode는 macOS 전용 |
| 없이 만들려면 | - | GitHub Actions macOS 러너(`.github/workflows/native-tablet-builds.yml`) 또는 Mac |
| 기기 설치 | APK 파일 복사 → "출처를 알 수 없는 앱" 허용, 또는 `adb install` | TestFlight(App Store Connect) 또는 Ad Hoc 프로파일 + Apple Developer 계정($99/년) |
| 앱 ID | `kr.ai.qstory.app` | `kr.ai.qstory.app` |

## 웹 빌드와 다른 점 - API 주소

웹은 같은 출처의 Vercel 프록시(`/api/qstory`)를 부르지만, 앱 안의 WebView는 `capacitor.config.ts`의
`server.hostname`으로 정한 가짜 호스트 `https://app.qstory.ai.kr`(Android) / `capacitor://app.qstory.ai.kr`(iOS)에서
뜨므로 그 프록시가 없다. 그래서

- `npm run build:native` = `vite build --mode native` → [`.env.native`](../.env.native)의 **절대 백엔드 URL**로 빌드
- 백엔드는 이 두 출처를 `qstory.native-origins`(`application.yml`)로 두고 `SecurityConfig`가 환경별
  `allowed-origins`에 **항상 더한다**. 프로필 yml이나 Railway의 `ALLOWED_ORIGINS` 환경변수가 무엇이든
  네이티브 출처는 열려 있으므로 배포 환경변수를 손댈 필요가 없다. `hostname`을 바꾸면 백엔드의
  `native-origins`도 같이 바꾼다.
- 스테이징 등 다른 백엔드로 빌드하려면 `.env.native.local`(gitignore)에 같은 키를 덮어쓴다.

## 갤럭시탭 - 이 PC에서 APK 만들기

최초 1회:

```powershell
# JDK 17+ 필요 (이 PC: Eclipse Adoptium 21, JAVA_HOME 설정됨)
powershell -ExecutionPolicy Bypass -File scripts/setup-android-sdk.ps1
```

Android Studio 없이 `C:\Android\sdk`에 platform-tools·platform 36·build-tools 36을 설치하고
`ANDROID_HOME`과 `android/local.properties`를 써 준다(약 1.5GB).

매번:

```powershell
npm run android:apk            # 웹 빌드(native 모드) → cap sync → gradle assembleDebug → build-output/
npm run android:apk:release    # 서명 키가 있으면 서명된 release, 없으면 unsigned(설치 불가)
```

첫 빌드는 Gradle과 의존성을 내려받느라 5~10분 걸리고, 이후엔 1~2분이다.

설치:

```powershell
adb devices                                    # 태블릿의 개발자 옵션 > USB 디버깅 켜고 연결
adb install -r build-output\qstory-tablet-0.1.0-YYYYMMDD-debug.apk
```

또는 APK를 카카오톡/드라이브로 옮겨 태블릿에서 열면 "출처를 알 수 없는 앱" 허용 뒤 설치된다.

### release 서명 키

```powershell
cd android
keytool -genkeypair -v -keystore release.jks -alias qstory -keyalg RSA -keysize 2048 -validity 10000
```

`android/keystore.properties`(gitignore)를 만든다:

```
storeFile=release.jks
storePassword=...
keyAlias=qstory
keyPassword=...
```

`app/build.gradle`이 이 파일이 있을 때만 release에 서명한다. **키를 잃으면 같은 앱으로 업데이트할 수
없으니** 안전한 곳에 백업한다. Play 스토어 배포 시엔 `./gradlew bundleRelease`로 AAB를 만든다.

## 아이패드

Windows에서는 iOS 빌드가 불가능하다(Xcode·코드 서명 모두 macOS 전용). 두 가지 길이 있다.

### A. GitHub Actions (Mac 없이)

`.github/workflows/native-tablet-builds.yml`을 **Actions 탭에서 수동 실행**(workflow_dispatch)하거나
`tablet-v*` 태그를 푸시한다. 매 커밋마다 돌리지 않는 이유는 macOS 러너 요금이 Linux의 10배라서다.

- 시크릿 없이도: **시뮬레이터용 `App.app`**(zip)이 나온다 - Mac의 아이패드 시뮬레이터에서 화면 확인용.
- 실제 아이패드에 올리려면 시크릿 4개를 저장소에 등록한다:
  `IOS_CERTIFICATE_P12_BASE64`(배포 인증서 .p12를 base64), `IOS_CERTIFICATE_PASSWORD`,
  `IOS_PROVISIONING_PROFILE_BASE64`(Ad Hoc 또는 App Store 프로파일), `IOS_TEAM_ID`.
  그러면 `qstory-tablet-ios.ipa`가 나온다. Ad Hoc 프로파일엔 설치할 아이패드의 UDID가 미리 등록돼
  있어야 하고, TestFlight로 배포하려면 `IOS_EXPORT_METHOD=app-store`로 두고 IPA를 App Store Connect에 올린다.
- 인증서·프로파일은 Apple Developer 계정(연 $99)에서 만든다. Mac이 하나도 없으면 인증서 생성이
  까다로우므로(CSR 생성) 팀의 Mac을 한 번 빌리는 편이 빠르다.

### B. Mac에서 직접

```bash
npm ci
npm run ios:open        # build:native → cap sync → Xcode 열기
```

Xcode에서 Signing & Capabilities > Team 선택 후 아이패드를 연결해 Run. 처음엔 기기에서
설정 > 일반 > VPN 및 기기 관리에서 개발자 앱을 신뢰해야 한다. Capacitor 8은 CocoaPods 대신
Swift Package Manager를 쓰므로 `pod install`은 필요 없다.

## 아이폰·안드로이드 폰

같은 프로젝트가 폰도 그대로 덮는다 - 별도 세팅이 없다.

- **iOS**: `project.pbxproj`의 `TARGETED_DEVICE_FAMILY = "1,2"`(iPhone + iPad)가 Capacitor 템플릿에 이미 들어 있다.
  같은 `.ipa`가 아이폰·아이패드 모두에 설치되고, 워크플로의 시뮬레이터 빌드도 두 기기용이다. 아이폰만 따로
  빌드할 필요는 없고, 시뮬레이터에서 아이폰으로 보려면 `xcrun simctl`에서 iPhone 기기를 고르면 된다.
  `Info.plist`의 iPhone 회전은 세로 + 가로 양쪽(기본값), 아이패드는 4방향이다.
- **Android**: 매니페스트에 화면 크기 제한(`compatible-screens`, `smallestWidth`)을 두지 않았으므로 같은 APK가
  갤럭시 폰에도 설치된다.
- 화면은 웹과 같은 반응형 레이아웃이다 - 폰 폭(600px 미만)에서는 이야기 플레이어가 한 줄 상단 바 + 하단 재생
  도크로 바뀐다(`isNarrow`, `src/pages/one-story/ui/playback-dock.tsx`).

## 앱 아이콘·스플래시

`assets/logo.png`(1024×1024, `public/brand`의 앱 아이콘)에서 생성한다:

```powershell
npm run cap:assets
```

`android/app/src/main/res/`와 `ios/App/App/Assets.xcassets/`에 모든 크기가 만들어진다. 배경색은
`#FFF7E8`(스플래시·적응형 아이콘 배경).

## 네이티브 프로젝트에서 손댄 것

Capacitor가 생성한 기본 프로젝트에 아래만 추가했다. `npx cap sync`는 이 파일들을 덮어쓰지 않는다.

| 파일 | 변경 |
|---|---|
| `capacitor.config.ts` | appId/appName, `server.hostname`(WebView 출처), `androidScheme: https`, 외부 링크 허용 도메인, 스플래시 설정 |
| `android/app/src/main/AndroidManifest.xml` | `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` 권한(아이 질문 녹음), 마이크 없는 기기 설치 허용 |
| `android/app/build.gradle` | `keystore.properties`가 있을 때만 release 서명 |
| `ios/App/App/Info.plist` | 마이크·카메라·사진 사용 설명(권한 창 문구). 아이패드 4방향 회전은 기본값 그대로 |
| `ios/App/App/AppDelegate.swift` | 오디오 세션 `playAndRecord` + 스피커 출력 - 무음 스위치에서도 낭독이 들리게 |

## 알려진 제약

- **Google 로그인**은 WebView 안에서 Google이 차단한다(정책). 앱에서는 아이디/비밀번호 또는 카카오만
  쓰거나, 나중에 `@capacitor/browser`(시스템 브라우저)로 OAuth를 옮겨야 한다.
- **결제(토스)**는 WebView에서 카드사 앱 전환이 필요할 수 있어 별도 확인이 필요하다.
- iOS의 마이크 녹음은 iPadOS 14.3 이상에서만 WebView `getUserMedia`가 동작한다.
- `window.location.assign(랜딩 URL)`처럼 앱 밖으로 나가는 링크는 시스템 브라우저로 열린다. `capacitor.config.ts`의
  `server.allowNavigation`은 비워 둔다 - 거기 적힌 호스트는 **WebView 안에서** 열리므로 랜딩 도메인을 넣으면 앱이
  랜딩 페이지로 바뀌고 돌아올 길이 없다.
- 초대 링크·결제 복귀 주소는 페이지 출처가 아니라 `.env.native`의 `VITE_QSTORY_WEB_ORIGIN`(공개 웹 주소)으로
  만든다(`shared/config` `webOrigin()`). 앱 안의 페이지 출처(`app.qstory.ai.kr`)는 실제로 열리는 주소가 아니다.

## 버전 올리기

- Android: `android/app/build.gradle`의 `versionCode`(정수, 매 배포마다 +1)와 `versionName`.
- iOS: Xcode 타깃의 Version / Build(또는 `project.pbxproj`의 `MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`).
- 웹 `package.json`의 `version`은 APK 파일 이름에만 쓰인다.

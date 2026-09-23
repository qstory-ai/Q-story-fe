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
| 앱 ID | `kr.ai.qstory` | `kr.ai.qstory` |

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

## 갤럭시탭 - 테스터에게 나눠주기 (Firebase App Distribution)

iOS의 TestFlight에 해당하는 것. Play 개발자 계정 없이 무료로, 테스터 이메일에 설치 링크를 보내고
테스터는 Firebase "App Tester" 앱에서 설치·업데이트한다. 워크플로(`native-tablet-builds`)의 Android 잡
끝에 붙어 있고, 아래 시크릿 두 개가 있을 때만 동작한다(없으면 Artifacts 다운로드까지만).

한 번만 하는 설정:

1. https://console.firebase.google.com 에서 프로젝트를 만든다(구글 계정이면 됨, 무료 Spark 플랜).
2. 프로젝트 설정 > 일반 > "앱 추가" > Android. 패키지 이름 `kr.ai.qstory`(capacitor.config.ts의 appId).
   `google-services.json`은 내려받지 않아도 된다 - 배포에만 쓰고 앱 코드에 SDK를 넣지 않는다.
   등록 후 앱 목록에 보이는 **앱 ID**(`1:123456789:android:abcdef...`)를 복사한다.
3. 왼쪽 메뉴 출시 및 모니터링 > App Distribution > 시작하기. "테스터 및 그룹" 탭에서 그룹을 만들고
   alias를 `tablet-testers`로 둔다(워크플로 기본값). 테스터 이메일을 그룹에 추가한다.
4. 서비스 계정: 프로젝트 설정 > 서비스 계정 > "Google Cloud에서 서비스 계정 관리" > 서비스 계정 만들기,
   역할은 **Firebase App Distribution 관리자 SDK 서비스 에이전트**(또는 Firebase App Distribution Admin).
   키 > 새 키(JSON)를 내려받는다.
5. GitHub 저장소 Settings > Secrets and variables > Actions:
   - `FIREBASE_ANDROID_APP_ID` = 2의 앱 ID
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = 4의 JSON 파일 내용 전체

배포하기: Actions > native-tablet-builds > Run workflow. `release_notes`에 한 줄 메모(비우면 커밋
메시지), `tester_groups`에 그룹 alias(기본 `tablet-testers`). 끝나면 그룹의 테스터에게 메일이 간다.
서명 키 시크릿(`ANDROID_KEYSTORE_*`)이 있으면 서명된 release APK를, 없으면 debug APK를 올린다 -
둘 다 설치되지만 debug와 release는 서명이 달라 서로 덮어쓰기 설치가 안 되니 한쪽으로 통일한다.

테스터 쪽: 초대 메일의 "시작하기" > 구글 계정으로 수락 > App Tester 앱 설치 > 목록에서 Q-Story 설치.
갤럭시탭에서 "출처를 알 수 없는 앱" 허용은 App Tester에 한 번 해 주면 된다. 이후 새 빌드는 앱 안에서
알림으로 받는다.

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
- iOS: Version은 `project.pbxproj`의 `MARKETING_VERSION`. Build(`CURRENT_PROJECT_VERSION`)는 CI가 워크플로 실행
  번호로 자동으로 채운다 - TestFlight가 같은 Build를 두 번 받지 않기 때문. Mac에서 직접 올릴 때만 손으로 올린다.
- 웹 `package.json`의 `version`은 APK 파일 이름에만 쓰인다.

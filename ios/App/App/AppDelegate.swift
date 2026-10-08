import UIKit
import AVFoundation
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 동화 낭독이 핵심 기능이라 아이패드의 무음 스위치 상태에서도 소리가 나야 한다(기본
        // 카테고리 ambient는 무음 스위치를 따른다). playAndRecord로 두면 아이의 질문 녹음
        // (WKWebView getUserMedia)과 재생을 같은 세션에서 전환 없이 쓴다.
        let session = AVAudioSession.sharedInstance()
        try? session.setCategory(.playAndRecord, mode: .default, options: [.defaultToSpeaker, .allowBluetoothA2DP])
        try? session.setActive(true)

        // FCM 푸시: BE는 FCM 등록 토큰으로만 보낸다. GoogleService-Info.plist는 비밀이라 커밋하지 않고 CI가
        // 넣어 준다(.github/workflows/native-tablet-builds.yml) - 파일이 없는 빌드(로컬·시뮬레이터)에서는
        // Firebase를 켜지 않고, 푸시 등록은 APNs 토큰 그대로 올라간다(BE가 쓰지 못할 뿐 앱은 정상 동작).
        if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
            FirebaseApp.configure()
        }
        return true
    }

    // @capacitor/push-notifications는 iOS에서 APNs 토큰을 그대로 registration으로 올린다. Capacitor 공식 문서
    // "Using Push Notifications with Firebase on iOS" 방식대로 APNs 토큰을 Firebase Messaging에 넘기고, 받은
    // FCM 토큰(String)을 같은 알림으로 올려 JS의 registration 이벤트가 FCM 토큰을 받게 한다.
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        guard FirebaseApp.app() != nil else {
            NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
            return
        }
        Messaging.messaging().apnsToken = deviceToken
        Messaging.messaging().token { token, error in
            if let token = token {
                NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: token)
            } else {
                // FCM 토큰을 못 받으면 APNs 토큰을 올려 봐야 BE가 쓰지 못한다 - registrationError로 알린다.
                NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications,
                                                object: error ?? NSError(domain: "kr.ai.qstory.push", code: -1))
            }
        }
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration",
                                          sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}

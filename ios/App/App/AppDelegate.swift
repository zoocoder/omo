import UIKit
import Capacitor
import AVFoundation
import MediaPlayer
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Configure audio session for background/lock playback
        setupAudioSession()
        
        // Set up remote control events (lock screen controls)
        setupRemoteControlEvents()
        
        return true
    }
    
    private func setupAudioSession() {
        let session = AVAudioSession.sharedInstance()
        do {
            // Use .playback category for background audio
            try session.setCategory(.playback, mode: .default, options: [
                .allowBluetooth,
                .allowBluetoothA2DP,
                .allowAirPlay,
                .defaultToSpeaker
            ])
            try session.setActive(true)
        } catch {
            print("Failed to set up audio session: \(error)")
        }
        
        // Observe interruptions
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioSessionInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }
    
    private func setupRemoteControlEvents() {
        // Begin receiving remote control events
        UIApplication.shared.beginReceivingRemoteControlEvents()
        
        // Set up command center
        let commandCenter = MPRemoteCommandCenter.shared()
        
        commandCenter.playCommand.isEnabled = true
        commandCenter.pauseCommand.isEnabled = true
        commandCenter.nextTrackCommand.isEnabled = true
        commandCenter.previousTrackCommand.isEnabled = true
        
        // These handlers will be triggered by lock screen controls
        commandCenter.playCommand.addTarget { _ in
            // Send message to WebView to play
            DispatchQueue.main.async {
                if let webView = self.findWebView() {
                    webView.evaluateJavaScript("if(window.capacitorPlayAudio) window.capacitorPlayAudio();")
                }
            }
            return .success
        }
        
        commandCenter.pauseCommand.addTarget { _ in
            // Send message to WebView to pause
            DispatchQueue.main.async {
                if let webView = self.findWebView() {
                    webView.evaluateJavaScript("if(window.capacitorPauseAudio) window.capacitorPauseAudio();")
                }
            }
            return .success
        }
        
        commandCenter.nextTrackCommand.addTarget { _ in
            DispatchQueue.main.async {
                if let webView = self.findWebView() {
                    webView.evaluateJavaScript("if(window.capacitorNextTrack) window.capacitorNextTrack();")
                }
            }
            return .success
        }
        
        commandCenter.previousTrackCommand.addTarget { _ in
            DispatchQueue.main.async {
                if let webView = self.findWebView() {
                    webView.evaluateJavaScript("if(window.capacitorPrevTrack) window.capacitorPrevTrack();")
                }
            }
            return .success
        }
    }
    
    func findWebView() -> WKWebView? {
        // Find the Capacitor WebView
        guard let window = UIApplication.shared.windows.first,
              let rootViewController = window.rootViewController else { return nil }
        
        func findWebViewRecursively(in viewController: UIViewController) -> WKWebView? {
            if let capacitorViewController = viewController as? CAPBridgeViewController {
                return capacitorViewController.webView
            }
            
            for child in viewController.children {
                if let webView = findWebViewRecursively(in: child) {
                    return webView
                }
            }
            
            return nil
        }
        
        return findWebViewRecursively(in: rootViewController)
    }

    @objc private func handleAudioSessionInterruption(_ notification: Notification) {
        guard let info = notification.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        
        switch type {
        case .began:
            // Audio interrupted (e.g., phone call)
            break
        case .ended:
            // Reactivate session after interruption
            do {
                try AVAudioSession.sharedInstance().setActive(true)
            } catch {
                print("Failed to reactivate audio session: \(error)")
            }
        @unknown default:
            break
        }
    }

    @objc private func handleAudioRouteChange(_ notification: Notification) {
        // Ensure session stays active on route changes
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("Failed to maintain audio session: \(error)")
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Keep audio session active when going to background
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        // Ensure audio session remains active in background
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { }
    }
    
    func applicationWillEnterForeground(_ application: UIApplication) { }
    
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Reactivate audio session when returning to foreground
        do {
            try AVAudioSession.sharedInstance().setActive(true)
        } catch { }
    }
    
    func applicationWillTerminate(_ application: UIApplication) { }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
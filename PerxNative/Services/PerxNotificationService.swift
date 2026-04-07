import Foundation
import UserNotifications

@MainActor
final class PerxNotificationService {
    static let shared = PerxNotificationService()

    private init() {}

    func requestAuthorizationIfNeeded() async {
        let center = UNUserNotificationCenter.current()
        let settings = await center.notificationSettings()

        if settings.authorizationStatus == .notDetermined {
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])
        }
    }

    func sendClaimNotifications(_ claims: [ClaimItem]) {
        guard !claims.isEmpty else { return }

        let center = UNUserNotificationCenter.current()
        for claim in claims {
            let content = UNMutableNotificationContent()
            content.title = "PERX Claimed at \(claim.locationName)"
            content.body = "+$\(claim.reward) added to your wallet"
            content.sound = .default

            let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
            let request = UNNotificationRequest(
                identifier: "perx-claim-\(claim.id)",
                content: content,
                trigger: trigger
            )
            center.add(request)
        }
    }
}

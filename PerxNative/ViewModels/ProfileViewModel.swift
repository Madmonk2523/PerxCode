import Foundation

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var wallet: Wallet = .empty
    @Published var avatarPath: String?

    private let demoService = DemoModeService.shared
    private let prefsService = ProfilePrefsService.shared

    func load(for email: String?) {
        let allowed = DemoPolicy.isDemoAllowed(email)

        if allowed {
            wallet = demoService.loadWallet()
        } else {
            wallet = .empty
        }

        avatarPath = prefsService.load().avatarPath
    }

    func setAvatarPath(_ path: String?) {
        avatarPath = prefsService.save(avatarPath: path).avatarPath
    }

    var totalLocations: Int {
        demoService.buildInventory(claims: wallet.claims).count
    }

    var streak: Int {
        let keys = Set(wallet.claims.map { dayKey(for: $0) }).sorted(by: >)
        guard !keys.isEmpty else { return 0 }

        var streakCount = 0
        var cursor = Calendar.current.startOfDay(for: Date())

        while true {
            let key = isoDay(cursor)
            if keys.contains(key) {
                streakCount += 1
                guard let prev = Calendar.current.date(byAdding: .day, value: -1, to: cursor) else {
                    break
                }
                cursor = prev
            } else {
                break
            }
        }

        return streakCount
    }

    var totalClaims: Int {
        wallet.claims.count + wallet.redemptions.count
    }

    var totalRedeemed: Int {
        wallet.redemptions.count
    }

    private func dayKey(for claim: ClaimItem) -> String {
        isoDay(Date(timeIntervalSince1970: claim.claimedAt))
    }

    private func isoDay(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withFullDate]
        return formatter.string(from: date)
    }
}

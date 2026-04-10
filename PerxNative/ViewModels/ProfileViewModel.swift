import Foundation

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var wallet: Wallet = .empty
    @Published var avatarPath: String?

    private let demoService = DemoModeService.shared
    private let prefsService = ProfilePrefsService.shared
    private var currentEmail: String?

    func load(for email: String?) {
        currentEmail = normalizedEmail(email)
        demoService.configureScope(email: currentEmail)
        prefsService.configureScope(email: currentEmail)

        let allowed = DemoPolicy.isDemoAllowed(email)

        if allowed {
            wallet = demoService.loadWallet()
        } else {
            wallet = .empty
        }

        avatarPath = prefsService.load().avatarPath
    }

    func setAvatarData(_ data: Data) {
        guard let targetURL = avatarFileURL() else { return }

        do {
            try data.write(to: targetURL, options: [.atomic])
            avatarPath = prefsService.save(avatarPath: targetURL.path).avatarPath
        } catch {
            avatarPath = prefsService.save(avatarPath: nil).avatarPath
        }
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

    private func avatarFileURL() -> URL? {
        let fm = FileManager.default
        guard let baseURL = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
            return nil
        }

        let directory = baseURL.appendingPathComponent("PerxAvatars", isDirectory: true)
        if !fm.fileExists(atPath: directory.path) {
            try? fm.createDirectory(at: directory, withIntermediateDirectories: true)
        }

        let key = accountKey(from: currentEmail)
        return directory.appendingPathComponent("avatar_\(key).jpg")
    }

    private func normalizedEmail(_ email: String?) -> String? {
        let value = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return value.isEmpty ? nil : value
    }

    private func accountKey(from email: String?) -> String {
        let normalized = normalizedEmail(email) ?? "guest"
        let allowed = normalized.filter { $0.isLetter || $0.isNumber }
        return allowed.isEmpty ? "guest" : String(allowed.prefix(48))
    }
}

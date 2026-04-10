import Foundation

@MainActor
final class ProfilePrefsService {
    static let shared = ProfilePrefsService()

    private let profilePrefsKeyBase = "perx_profile_prefs_v1"
    private var activeAccountKey = "guest"
    private init() {}

    func configureScope(email: String?) {
        activeAccountKey = accountKey(from: email)
    }

    func load() -> ProfilePrefs {
        guard let data = UserDefaults.standard.data(forKey: scopedKey(profilePrefsKeyBase)),
              let prefs = try? JSONDecoder().decode(ProfilePrefs.self, from: data) else {
            return .empty
        }
        return prefs
    }

    @discardableResult
    func save(avatarPath: String?) -> ProfilePrefs {
        let next = ProfilePrefs(avatarPath: avatarPath)
        if let data = try? JSONEncoder().encode(next) {
            UserDefaults.standard.set(data, forKey: scopedKey(profilePrefsKeyBase))
        }
        return next
    }

    private func scopedKey(_ base: String) -> String {
        "\(base)_\(activeAccountKey)"
    }

    private func accountKey(from email: String?) -> String {
        let normalized = (email ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        if normalized.isEmpty {
            return "guest"
        }

        let allowed = normalized.filter { $0.isLetter || $0.isNumber }
        if allowed.isEmpty {
            return "guest"
        }

        return String(allowed.prefix(48))
    }
}

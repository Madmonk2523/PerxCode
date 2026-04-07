import Foundation

@MainActor
final class ProfilePrefsService {
    static let shared = ProfilePrefsService()

    private let profilePrefsKey = "perx_profile_prefs_v1"
    private init() {}

    func load() -> ProfilePrefs {
        guard let data = UserDefaults.standard.data(forKey: profilePrefsKey),
              let prefs = try? JSONDecoder().decode(ProfilePrefs.self, from: data) else {
            return .empty
        }
        return prefs
    }

    @discardableResult
    func save(avatarPath: String?) -> ProfilePrefs {
        let next = ProfilePrefs(avatarPath: avatarPath)
        if let data = try? JSONEncoder().encode(next) {
            UserDefaults.standard.set(data, forKey: profilePrefsKey)
        }
        return next
    }
}

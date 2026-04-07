import Foundation

enum DemoPolicy {
    static let allowedEmail = "chasemallor@gmail.com"

    static func isDemoAllowed(_ email: String?) -> Bool {
        (email ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased() == allowedEmail
    }
}
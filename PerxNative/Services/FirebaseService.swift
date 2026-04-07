import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore

enum FirebaseSetupError: LocalizedError {
    case missingGoogleServiceInfo

    var errorDescription: String? {
        switch self {
        case .missingGoogleServiceInfo:
            return "Missing GoogleService-Info.plist. Add it to the PerxNative target to enable login and signup."
        }
    }
}

@MainActor
final class FirebaseService {
    static let shared = FirebaseService()

    private init() {}
    private(set) var isConfigured = false

    var auth: Auth {
        Auth.auth()
    }

    var db: Firestore {
        Firestore.firestore()
    }

    @discardableResult
    func configureIfNeeded() -> Bool {
        if FirebaseApp.app() != nil {
            isConfigured = true
            return true
        }

        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            isConfigured = false
            return false
        }

        FirebaseApp.configure()
        isConfigured = true
        return true
    }

    func signup(email: String, password: String) async throws {
        guard isConfigured else {
            throw FirebaseSetupError.missingGoogleServiceInfo
        }

        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let result = try await auth.createUser(withEmail: cleanEmail, password: password)

        let doc = db.collection("users").document(result.user.uid)
        let existing = try await doc.getDocument()
        if !existing.exists {
            try await doc.setData([
                "email": result.user.email ?? cleanEmail,
                "tokenBalance": 0,
                "createdAt": FieldValue.serverTimestamp()
            ])
        }
    }

    func login(email: String, password: String) async throws {
        guard isConfigured else {
            throw FirebaseSetupError.missingGoogleServiceInfo
        }

        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try await auth.signIn(withEmail: cleanEmail, password: password)
    }

    func logout() throws {
        guard isConfigured else {
            throw FirebaseSetupError.missingGoogleServiceInfo
        }

        try auth.signOut()
    }
}

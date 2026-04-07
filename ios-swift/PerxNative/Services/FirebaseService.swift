import Foundation
import FirebaseCore
import FirebaseAuth
import FirebaseFirestore

@MainActor
final class FirebaseService {
    static let shared = FirebaseService()

    private init() {}

    var auth: Auth {
        Auth.auth()
    }

    var db: Firestore {
        Firestore.firestore()
    }

    func configureIfNeeded() {
        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
    }

    func signup(email: String, password: String) async throws {
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
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try await auth.signIn(withEmail: cleanEmail, password: password)
    }

    func logout() throws {
        try auth.signOut()
    }
}

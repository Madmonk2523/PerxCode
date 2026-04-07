import Foundation
import FirebaseAuth

@MainActor
final class AppSessionViewModel: ObservableObject {
    enum SessionState {
        case loading
        case loggedOut
        case loggedIn
    }

    @Published var state: SessionState = .loading
    @Published var currentUser: User?

    private var authListener: AuthStateDidChangeListenerHandle?

    init() {
        FirebaseService.shared.configureIfNeeded()
        startAuthListener()
    }

    deinit {
        if let authListener {
            Auth.auth().removeStateDidChangeListener(authListener)
        }
    }

    func login(email: String, password: String) async throws {
        try await FirebaseService.shared.login(email: email, password: password)
    }

    func signup(email: String, password: String) async throws {
        try await FirebaseService.shared.signup(email: email, password: password)
    }

    func logout() throws {
        try FirebaseService.shared.logout()
    }

    private func startAuthListener() {
        authListener = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            guard let self else { return }
            self.currentUser = user
            self.state = user == nil ? .loggedOut : .loggedIn
        }
    }
}

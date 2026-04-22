import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: AppSessionViewModel

    var body: some View {
        Group {
            switch session.state {
            case .loading:
                ProgressView()
                    .tint(PerxTheme.primary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(PerxTheme.appBackground.ignoresSafeArea())
            case .loggedOut:
                AuthRootView()
            case .loggedIn:
                MainTabView()
            }
        }
    }
}

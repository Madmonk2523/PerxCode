import SwiftUI

struct AuthRootView: View {
    var body: some View {
        NavigationStack {
            LoginView()
                .navigationBarTitleDisplayMode(.inline)
        }
        .tint(.white)
        .background(PerxTheme.appBackground.ignoresSafeArea())
    }
}

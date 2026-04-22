import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            MapScreenView()
                .tabItem {
                    Label("Map", systemImage: "map")
                }

            WalletScreenView()
                .tabItem {
                    Label("Wallet", systemImage: "wallet.pass")
                }

            ProfileScreenView()
                .tabItem {
                    Label("Profile", systemImage: "person.crop.circle")
                }
        }
        .tint(PerxTheme.primary)
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor.white
            appearance.shadowColor = UIColor.black.withAlphaComponent(0.08)
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}

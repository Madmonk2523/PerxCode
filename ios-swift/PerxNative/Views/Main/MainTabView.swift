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
        .tint(.white)
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(red: 0.043, green: 0.043, blue: 0.059, alpha: 1)
            appearance.shadowColor = UIColor.white.withAlphaComponent(0.1)
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}

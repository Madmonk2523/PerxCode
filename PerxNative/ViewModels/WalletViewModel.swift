import Foundation

@MainActor
final class WalletViewModel: ObservableObject {
    @Published var wallet: Wallet = .empty
    @Published var selectedReward: ClaimItem?

    private let demoService = DemoModeService.shared

    func load(for email: String?) {
        demoService.configureScope(email: email)
        let allowed = isDemoAllowed(email)
        if !allowed {
            wallet = .empty
            return
        }
        wallet = demoService.loadWallet()
    }

    var inventory: [InventoryItem] {
        demoService.buildInventory(claims: wallet.claims)
    }

    var redeemed: [ClaimItem] {
        wallet.redemptions
    }

    var expired: [ClaimItem] {
        wallet.expiredClaims
    }

    func openReward(_ reward: ClaimItem) {
        selectedReward = reward
    }

    func closeRewardAndRedeem() {
        guard let reward = selectedReward else { return }
        wallet = demoService.redeemWalletLocation(reward.locationId)
        selectedReward = nil
    }

    private func isDemoAllowed(_ email: String?) -> Bool {
        DemoPolicy.isDemoAllowed(email)
    }
}

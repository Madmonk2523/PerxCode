import SwiftUI

struct WalletScreenView: View {
    @EnvironmentObject private var session: AppSessionViewModel
    @StateObject private var vm = WalletViewModel()

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    header
                    balanceCard
                    noticeCard

                    Text("Inventory")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(red: 0.886, green: 0.91, blue: 0.941))
                        .tracking(1.1)
                        .padding(.top, 6)

                    if vm.inventory.isEmpty {
                        emptyCard(title: "No inventory yet", body: "Claim rewards on the map to populate this inventory.")
                    } else {
                        ForEach(vm.inventory) { item in
                            inventoryRow(item)
                        }
                    }

                    Text("Redeemed")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(red: 0.886, green: 0.91, blue: 0.941))
                        .tracking(1.1)
                        .padding(.top, 8)

                    if vm.redeemed.isEmpty {
                        subtleEmpty("No redeemed PERX yet.")
                    } else {
                        historyCard(vm.redeemed.prefix(10).map { $0 }, kind: .redeemed)
                    }

                    Text("Expired")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(red: 0.886, green: 0.91, blue: 0.941))
                        .tracking(1.1)
                        .padding(.top, 8)

                    if vm.expired.isEmpty {
                        subtleEmpty("No expired PERX right now.")
                    } else {
                        historyCard(vm.expired.prefix(10).map { $0 }, kind: .expired)
                    }
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
            .background(PerxTheme.appBackground.ignoresSafeArea())
            .navigationTitle("Wallet")
            .navigationBarTitleDisplayMode(.large)
            .sheet(item: $vm.selectedReward) { reward in
                RedemptionSheet(reward: reward) {
                    vm.closeRewardAndRedeem()
                }
                .presentationDetents([.large])
            }
            .onAppear {
                vm.load(for: session.currentUser?.email)
            }
        }
    }

    private var header: some View {
        Text("Inventory of your PERX by location")
            .font(.system(size: 14, weight: .regular))
            .foregroundStyle(PerxTheme.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var balanceCard: some View {
        VStack(spacing: 4) {
            Text("Total PERX")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(PerxTheme.textSecondary)
            Text("\(vm.wallet.balance)")
                .font(.system(size: 52, weight: .black))
                .foregroundStyle(.white)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            Text("Across all locations")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(Color(red: 0.576, green: 0.773, blue: 0.992))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 22)
        .background(PerxTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .overlay {
            RoundedRectangle(cornerRadius: 20)
                .stroke(Color(red: 0.145, green: 0.388, blue: 0.922).opacity(0.5), lineWidth: 1)
        }
    }

    private var noticeCard: some View {
        Text("Each location's PERX is only usable at that specific location.")
            .font(.system(size: 12, weight: .regular))
            .foregroundStyle(Color(red: 0.859, green: 0.918, blue: 0.996))
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(red: 0.231, green: 0.51, blue: 0.98).opacity(0.12))
            .clipShape(RoundedRectangle(cornerRadius: 14))
            .overlay {
                RoundedRectangle(cornerRadius: 14)
                    .stroke(Color(red: 0.576, green: 0.773, blue: 0.992).opacity(0.35), lineWidth: 1)
            }
    }

    private func inventoryRow(_ item: InventoryItem) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Rectangle()
                .fill(Color(red: 0.376, green: 0.647, blue: 0.98))
                .frame(width: 4)
                .clipShape(RoundedRectangle(cornerRadius: 8))

            VStack(alignment: .leading, spacing: 4) {
                Text("PARTNER LOCATION")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Color(red: 0.576, green: 0.773, blue: 0.992))
                Text(item.locationName)
                    .font(.system(size: 16, weight: .black))
                    .foregroundStyle(.white)
                Text("Usable only at \(item.locationName)")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundStyle(Color(red: 0.659, green: 0.698, blue: 0.773))
            }

            Spacer(minLength: 8)

            VStack(alignment: .trailing, spacing: 4) {
                Text("PERX")
                    .font(.system(size: 10, weight: .black))
                    .foregroundStyle(Color(red: 0.525, green: 0.937, blue: 0.675))
                Text("\(item.quantity)")
                    .font(.system(size: 26, weight: .black))
                    .foregroundStyle(.white)
                Button("Use Reward") {
                    if let claim = item.claims.first {
                        vm.openReward(claim)
                    }
                }
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(.white)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(PerxTheme.primary)
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }
        }
        .padding(14)
        .background(Color(red: 0.063, green: 0.086, blue: 0.133))
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color(red: 0.576, green: 0.773, blue: 0.992).opacity(0.2), lineWidth: 1)
        }
    }

    private func emptyCard(title: String, body: String) -> some View {
        VStack(spacing: 6) {
            Text(title)
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(.white)
            Text(body)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(PerxTheme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.vertical, 20)
        .frame(maxWidth: .infinity)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func subtleEmpty(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 13, weight: .semibold))
            .foregroundStyle(PerxTheme.textSecondary)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .center)
            .background(Color.white.opacity(0.04))
            .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func historyCard(_ items: [ClaimItem], kind: HistoryKind) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(item.locationName)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.white)
                        Text(formatDate(kind == .redeemed ? item.redeemedAt : item.expiredAt))
                            .font(.system(size: 12, weight: .regular))
                            .foregroundStyle(PerxTheme.textSecondary)
                    }
                    Spacer()
                    Text(kind == .redeemed ? "-$\(item.reward)" : "$\(item.reward)")
                        .font(.system(size: 14, weight: .black))
                        .foregroundStyle(kind == .redeemed ? Color.orange : Color(red: 0.525, green: 0.937, blue: 0.675))
                }
                .padding(.vertical, 10)

                if index < items.count - 1 {
                    Divider().overlay(Color.white.opacity(0.08))
                }
            }
        }
        .padding(.horizontal, 12)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private func formatDate(_ value: TimeInterval?) -> String {
        guard let value else { return "Just now" }
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter.string(from: Date(timeIntervalSince1970: value))
    }

    private enum HistoryKind {
        case redeemed
        case expired
    }
}

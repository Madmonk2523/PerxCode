import SwiftUI
import PhotosUI

struct ProfileScreenView: View {
    @EnvironmentObject private var session: AppSessionViewModel
    @StateObject private var vm = ProfileViewModel()

    @State private var selectedPhotoItem: PhotosPickerItem?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    heroCard
                    statsGrid
                    rulesCard
                    achievementsCard
                    logoutButton
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 12)
            }
            .background(PerxTheme.appBackground.ignoresSafeArea())
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .onAppear {
                vm.load(for: session.currentUser?.email)
            }
            .onChange(of: selectedPhotoItem) { _, newItem in
                guard let newItem else { return }
                Task {
                    if let data = try? await newItem.loadTransferable(type: Data.self) {
                        let fileName = "perx-avatar-\(Int(Date().timeIntervalSince1970)).jpg"
                        let targetURL = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
                        try? data.write(to: targetURL)
                        vm.setAvatarPath(targetURL.path)
                    }
                }
            }
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                avatar

                VStack(alignment: .leading, spacing: 4) {
                    Text(session.currentUser?.email ?? "No email")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white)
                        .lineLimit(1)
                    Text("Member since \(memberYear)")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(PerxTheme.textSecondary)
                }
                Spacer()
            }

            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                Text("Edit Profile Picture")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(PerxTheme.primary)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .padding(14)
        .background(PerxTheme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 22))
        .overlay {
            RoundedRectangle(cornerRadius: 22)
                .stroke(Color.white.opacity(0.1), lineWidth: 1)
        }
    }

    private var avatar: some View {
        Group {
            if let avatarPath = vm.avatarPath,
               let image = UIImage(contentsOfFile: avatarPath) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                Text(initial)
                    .font(.system(size: 34, weight: .black))
                    .foregroundStyle(.white)
            }
        }
        .frame(width: 86, height: 86)
        .background(Color(red: 0.114, green: 0.306, blue: 0.847))
        .clipShape(Circle())
    }

    private var statsGrid: some View {
        let cells: [(String, String)] = [
            ("Balance", "\(vm.wallet.balance)"),
            ("Streak", "\(vm.streak)d"),
            ("Locations", "\(vm.totalLocations)"),
            ("Redeemed", "\(vm.totalRedeemed)")
        ]

        return LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            ForEach(Array(cells.enumerated()), id: \.offset) { _, item in
                VStack(spacing: 4) {
                    Text(item.0)
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(PerxTheme.textSecondary)
                    Text(item.1)
                        .font(.system(size: 24, weight: .black))
                        .foregroundStyle(.white)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 14))
            }
        }
    }

    private var rulesCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Rules")
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(.white)
            Text("1. Enter a location radius to claim PERX automatically.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(PerxTheme.textSecondary)
            Text("2. Each location has a cooldown before you can claim there again.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(PerxTheme.textSecondary)
            Text("3. Open Wallet to redeem claimed PERX before expiration.")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(PerxTheme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var achievementsCard: some View {
        let achievements: [(String, String, Bool)] = [
            ("First Claim", "Claim your first PERX", vm.totalClaims >= 1),
            ("Explorer", "Claim at 5 locations", vm.totalLocations >= 5),
            ("On Fire", "Maintain a 3-day streak", vm.streak >= 3),
            ("Redemption Pro", "Redeem 5 rewards", vm.totalRedeemed >= 5)
        ]

        return VStack(alignment: .leading, spacing: 10) {
            Text("Achievements")
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(.white)

            ForEach(Array(achievements.enumerated()), id: \.offset) { _, item in
                HStack(spacing: 10) {
                    Circle()
                        .fill(item.2 ? Color.green : Color.gray.opacity(0.5))
                        .frame(width: 10, height: 10)

                    VStack(alignment: .leading, spacing: 2) {
                        Text(item.0)
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(item.2 ? Color.green : .white)
                        Text(item.1)
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(PerxTheme.textSecondary)
                    }

                    Spacer()

                    Text(item.2 ? "Unlocked" : "Locked")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(item.2 ? Color.green : PerxTheme.textSecondary)
                }
                .padding(.vertical, 2)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 14))
    }

    private var logoutButton: some View {
        Button(role: .destructive) {
            do {
                try session.logout()
            } catch {
                // Keep the UI responsive even if sign out fails.
            }
        } label: {
            Text("Logout")
                .font(.system(size: 15, weight: .black))
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(Color.red.opacity(0.75))
                .clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }

    private var memberYear: String {
        if let creationDate = session.currentUser?.metadata.creationDate {
            return String(Calendar.current.component(.year, from: creationDate))
        }
        return String(Calendar.current.component(.year, from: Date()))
    }

    private var initial: String {
        String((session.currentUser?.email?.first ?? "P")).uppercased()
    }
}

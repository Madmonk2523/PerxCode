import SwiftUI

struct RewardLocationSheet: View {
    let location: RewardLocation
    let distanceText: String
    let claimed: Bool
    let cooldownText: String

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PERX Spot")
                .font(.system(size: 11, weight: .heavy))
                .foregroundStyle(Color(red: 0.576, green: 0.773, blue: 0.992))

            Text(location.name)
                .font(.system(size: 30, weight: .black))
                .foregroundStyle(.white)

            HStack {
                chip("Reward", "$\(location.reward)")
                chip("Distance", distanceText)
                chip("Radius", "\(Int(location.radiusMeters))m")
            }

            VStack(alignment: .leading, spacing: 6) {
                Text(claimed ? "Cooldown active" : "Ready to claim")
                    .font(.system(size: 16, weight: .heavy))
                    .foregroundStyle(claimed ? Color.orange : Color.green)
                if claimed {
                    Text("Available again in \(cooldownText)")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color(red: 0.85, green: 0.86, blue: 0.88))
                } else {
                    Text("Move into radius and auto-claim will add PERX to your wallet.")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color(red: 0.85, green: 0.86, blue: 0.88))
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 14))

            Spacer(minLength: 0)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(PerxTheme.cardBackground)
    }

    private func chip(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color(red: 0.71, green: 0.74, blue: 0.78))
            Text(value)
                .font(.system(size: 13, weight: .heavy))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}

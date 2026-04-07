import SwiftUI

struct RedemptionSheet: View {
    let reward: ClaimItem
    let onRedeem: () -> Void

    @State private var now = Date().timeIntervalSince1970

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("READY TO REDEEM")
                        .font(.system(size: 11, weight: .black))
                        .foregroundStyle(Color(red: 0.576, green: 0.773, blue: 0.992))
                    Spacer()
                }

                Text("Redeem Your Reward")
                    .font(.system(size: 30, weight: .black))
                    .foregroundStyle(.white)

                Text(reward.locationName)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(Color(red: 0.796, green: 0.835, blue: 0.882))

                VStack(alignment: .leading, spacing: 8) {
                    Text("Current reward value")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(red: 0.749, green: 0.859, blue: 0.996))

                    HStack(alignment: .lastTextBaseline, spacing: 4) {
                        Text("$")
                            .font(.system(size: 26, weight: .black))
                        Text("\(reward.reward)")
                            .font(.system(size: 48, weight: .black))
                        Text("OFF")
                            .font(.system(size: 14, weight: .black))
                            .tracking(1.1)
                            .padding(.bottom, 8)
                    }
                    .foregroundStyle(.white)

                    Text("Apply this at checkout before payment is processed.")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color(red: 0.859, green: 0.918, blue: 0.996))
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(red: 0.09, green: 0.141, blue: 0.231))
                .clipShape(RoundedRectangle(cornerRadius: 22))
                .overlay {
                    RoundedRectangle(cornerRadius: 22)
                        .stroke(Color(red: 0.576, green: 0.773, blue: 0.992).opacity(0.35), lineWidth: 1)
                }

                VStack(spacing: 8) {
                    Text("Show this code to staff")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(Color(red: 0.796, green: 0.835, blue: 0.882))
                    Text(reward.code)
                        .font(.system(size: 36, weight: .black, design: .monospaced))
                        .foregroundStyle(.white)
                    Text("Expires in \(countdown)")
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(remainingSeconds <= 60 ? Color.red.opacity(0.9) : Color(red: 0.576, green: 0.773, blue: 0.992))
                }
                .padding(.vertical, 16)
                .frame(maxWidth: .infinity)
                .background(Color.white.opacity(0.06))
                .clipShape(RoundedRectangle(cornerRadius: 18))

                Button {
                    onRedeem()
                } label: {
                    Text("Redeem Reward")
                        .font(.system(size: 15, weight: .black))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Color.red.opacity(0.82))
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(16)
        }
        .background(PerxTheme.cardBackground.ignoresSafeArea())
        .onReceive(Timer.publish(every: 1, on: .main, in: .common).autoconnect()) { _ in
            now = Date().timeIntervalSince1970
        }
    }

    private var remainingSeconds: Int {
        max(0, Int(ceil(reward.expiresAt - now)))
    }

    private var countdown: String {
        let min = String(format: "%02d", remainingSeconds / 60)
        let sec = String(format: "%02d", remainingSeconds % 60)
        return "\(min):\(sec)"
    }
}

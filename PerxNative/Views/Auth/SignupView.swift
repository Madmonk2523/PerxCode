import SwiftUI

struct SignupView: View {
    @EnvironmentObject private var session: AppSessionViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var email = ""
    @State private var password = ""
    @State private var loading = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("PERX")
                    .font(.system(size: 42, weight: .black))
                    .foregroundStyle(.white)
                    .tracking(1.1)

                Text("Create your account and start unlocking map zones.")
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(PerxTheme.textSecondary)
                    .padding(.bottom, 8)

                VStack(alignment: .leading, spacing: 10) {
                    Text("Email")
                        .foregroundStyle(Color(red: 0.82, green: 0.84, blue: 0.86))
                        .font(.system(size: 13, weight: .semibold))

                    TextField("you@perx.app", text: $email)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.emailAddress)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(Color(red: 0.059, green: 0.067, blue: 0.094))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                    Text("Password")
                        .foregroundStyle(Color(red: 0.82, green: 0.84, blue: 0.86))
                        .font(.system(size: 13, weight: .semibold))
                        .padding(.top, 4)

                    SecureField("Min. 6 characters", text: $password)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 12)
                        .background(Color(red: 0.059, green: 0.067, blue: 0.094))
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 16))

                    Button {
                        Task { await onSignup() }
                    } label: {
                        Text(loading ? "Creating account..." : "Create Account")
                            .font(.system(size: 15, weight: .heavy))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(PerxTheme.primary)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                            .opacity(loading ? 0.65 : 1)
                    }
                    .disabled(loading)
                }
                .padding(16)
                .background(PerxTheme.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .overlay {
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.white.opacity(0.1), lineWidth: 1)
                }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundStyle(.red)
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.top, 2)
                }

                Button {
                    dismiss()
                } label: {
                    Text("Already have an account? Login")
                        .foregroundStyle(Color(red: 0.61, green: 0.64, blue: 0.69))
                        .font(.system(size: 14, weight: .regular))
                        .frame(maxWidth: .infinity, alignment: .center)
                        .padding(.top, 4)
                }
            }
            .padding(.horizontal, 24)
            .padding(.vertical, 22)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
            .frame(minHeight: UIScreen.main.bounds.height)
        }
        .background(PerxTheme.appBackground.ignoresSafeArea())
    }

    private func onSignup() async {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !cleanEmail.isEmpty, !password.isEmpty else {
            errorMessage = "Enter your email and password to continue."
            return
        }

        guard password.count >= 6 else {
            errorMessage = "Use at least 6 characters."
            return
        }

        loading = true
        defer { loading = false }

        do {
            try await session.signup(email: cleanEmail, password: password)
            errorMessage = nil
            dismiss()
        } catch {
            errorMessage = normalizeError(error.localizedDescription)
        }
    }

    private func normalizeError(_ message: String) -> String {
        let lower = message.lowercased()
        if lower.contains("googleservice-info") || (lower.contains("missing") && lower.contains("plist")) {
            return "Missing GoogleService-Info.plist in the app target. Add it in Xcode to enable authentication."
        }
        if lower.contains("already") { return "This email is already registered." }
        if lower.contains("invalid") { return "Please enter a valid email." }
        if lower.contains("network") { return "Network issue. Check your connection." }
        return "Something went wrong. Please try again."
    }
}

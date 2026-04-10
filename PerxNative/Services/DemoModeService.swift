import Foundation
import CoreLocation

@MainActor
final class DemoModeService {
    static let shared = DemoModeService()

    private init() {}

    private let demoModeKeyBase = "perx_demo_mode_v1"
    private let demoWalletKeyBase = "perx_demo_wallet_v1"
    private let demoAnchorKeyBase = "perx_demo_anchor_v1"
    private let sessionStateKeyBase = "perx_demo_session_state_v1"

    private let sessionMax = 25
    let locationCooldownSeconds: TimeInterval = 60

    private var sessionClaimedLocationAt: [String: TimeInterval] = [:]
    private var sessionClaimTotal = 0
    private var activeAccountKey = "guest"

    let demoCenter = CLLocationCoordinate2D(latitude: 19.3206, longitude: -81.3845)

    private let baseNames = [
        "Lobby Cafe",
        "Pool Bar",
        "Beach Grill",
        "Sushi Bar",
        "Ice Cream",
        "Gift Shop"
    ]

    private struct PersistedSessionState: Codable {
        var claimedAtByLocation: [String: TimeInterval]
        var totalClaimed: Int
    }

    func configureScope(email: String?) {
        let nextKey = accountKey(from: email)
        guard nextKey != activeAccountKey else { return }

        saveSessionState()
        activeAccountKey = nextKey
        restoreSessionState()
    }

    func buildWalkableDemoLocations(center: CLLocationCoordinate2D? = nil) -> [RewardLocation] {
        let origin = center ?? demoCenter
        var locations: [RewardLocation] = []

        for i in 0..<50 {
            let ring = i / 10
            let step = i % 10
            let radius = 26 + (ring * 28) + ((step % 2) * 6)
            let angle = ((Double(step * 36 + ring * 11)) * Double.pi) / 180
            let east = cos(angle) * Double(radius)
            let north = sin(angle) * Double(radius)
            let coord = metersToLatLng(center: origin, eastMeters: east, northMeters: north)
            let base = baseNames[i % baseNames.count]

            locations.append(
                RewardLocation(
                    id: String(format: "demo_%02d", i + 1),
                    name: "\(base) \(i + 1)",
                    reward: (i % 3) + 1,
                    latitude: coord.latitude,
                    longitude: coord.longitude,
                    radiusMeters: 22
                )
            )
        }

        return locations
    }

    func isWithinRadius(user: CLLocationCoordinate2D, location: RewardLocation) -> Bool {
        distance(user: user, target: location.coordinate) <= location.radiusMeters
    }

    func distance(user: CLLocationCoordinate2D, target: CLLocationCoordinate2D) -> CLLocationDistance {
        let a = CLLocation(latitude: user.latitude, longitude: user.longitude)
        let b = CLLocation(latitude: target.latitude, longitude: target.longitude)
        return a.distance(from: b)
    }

    func loadDemoMode() -> Bool {
        let key = scopedKey(demoModeKeyBase)
        if UserDefaults.standard.object(forKey: key) == nil {
            return true
        }
        return UserDefaults.standard.bool(forKey: key)
    }

    func setDemoMode(_ value: Bool) {
        UserDefaults.standard.set(value, forKey: scopedKey(demoModeKeyBase))
    }

    func saveDemoAnchor(_ coordinate: CLLocationCoordinate2D) {
        let payload: [String: Double] = [
            "latitude": coordinate.latitude,
            "longitude": coordinate.longitude
        ]
        if let data = try? JSONEncoder().encode(payload) {
            UserDefaults.standard.set(data, forKey: scopedKey(demoAnchorKeyBase))
        }
    }

    func loadDemoAnchor() -> CLLocationCoordinate2D? {
        guard let data = UserDefaults.standard.data(forKey: scopedKey(demoAnchorKeyBase)),
              let payload = try? JSONDecoder().decode([String: Double].self, from: data),
              let latitude = payload["latitude"],
              let longitude = payload["longitude"] else {
            return nil
        }
        return CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }

    func loadWallet() -> Wallet {
        guard let data = UserDefaults.standard.data(forKey: scopedKey(demoWalletKeyBase)),
              var wallet = try? JSONDecoder().decode(Wallet.self, from: data) else {
            return .empty
        }

        let now = Date().timeIntervalSince1970
        var active: [ClaimItem] = []
        var newlyExpired: [ClaimItem] = []

        for claim in wallet.claims {
            if claim.expiresAt > 0, claim.expiresAt <= now {
                var expired = claim
                expired.expiredAt = now
                newlyExpired.append(expired)
            } else {
                active.append(claim)
            }
        }

        wallet.claims = active
        wallet.expiredClaims = newlyExpired + wallet.expiredClaims
        wallet.balance = computeBalance(wallet.claims)

        if !newlyExpired.isEmpty {
            saveWallet(wallet)
        }

        return wallet
    }

    func redeemWalletLocation(_ locationId: String) -> Wallet {
        var wallet = loadWallet()
        let removed = wallet.claims.filter { $0.locationId == locationId }
        guard !removed.isEmpty else { return wallet }

        wallet.claims.removeAll { $0.locationId == locationId }
        wallet.balance = computeBalance(wallet.claims)

        let now = Date().timeIntervalSince1970
        let redeemed = removed.map { claim -> ClaimItem in
            var value = claim
            value.redeemedAt = now
            return value
        }

        wallet.redemptions = redeemed + wallet.redemptions
        saveWallet(wallet)
        return wallet
    }

    func claimNearbyRewards(
        userCoords: CLLocationCoordinate2D,
        locations: [RewardLocation],
        demoModeEnabled: Bool,
        maxClaimsPerPass: Int = 3
    ) -> (claims: [ClaimItem], wallet: Wallet, session: SessionState) {
        var claims: [ClaimItem] = []
        var wallet = loadWallet()
        var session = getSessionState()

        for location in locations {
            if claims.count >= maxClaimsPerPass || session.remaining <= 0 {
                break
            }

            let result = claimReward(location: location, userCoords: userCoords, demoModeEnabled: demoModeEnabled)
            if result.ok, let claim = result.claim {
                claims.append(claim)
                wallet = result.wallet
                session = result.session
            }
        }

        return (claims, wallet, session)
    }

    func getSessionState() -> SessionState {
        let now = Date().timeIntervalSince1970
        sessionClaimedLocationAt = sessionClaimedLocationAt.filter { now - $0.value < locationCooldownSeconds }
        saveSessionState()

        return SessionState(
            totalClaimed: sessionClaimTotal,
            remaining: max(0, sessionMax - sessionClaimTotal),
            claimedLocationIds: Array(sessionClaimedLocationAt.keys)
        )
    }

    func getLocationCooldownRemainingSeconds(_ locationId: String) -> TimeInterval {
        guard let claimedAt = sessionClaimedLocationAt[locationId] else { return 0 }
        let elapsed = Date().timeIntervalSince1970 - claimedAt
        return max(0, locationCooldownSeconds - elapsed)
    }

    func buildInventory(claims: [ClaimItem]) -> [InventoryItem] {
        let grouped = Dictionary(grouping: claims) { claim in
            claim.locationId
        }

        let inventory = grouped.map { key, values -> InventoryItem in
            InventoryItem(
                id: key,
                locationId: key,
                locationName: values.first?.locationName ?? "Unknown",
                quantity: values.reduce(0, { $0 + $1.reward }),
                claims: values
            )
        }

        return inventory.sorted { $0.quantity > $1.quantity }
    }

    private func claimReward(
        location: RewardLocation,
        userCoords: CLLocationCoordinate2D,
        demoModeEnabled: Bool
    ) -> (ok: Bool, claim: ClaimItem?, wallet: Wallet, session: SessionState) {
        guard isWithinRadius(user: userCoords, location: location) else {
            return (false, nil, loadWallet(), getSessionState())
        }

        let now = Date().timeIntervalSince1970
        let lastClaimAt = sessionClaimedLocationAt[location.id] ?? 0
        let elapsed = now - lastClaimAt

        if elapsed < locationCooldownSeconds {
            return (false, nil, loadWallet(), getSessionState())
        }

        if sessionClaimTotal >= sessionMax {
            return (false, nil, loadWallet(), getSessionState())
        }

        let allowedReward = max(0, min(location.reward, sessionMax - sessionClaimTotal))
        guard allowedReward > 0 else {
            return (false, nil, loadWallet(), getSessionState())
        }

        let claim = ClaimItem(
            id: "\(location.id)-\(Int(now))",
            locationId: location.id,
            locationName: location.name,
            reward: allowedReward,
            code: randomCode(),
            claimedAt: now,
            expiresAt: now + (5 * 60),
            demoMode: demoModeEnabled,
            redeemedAt: nil,
            expiredAt: nil
        )

        var wallet = loadWallet()
        wallet.claims.insert(claim, at: 0)
        wallet.balance = computeBalance(wallet.claims)
        saveWallet(wallet)

        sessionClaimedLocationAt[location.id] = now
        sessionClaimTotal += allowedReward
        saveSessionState()

        return (true, claim, wallet, getSessionState())
    }

    private func saveWallet(_ wallet: Wallet) {
        if let data = try? JSONEncoder().encode(wallet) {
            UserDefaults.standard.set(data, forKey: scopedKey(demoWalletKeyBase))
        }
    }

    private func saveSessionState() {
        let payload = PersistedSessionState(
            claimedAtByLocation: sessionClaimedLocationAt,
            totalClaimed: sessionClaimTotal
        )

        if let data = try? JSONEncoder().encode(payload) {
            UserDefaults.standard.set(data, forKey: scopedKey(sessionStateKeyBase))
        }
    }

    private func restoreSessionState() {
        guard let data = UserDefaults.standard.data(forKey: scopedKey(sessionStateKeyBase)),
              let payload = try? JSONDecoder().decode(PersistedSessionState.self, from: data) else {
            sessionClaimedLocationAt = [:]
            sessionClaimTotal = 0
            return
        }

        sessionClaimedLocationAt = payload.claimedAtByLocation
        sessionClaimTotal = payload.totalClaimed
    }

    private func scopedKey(_ base: String) -> String {
        "\(base)_\(activeAccountKey)"
    }

    private func accountKey(from email: String?) -> String {
        let normalized = (email ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()

        if normalized.isEmpty {
            return "guest"
        }

        let allowed = normalized.filter { $0.isLetter || $0.isNumber }
        if allowed.isEmpty {
            return "guest"
        }

        return String(allowed.prefix(48))
    }

    private func computeBalance(_ claims: [ClaimItem]) -> Int {
        claims.reduce(0) { $0 + $1.reward }
    }

    private func randomCode() -> String {
        "PERX-\(Int.random(in: 1000...9999))"
    }

    private func metersToLatLng(
        center: CLLocationCoordinate2D,
        eastMeters: Double,
        northMeters: Double
    ) -> CLLocationCoordinate2D {
        let latDelta = northMeters / 111_111
        let lngDelta = eastMeters / (111_111 * cos((center.latitude * .pi) / 180))
        return CLLocationCoordinate2D(
            latitude: center.latitude + latDelta,
            longitude: center.longitude + lngDelta
        )
    }
}

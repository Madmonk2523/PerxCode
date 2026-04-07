import Foundation
import CoreLocation

struct RewardLocation: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let reward: Int
    let latitude: Double
    let longitude: Double
    let radiusMeters: Double

    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

struct ClaimItem: Identifiable, Codable, Hashable {
    let id: String
    let locationId: String
    let locationName: String
    let reward: Int
    let code: String
    let claimedAt: TimeInterval
    let expiresAt: TimeInterval
    let demoMode: Bool
    var redeemedAt: TimeInterval?
    var expiredAt: TimeInterval?
}

struct Wallet: Codable {
    var balance: Int
    var claims: [ClaimItem]
    var redemptions: [ClaimItem]
    var expiredClaims: [ClaimItem]

    static let empty = Wallet(balance: 0, claims: [], redemptions: [], expiredClaims: [])
}

struct InventoryItem: Identifiable, Hashable {
    let id: String
    let locationId: String
    let locationName: String
    let quantity: Int
    let claims: [ClaimItem]
}

struct SessionState {
    var totalClaimed: Int
    var remaining: Int
    var claimedLocationIds: [String]
}

struct ProfilePrefs: Codable {
    var avatarPath: String?

    static let empty = ProfilePrefs(avatarPath: nil)
}

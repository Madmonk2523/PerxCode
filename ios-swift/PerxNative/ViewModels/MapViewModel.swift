import Foundation
import CoreLocation
import MapKit

@MainActor
final class MapViewModel: NSObject, ObservableObject {
    @Published var userLocation: CLLocationCoordinate2D?
    @Published var anchorLocation: CLLocationCoordinate2D?
    @Published var selectedLocation: RewardLocation?
    @Published var sheetVisible = false
    @Published var loadingLocation = true
    @Published var permissionDenied = false
    @Published var demoModeOn = false
    @Published var walletBalance = 0
    @Published var claimedThisSession: [String] = []
    @Published var sessionRemaining = 25
    @Published var autoClaiming = false
    @Published var toastMessage: String?
    @Published var teleportArmed = false
    @Published var cameraPosition: MapCameraPosition = .automatic
    @Published private(set) var canUseDemoTools = false

    private let demoService = DemoModeService.shared
    private let notificationService = PerxNotificationService.shared
    private let locationManager = CLLocationManager()
    private var autoClaimTimer: Timer?
    private var sessionTimer: Timer?
    private var overrideUntil: TimeInterval = 0
    private var bootstrapped = false
    private var sceneActive = true
    private var currentUserEmail = ""

    var markerPoints: [RewardLocation] {
        demoService.buildWalkableDemoLocations(center: anchorLocation)
    }

    func bootstrap(for email: String?) {
        guard !bootstrapped else { return }
        bootstrapped = true

        currentUserEmail = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let demoAllowed = DemoPolicy.isDemoAllowed(currentUserEmail)
        canUseDemoTools = demoAllowed

        demoModeOn = demoAllowed ? demoService.loadDemoMode() : false

        if let savedAnchor = demoService.loadDemoAnchor() {
            anchorLocation = savedAnchor
        }

        let wallet = demoService.loadWallet()
        walletBalance = wallet.balance

        let session = demoService.getSessionState()
        claimedThisSession = session.claimedLocationIds
        sessionRemaining = session.remaining

        Task {
            await notificationService.requestAuthorizationIfNeeded()
        }

        startLocationTracking()
        startSessionTick()
        startAutoClaimTick()
    }

    func teardown() {
        stopTickers()
        locationManager.stopUpdatingLocation()
        bootstrapped = false
    }

    deinit {
        autoClaimTimer?.invalidate()
        sessionTimer?.invalidate()
    }

    func setDemoMode(_ value: Bool) {
        guard canUseDemoTools else {
            demoModeOn = false
            return
        }

        demoModeOn = value
        demoService.setDemoMode(value)
        if !value {
            teleportArmed = false
        }
    }

    func setSceneActive(_ value: Bool) {
        sceneActive = value

        if value {
            startLocationTracking()
            startSessionTick()
            startAutoClaimTick()
        } else {
            stopTickers()
        }
    }

    func selectLocation(_ location: RewardLocation) {
        selectedLocation = location
        sheetVisible = true
        teleportArmed = false
        cameraPosition = .camera(
            MapCamera(
                centerCoordinate: location.coordinate,
                distance: 300,
                heading: 0,
                pitch: 35
            )
        )
    }

    func centerOnMe() {
        guard let current = userLocation else { return }
        cameraPosition = .camera(
            MapCamera(
                centerCoordinate: current,
                distance: 320,
                heading: 0,
                pitch: 28
            )
        )
        toastMessage = "Centered on your live location"
    }

    func teleport(to coordinate: CLLocationCoordinate2D, userEmail: String?) {
        let currentUserEmail = (userEmail ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let demoAllowed = DemoPolicy.isDemoAllowed(currentUserEmail)

        guard demoAllowed, demoModeOn, teleportArmed else { return }

        overrideUntil = Date().timeIntervalSince1970 + (3 * 60)
        userLocation = coordinate
        teleportArmed = false
        toastMessage = "Teleported to selected point"
        cameraPosition = .camera(
            MapCamera(
                centerCoordinate: coordinate,
                distance: 300,
                heading: 8,
                pitch: 28
            )
        )
    }

    func cooldownString(for locationId: String) -> String {
        let remaining = max(0, Int(ceil(demoService.getLocationCooldownRemainingSeconds(locationId))))
        let min = String(format: "%02d", remaining / 60)
        let sec = String(format: "%02d", remaining % 60)
        return "\(min):\(sec)"
    }

    func distanceString(for location: RewardLocation) -> String {
        guard let userLocation else { return "--" }
        let distance = demoService.distance(user: userLocation, target: location.coordinate)
        if distance >= 1000 {
            return String(format: "%.1f km away", distance / 1000)
        }
        return "\(Int(distance.rounded()))m away"
    }

    private func startLocationTracking() {
        loadingLocation = true
        permissionDenied = false

        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest

        let status = locationManager.authorizationStatus
        if status == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        } else if status == .authorizedAlways || status == .authorizedWhenInUse {
            locationManager.startUpdatingLocation()
        } else {
            permissionDenied = true
            loadingLocation = false
        }
    }

    private func startSessionTick() {
        guard sceneActive else { return }
        sessionTimer?.invalidate()
        sessionTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self else { return }
            let state = self.demoService.getSessionState()
            self.claimedThisSession = state.claimedLocationIds
            self.sessionRemaining = state.remaining
        }
    }

    private func startAutoClaimTick() {
        guard sceneActive else { return }
        autoClaimTimer?.invalidate()
        autoClaimTimer = Timer.scheduledTimer(withTimeInterval: 1.2, repeats: true) { [weak self] _ in
            Task { @MainActor in
                self?.runAutoClaim()
            }
        }
    }

    private func runAutoClaim() {
        guard sceneActive else { return }
        guard let coords = userLocation else { return }
        autoClaiming = true

        let result = demoService.claimNearbyRewards(
            userCoords: coords,
            locations: markerPoints,
            demoModeEnabled: demoModeOn,
            maxClaimsPerPass: 3
        )

        if !result.claims.isEmpty {
            walletBalance = result.wallet.balance
            claimedThisSession = result.session.claimedLocationIds
            sessionRemaining = result.session.remaining
            notificationService.sendClaimNotifications(result.claims)

            if result.claims.count == 1, let claim = result.claims.first {
                toastMessage = "Auto-claimed \(claim.locationName): +$\(claim.reward)"
            } else {
                let total = result.claims.reduce(0) { $0 + $1.reward }
                toastMessage = "Auto-claimed \(result.claims.count) PERX spots: +$\(total)"
            }
        }

        autoClaiming = false
    }

    private func stopTickers() {
        autoClaimTimer?.invalidate()
        sessionTimer?.invalidate()
        autoClaimTimer = nil
        sessionTimer = nil
    }
}

extension MapViewModel: CLLocationManagerDelegate {
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            permissionDenied = false
            loadingLocation = false
            manager.startUpdatingLocation()
        case .denied, .restricted:
            permissionDenied = true
            loadingLocation = false
        case .notDetermined:
            break
        @unknown default:
            break
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        if demoModeOn, Date().timeIntervalSince1970 < overrideUntil {
            return
        }

        let coordinate = location.coordinate
        if anchorLocation == nil {
            anchorLocation = coordinate
            demoService.saveDemoAnchor(coordinate)
            cameraPosition = .camera(
                MapCamera(
                    centerCoordinate: coordinate,
                    distance: 360,
                    heading: 0,
                    pitch: 24
                )
            )
        }

        userLocation = coordinate
        loadingLocation = false
    }
}

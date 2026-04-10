import Foundation
import CoreLocation

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
    @Published private(set) var cameraTarget: CLLocationCoordinate2D?
    @Published private(set) var cameraDistance: CLLocationDistance = 360
    @Published private(set) var cameraHeading: CLLocationDirection = 0
    @Published private(set) var cameraPitch: Double = 24
    @Published private(set) var cameraUpdateID = UUID()
    @Published private(set) var canUseDemoTools = false

    private let demoService = DemoModeService.shared
    private let notificationService = PerxNotificationService.shared
    private let locationManager = CLLocationManager()
    private var autoClaimTimer: Timer?
    private var sessionTimer: Timer?
    private var overrideUntil: TimeInterval = 0
    private var bootstrapped = false
    private var sceneActive = true
    private var activeEmail: String?

    var markerPoints: [RewardLocation] {
        demoService.buildWalkableDemoLocations(center: anchorLocation)
    }

    func bootstrap(for email: String?) {
        guard !bootstrapped else { return }
        bootstrapped = true

        let normalizedEmail = (email ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        activeEmail = normalizedEmail
        demoService.configureScope(email: normalizedEmail)
        let demoAllowed = DemoPolicy.isDemoAllowed(normalizedEmail)
        canUseDemoTools = demoAllowed

        demoModeOn = demoAllowed ? demoService.loadDemoMode() : false

        if let savedAnchor = demoService.loadDemoAnchor() {
            anchorLocation = savedAnchor
            updateCamera(to: savedAnchor, distance: 360, heading: 0, pitch: 24)
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
        if value {
            locationManager.stopUpdatingLocation()
            loadingLocation = false
        } else {
            startLocationTracking()
        }
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
        updateCamera(to: location.coordinate, distance: 300, heading: 0, pitch: 35)
    }

    func centerOnMe() {
        guard let current = userLocation else { return }
        updateCamera(to: current, distance: 320, heading: 0, pitch: 28)
        toastMessage = "Centered on your live location"
    }

    func teleport(to coordinate: CLLocationCoordinate2D, userEmail: String?) {
        let currentUserEmail = (userEmail ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let demoAllowed = DemoPolicy.isDemoAllowed(currentUserEmail)

        guard demoAllowed, demoModeOn, teleportArmed else { return }

        overrideUntil = Date().timeIntervalSince1970 + (3 * 60)
        userLocation = coordinate
        selectedLocation = nearestLocation(to: coordinate)
        sheetVisible = selectedLocation != nil
        teleportArmed = false
        toastMessage = "Teleported to selected point"
        updateCamera(to: coordinate, distance: 230, heading: 12, pitch: 38)
    }

    func teleportArmedHint() {
        toastMessage = "Tap anywhere on the map to teleport"
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
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = kCLDistanceFilterNone
        locationManager.activityType = .fitness
        locationManager.pausesLocationUpdatesAutomatically = false

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
            Task { @MainActor [weak self] in
                guard let self else { return }
                let state = self.demoService.getSessionState()
                self.claimedThisSession = state.claimedLocationIds
                self.sessionRemaining = state.remaining
            }
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

    private func nearestLocation(to coordinate: CLLocationCoordinate2D) -> RewardLocation? {
        markerPoints
            .min(by: {
                demoService.distance(user: coordinate, target: $0.coordinate) <
                demoService.distance(user: coordinate, target: $1.coordinate)
            })
    }

    private func stopTickers() {
        autoClaimTimer?.invalidate()
        sessionTimer?.invalidate()
        autoClaimTimer = nil
        sessionTimer = nil
    }

    private func updateCamera(
        to coordinate: CLLocationCoordinate2D,
        distance: CLLocationDistance,
        heading: CLLocationDirection,
        pitch: Double
    ) {
        cameraTarget = coordinate
        cameraDistance = distance
        cameraHeading = heading
        cameraPitch = pitch
        cameraUpdateID = UUID()
    }

    private func applyAuthorizationStatus(_ status: CLAuthorizationStatus) {
        switch status {
        case .authorizedWhenInUse, .authorizedAlways:
            permissionDenied = false
            loadingLocation = false
            locationManager.startUpdatingLocation()
        case .denied, .restricted:
            permissionDenied = true
            loadingLocation = false
        case .notDetermined:
            break
        @unknown default:
            break
        }
    }

    private func handleLocationUpdate(_ coordinate: CLLocationCoordinate2D) {
        if demoModeOn {
            loadingLocation = false
            return
        }

        if Date().timeIntervalSince1970 < overrideUntil {
            return
        }

        if anchorLocation == nil {
            anchorLocation = coordinate
            demoService.saveDemoAnchor(coordinate)
            updateCamera(to: coordinate, distance: 360, heading: 0, pitch: 24)
        }

        userLocation = coordinate
        loadingLocation = false

        if selectedLocation == nil {
            selectedLocation = nearestLocation(to: coordinate)
        }
    }

    private func handleLocationError(_ error: Error) {
        loadingLocation = false
        toastMessage = "Location update failed: \(error.localizedDescription)"
    }
}

extension MapViewModel: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor [weak self] in
            self?.applyAuthorizationStatus(status)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let coordinate = locations.last?.coordinate else { return }
        Task { @MainActor [weak self] in
            self?.handleLocationUpdate(coordinate)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor [weak self] in
            self?.handleLocationError(error)
        }
    }
}

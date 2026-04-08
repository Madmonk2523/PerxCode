import SwiftUI
import MapKit
import UIKit

struct MapScreenView: View {
    @EnvironmentObject private var session: AppSessionViewModel
    @Environment(\.scenePhase) private var scenePhase
    @StateObject private var vm = MapViewModel()
    @State private var cameraPosition: MapCameraPosition = .automatic

    var body: some View {
        ZStack(alignment: .top) {
            mapLayer
                .ignoresSafeArea()

            VStack(spacing: 10) {
                topHud
                if let message = vm.toastMessage {
                    toast(message)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
                Spacer()
                bottomHud
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .padding(.bottom, 24)

            if vm.loadingLocation {
                ProgressView("Loading map...")
                    .tint(.white)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
                    .background(Color.black.opacity(0.72))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
        .sheet(isPresented: $vm.sheetVisible) {
            if let selected = vm.selectedLocation {
                RewardLocationSheet(
                    location: selected,
                    distanceText: vm.distanceString(for: selected),
                    claimed: vm.claimedThisSession.contains(selected.id),
                    cooldownText: vm.cooldownString(for: selected.id)
                )
                .presentationDetents([.fraction(0.5), .large])
                .presentationBackground(.ultraThinMaterial)
            }
        }
        .onAppear {
            vm.bootstrap(for: session.currentUser?.email)
        }
        .onDisappear {
            vm.teardown()
        }
        .onChange(of: scenePhase) { _, newValue in
            vm.setSceneActive(newValue == .active)
        }
        .onChange(of: vm.cameraUpdateID) { _, _ in
            guard let target = vm.cameraTarget else { return }
            cameraPosition = .camera(
                MapCamera(
                    centerCoordinate: target,
                    distance: vm.cameraDistance,
                    heading: vm.cameraHeading,
                    pitch: vm.cameraPitch
                )
            )
        }
        .animation(.easeInOut(duration: 0.2), value: vm.toastMessage)
    }

    private var mapLayer: some View {
        Map(position: $cameraPosition) {
            if let user = vm.userLocation {
                Annotation("You", coordinate: user) {
                    Circle()
                        .fill(Color.blue)
                        .frame(width: 16, height: 16)
                        .overlay(Circle().stroke(.white, lineWidth: 2))
                }
            }

            ForEach(vm.markerPoints) { location in
                Annotation(location.name, coordinate: location.coordinate) {
                    Button {
                        vm.selectLocation(location)
                    } label: {
                        VStack(spacing: 2) {
                            Circle()
                                .fill(vm.claimedThisSession.contains(location.id) ? Color.green : Color(red: 0.376, green: 0.647, blue: 0.98))
                                .frame(width: 20, height: 20)
                                .overlay(Circle().stroke(.white, lineWidth: 1.5))
                            Text("$\(location.reward)")
                                .font(.system(size: 11, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .mapStyle(.standard(elevation: .realistic))
    }

    private var topHud: some View {
        HStack(spacing: 10) {
            hudPill(title: "Wallet", value: "$\(vm.walletBalance)")
            hudPill(title: "Session left", value: "\(vm.sessionRemaining)")
            if vm.autoClaiming {
                ProgressView()
                    .tint(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.black.opacity(0.65))
                    .clipShape(Capsule())
            }
        }
    }

    private var bottomHud: some View {
        VStack(spacing: 10) {
            if vm.permissionDenied {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Location is required to use this app.")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                    Button("Open Settings") {
                        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                        UIApplication.shared.open(url)
                    }
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Color.white.opacity(0.18))
                    .clipShape(Capsule())
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.75))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }

            HStack(spacing: 10) {
                Button {
                    vm.centerOnMe()
                } label: {
                    Label("Center", systemImage: "location.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Color.black.opacity(0.65))
                        .clipShape(Capsule())
                }

                if vm.canUseDemoTools {
                    Toggle(isOn: Binding(
                        get: { vm.demoModeOn },
                        set: { vm.setDemoMode($0) }
                    )) {
                        Text("Demo")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    .toggleStyle(.switch)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.black.opacity(0.65))
                    .clipShape(Capsule())

                    Button {
                        if vm.teleportArmed {
                            if let selected = vm.selectedLocation {
                                vm.teleport(to: selected.coordinate, userEmail: session.currentUser?.email)
                            } else if let fallback = vm.markerPoints.first {
                                vm.teleport(to: fallback.coordinate, userEmail: session.currentUser?.email)
                            } else {
                                vm.toastMessage = "No location available for teleport"
                            }
                        } else {
                            vm.teleportArmed = true
                            vm.toastMessage = "Select a pin, then tap Teleport again"
                        }
                    } label: {
                        Label("Teleport", systemImage: "scope")
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(vm.teleportArmed ? Color.green : .white)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .background(Color.black.opacity(0.65))
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    private func hudPill(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(Color(red: 0.71, green: 0.74, blue: 0.78))
            Text(value)
                .font(.system(size: 14, weight: .heavy))
                .foregroundStyle(.white)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(Color.black.opacity(0.65))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    private func toast(_ message: String) -> some View {
        Text(message)
            .font(.system(size: 12, weight: .bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(Color.black.opacity(0.75))
            .clipShape(Capsule())
            .onAppear {
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.6) {
                    if vm.toastMessage == message {
                        vm.toastMessage = nil
                    }
                }
            }
    }
}

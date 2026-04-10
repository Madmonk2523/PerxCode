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
        MapReader { proxy in
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
                    Annotation("", coordinate: location.coordinate) {
                        Button {
                            vm.selectLocation(location)
                        } label: {
                            Circle()
                                .fill(vm.claimedThisSession.contains(location.id) ? Color.green : Color.purple)
                                .frame(width: 20, height: 20)
                                .overlay(Circle().stroke(.white, lineWidth: 1.5))
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
            .mapStyle(.standard(elevation: .realistic))
            .gesture(
                SpatialTapGesture().onEnded { value in
                    guard vm.teleportArmed else { return }
                    if let coordinate = proxy.convert(value.location, from: .local) {
                        vm.teleport(to: coordinate, userEmail: session.currentUser?.email)
                    }
                }
            )
        }
    }

    private var topHud: some View {
        HStack(spacing: 10) {
            if vm.canUseDemoTools {
                Toggle(isOn: Binding(
                    get: { vm.demoModeOn },
                    set: { vm.setDemoMode($0) }
                )) {
                    Text("Demo")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(vm.demoModeOn ? Color.green : .white)
                }
                .toggleStyle(.switch)
                .tint(.green)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background((vm.demoModeOn ? Color.green : Color.black).opacity(0.26))
                .clipShape(Capsule())

                Button {
                    vm.teleportArmed = true
                    vm.teleportArmedHint()
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
                hudPill(title: "Wallet", value: "$\(vm.walletBalance)")
                hudPill(title: "Session left", value: "\(vm.sessionRemaining)")

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
                DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) {
                    if vm.toastMessage == message {
                        vm.toastMessage = nil
                    }
                }
            }
    }
}

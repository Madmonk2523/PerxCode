# PERX iOS (SwiftUI)

This repository is Swift-only and intended for native iOS development in Xcode.

## What is included

- Committed Xcode project with shared run scheme: `PerxNative.xcodeproj`
- SwiftUI app source: `PerxNative/`
- Committed asset catalog: `PerxNative/Assets.xcassets`
- Firebase packages declared in project file (resolved by Xcode on first open)

## Step-by-step: clone and run

1. Clone the repo on macOS.
2. Double-click `PerxNative.xcodeproj`.
3. Wait for Swift packages to resolve (status appears in Xcode).
4. In the top bar, set scheme to `PerxNative`.
5. Select an iPhone Simulator (for example, iPhone 16).
6. Open target settings:
	- Target: PerxNative
	- Signing & Capabilities
	- Team: select your Apple Developer team
	- Bundle Identifier: change to your own unique value if needed
7. Press Run.

The app will launch even if Firebase config is not added yet. Auth actions will show a clear setup message until Firebase is configured.

## Enable Firebase auth and Firestore

1. Download `GoogleService-Info.plist` from your Firebase iOS app settings.
2. Drag the file into the Xcode project navigator under the `PerxNative` group.
3. In the add dialog:
	- Check "Copy items if needed"
	- Check target `PerxNative`
4. Run the app again.

## Required iOS capabilities and permissions

- Push Notifications (if using claim notifications)
- Location usage descriptions in `Info.plist`
- Camera/Photos usage descriptions for avatar selection
- Background modes only if you explicitly keep background location behavior

## Validate after first launch

1. Open map tab and confirm location permission prompt appears.
2. Confirm wallet/profile tabs open.
3. Add Firebase plist and verify signup/login works.
4. Confirm claim notifications appear when rewards are auto-claimed.

## Manual release steps

Use the complete manual checklist in `APP_STORE_RELEASE_CHECKLIST.md`.

## App Store path

1. Set Signing and Team in Xcode.
2. Increment Version/Build.
3. Product -> Archive.
4. Upload to App Store Connect and submit for review.

For migration and implementation details, see `SWIFT_MIGRATION_NOTES.md`.

# PERX iOS (SwiftUI)

This repository is Swift-only and intended for native iOS development in Xcode.

## Project location

All app source code is under `ios-swift/PerxNative`.

## Open in Xcode

1. On macOS, create or open your iOS app project in Xcode.
2. Add all files from `ios-swift/PerxNative` to your app target.
3. Set iOS deployment target to 17.0+.
4. Add Firebase with Swift Package Manager:
   - `https://github.com/firebase/firebase-ios-sdk`
   - Products: `FirebaseCore`, `FirebaseAuth`, `FirebaseFirestore`
5. Add `GoogleService-Info.plist` to the app target.

## Required iOS capabilities and permissions

- Push Notifications (if using claim notifications)
- Location usage descriptions in `Info.plist`
- Camera/Photos usage descriptions for avatar selection
- Background modes only if you explicitly keep background location behavior

## Run

1. Select an iOS Simulator or connected iPhone in Xcode.
2. Build and run.
3. Validate flows: auth, map, wallet, profile, claim notifications.

## App Store path

1. Set Signing and Team in Xcode.
2. Increment Version/Build.
3. Product -> Archive.
4. Upload to App Store Connect and submit for review.

For migration and implementation details, see `ios-swift/README.md`.

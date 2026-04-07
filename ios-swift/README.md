# Perx Native iOS (Swift)

This folder contains the in-progress native SwiftUI migration of your current React Native PERX app.

## Included parity scope

- Firebase auth flow: login, signup, logout
- Auth-gated app shell
- Bottom tab navigation: Map, Wallet, Profile
- Demo claim engine parity with session limit and cooldown
- Wallet inventory grouping, redemption, expired and redeemed history
- Profile stats, achievement states, avatar persistence
- Dark UI theme and structure aligned to the existing app

## What is in this migration

- Main app entry and root flow: `PerxNative/PerxNativeApp.swift`, `PerxNative/ContentView.swift`
- Services: Firebase integration, claim engine, profile prefs, theme
- View models for auth session, map logic, wallet logic, profile logic
- SwiftUI screens for auth, tabs, map, wallet, profile, and redemption sheet

## Xcode setup (required)

1. On a Mac, create a new iOS App project in Xcode named `PerxNative`.
2. Copy all files from this folder into that Xcode project.
3. Add iOS deployment target 17.0+ (MapKit camera APIs used here).
4. Add Firebase via Swift Package Manager:
   - `https://github.com/firebase/firebase-ios-sdk`
   - Products: `FirebaseAuth`, `FirebaseFirestore`, `FirebaseCore`
5. Add your `GoogleService-Info.plist` to the target.
6. In target Signing & Capabilities, enable:
   - Location updates (if you keep background location parity)
   - Push notifications (if you add claim notifications parity next)

## Testing path

1. Run in iOS Simulator for UI and navigation parity.
2. Run on a real iPhone for location behavior and camera/photo access.
3. Use TestFlight internal testing for real-world QA.

## Completion status

- Foreground claim notifications are integrated in the Swift migration.
- Map, wallet, profile, auth, and demo reward engine are wired and functional.
- Major unused or redundant Swift code paths were removed in this pass.

## Remaining optional production hardening

- Background auto-claim with background location task scheduling.
- Server-authoritative wallet and claims model (Firestore-first instead of local demo wallet).
- UI polish pass for strict pixel matching against every React Native screen state.

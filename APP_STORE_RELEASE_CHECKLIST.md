# PERX iOS Release Checklist (Manual)

Use this checklist after cloning the repo on your Mac.

## 1) First open and run

1. Open `PerxNative.xcodeproj` in Xcode.
2. Wait for Swift Package resolution to complete.
3. Confirm scheme is `PerxNative`.
4. Select a simulator (for example: iPhone 16).
5. Open target `PerxNative` -> Signing & Capabilities.
6. Set `Team` to your Apple developer team.
7. If needed, change bundle id to your own unique id.
8. Press Run.

Expected: app launches. If Firebase plist is missing, auth buttons show setup guidance instead of crashing.

## 2) Firebase setup (required for login/signup)

1. In Firebase Console, create or open your iOS app.
2. Download `GoogleService-Info.plist`.
3. Drag file into Xcode project navigator under the `PerxNative` group.
4. In add-file dialog:
   - check `Copy items if needed`
   - check target `PerxNative`
5. Run again and test signup/login.

## 3) App icons (required for App Store)

The icon slot manifest is committed, but image files are still required.

1. Open `PerxNative/Assets.xcassets/AppIcon.appiconset` in Xcode.
2. Drop final icon PNG files into every slot (including 1024x1024 marketing icon).
3. Ensure there are no AppIcon warnings in the Issue navigator.

## 4) Capability checks

1. Signing & Capabilities -> verify required capabilities:
   - Push Notifications (if claim notifications are used)
   - Background Modes only if truly needed
2. Verify `Info` privacy messages are present and accurate:
   - Camera
   - Photo Library
   - Location When In Use
   - Notifications

## 5) Pre-submit QA

1. Test on simulator:
   - app launch
   - navigation tabs
   - map renders
2. Test on a real iPhone:
   - location prompt flow
   - notifications prompt flow
   - avatar image selection
3. Test Firebase flows:
   - signup
   - login
   - logout
4. Confirm no runtime crashes in Xcode console.

## 6) Build and upload

1. Set `MARKETING_VERSION` and `CURRENT_PROJECT_VERSION`.
2. Product -> Archive.
3. In Organizer, Validate App then Distribute App.
4. Upload to App Store Connect.

## 7) App Store Connect (manual)

1. Create app record with matching bundle id.
2. Fill metadata, screenshots, privacy policy URL.
3. Complete App Privacy questionnaire.
4. Submit build for review.

## Troubleshooting

- No Run button: make sure scheme is `PerxNative` and a simulator/device is selected.
- Signing error: set your Team and unique bundle id.
- Firebase auth fails: ensure `GoogleService-Info.plist` is added to the `PerxNative` target.

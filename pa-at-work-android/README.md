# PA At Work Android App (Web Wrapper)

This Android app wraps the existing PA At Work website in a secure in-app WebView.

## Behavior
- Starts at `https://pa-atwork.org/login`
- Users can log in / create account exactly like website
- Dashboard and all internal pages load in-app
- External browser handoff is disabled (navigation stays in-app)

## Package
- Application ID: `org.paatwork.app`
- App Name: `PA At Work`

## Open in Android Studio
1. Open Android Studio
2. Open folder: `pa-at-work-android`
3. Let Gradle sync complete
4. Build/run on emulator or device

## Create Release Bundle (Play Store)
1. Build > Generate Signed Bundle / APK
2. Choose Android App Bundle (AAB)
3. Use/create signing key
4. Upload `.aab` to Google Play Console

## Notes
- The app requires internet access.
- If website SSL/DNS is unavailable, the app will show load errors.
- If you want to change start URL, edit `startUrl` in `MainActivity.kt`.

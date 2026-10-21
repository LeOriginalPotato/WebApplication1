# PA At Work Android app

Online wrapper around [https://pa-atwork.org/](https://pa-atwork.org/). The app loads the live site over HTTPS. It does not ship a database, a connection string, or a copy of the portal.

Residents, PA members, and admins all use this same app. The website's existing login and role checks decide what each person sees.

## Why this stays a WebView

The first draft was already a WebView, and that is still the right base for the agreed scope.

A Trusted Web Activity (Chrome, full screen) was considered and not used:

- The app must show its own "needs internet" screen with a retry button. Chrome's offline page is not that screen, and Chrome caches pages.
- The app must not keep a local cache of portal pages. A WebView can be set to `LOAD_NO_CACHE`. A TWA cannot.
- `lge2026.pa-atwork.org` must never load, while other `pa-atwork.org` subdomains must. A TWA allowlist cannot express that without also publishing `assetlinks.json` and still letting Chrome follow links.
- Share uses the Android share sheet for the current page. Downloads from the site's POST export have to be saved by the app, because Android's download manager cannot replay a POST.

No `assetlinks.json` is required for this approach.

## What the app does

- Opens `https://pa-atwork.org/login`.
- Stays on `pa-atwork.org` and its subdomains. Other websites open in the browser (Custom Tabs, then a normal browser if that is missing). `mailto:`, `tel:`, and similar links open the matching app.
- Refuses `lge2026.pa-atwork.org` completely. It is not loaded and not handed to the browser.
- Allows HTTPS only. Cleartext is disabled in the network security config. An `http://` link on our own host is rewritten to `https://`. Certificate errors are cancelled.
- Keeps the session cookie so login survives leaving the app. Cookies are flushed to the WebView cookie store. They are not included in Android backup or device-to-device transfer (`android:allowBackup="false"`).
- Does not cache pages, and does not turn on DOM storage. The current site does not use `localStorage`.
- Back navigates WebView history, then leaves the app.
- Share is a small green button at the bottom-right. It opens the Android share sheet with the current `https://pa-atwork.org/...` link. It sits above the navigation bar and the keyboard, and it is hidden on the offline screen. There is no app toolbar; the website header is the top of the screen, just under the status bar.
- Saves files the site produces into the device Downloads folder. GET downloads use `DownloadManager` and include the session cookie. POST forms whose path contains an `export` or `download` segment (the live resident CSV export) are saved from the response, because `DownloadManager` cannot repeat a POST.
- File inputs open the system picker. The live site does not currently render `<input type="file">`. The older ASP.NET and PHP copies do, and a future input will work. The app does not request camera, photo-library, or location permissions.
- WebView file access from URLs is off, universal file access is off, mixed content is off, and Safe Browsing is on.

The launcher icon is the official Patriotic Alliance logo. Adaptive icons keep the circle inside the safe zone on a `#F5FBF7` background, which is the site background and also the status-bar and navigation-bar colour. The 512×512 Play listing file is `store/play-store-icon-512.png`.

## Build a debug APK

Requirements: JDK 17 or newer, and Android SDK 36 (Android 16).

```bash
cd pa-at-work-android
# either export ANDROID_HOME, or create local.properties (gitignored):
#   sdk.dir=/path/to/Android/sdk
./gradlew assembleDebug
```

On Windows, run `gradlew.bat` instead of `./gradlew`.

Output: `app/build/outputs/apk/debug/app-debug.apk`

Debug builds use the automatic debug key. They are for a device or emulator, not for Play.

Unit tests, which cover the URL rules and download file names:

```bash
./gradlew test
```

## Sign a release and build an AAB

Play requires an Android App Bundle signed with your upload key. The keystore and passwords are not in git.

Create an upload key once and store it outside this repository (and keep a backup):

```bash
keytool -genkeypair -v \
  -keystore /path/outside/the/repo/pa-atwork-upload.jks \
  -alias pa-atwork \
  -keyalg RSA -keysize 2048 -validity 10000
```

Current `keytool` writes a PKCS12 keystore. PKCS12 uses one password for the store and the key. Set `PA_KEYSTORE_PASSWORD` and `PA_KEY_PASSWORD` to that same password. If they differ, release signing fails with a padding error.

Then either export the four variables or copy `keystore.properties.example` to `keystore.properties` (gitignored):

```bash
export PA_KEYSTORE_FILE=/path/outside/the/repo/pa-atwork-upload.jks
export PA_KEYSTORE_PASSWORD='your-store-password'
export PA_KEY_ALIAS=pa-atwork
export PA_KEY_PASSWORD='your-key-password'

./gradlew bundleRelease
```

`assembleRelease` builds a signed APK the same way, for sideloading. `bundleRelease` and `assembleRelease` fail if signing is missing.

Output:

- AAB (upload this): `app/build/outputs/bundle/release/app-release.aab`
- APK: `app/build/outputs/apk/release/app-release.apk`

Enroll the app in Play App Signing. Google holds the app signing key. You keep the upload key. If the upload key is lost, reset it through Play Console. Do not commit either key.

`applicationId` is `org.paatwork.app`. It cannot be changed after the first Play release.

`versionCode` is `1` and `versionName` is `1.0.0`. Every later upload needs a higher `versionCode`. Edit both in `app/build.gradle`.

`minSdk` is 24 (Android 7). `compileSdk` and `targetSdk` are 36, which is what Play requires for new apps and updates as of 31 August 2026. The app does not ship native libraries, so there is no extra 16 KB page-size packaging step. WebView is the one on the device.

## Play Console

Before the first production release, the owner still has to supply:

- A public privacy policy URL. `https://pa-atwork.org/privacy` is not usable for this: it redirects to login, and the page body is placeholder text. Play requires a URL that anyone can open without an account.
- A way for people who register in the app to ask for account deletion, including a web link. Play requires this when the app lets someone create an account. The site has registration and does not have a deletion page.
- Store listing: app name `PA At Work`, short and full description, feature graphic, and phone screenshots. Upload `store/play-store-icon-512.png` as the 512×512 icon.
- Content rating questionnaire. Do not opt into Designed for Families. The site collects ID numbers.
- Countries, pricing (this is a free app unless you decide otherwise), and the Data safety form below.
- The signed AAB and Play App Signing.

The app does not add its own accounts, analytics, ads, or crash SDK. Roles are entirely the website's:

- Residents get the resident pages (dashboard, report an incident, Section 78, their own profile).
- PA members and admins get the staff pages the site already shows them, not a separate "full" client.

## Data safety answers

Answer from what this app and the live site actually do. A lawyer or the owner should confirm the sharing and deletion rows before you submit. The app binary does not add collectors of its own.

| Question | Answer to use |
| --- | --- |
| Does the app collect or share user data? | Yes. The WebView is the portal. Data users type is sent to `pa-atwork.org`. |
| Is data encrypted in transit? | Yes. The app allows HTTPS only. |
| Do you provide a way to request deletion? | Not yet. Do not claim that you do until a real deletion page exists. |
| Third-party SDKs (analytics, ads, crash) | None. |
| Device location permission | Not requested. A resident can paste a Google Maps link. The server reads coordinates from that link. Declare that as user-provided location, not as precise device location. |
| Photos or files permission | Not requested. Incident "photo" on the live site is a text field (URL or data URL). A future file input sends the chosen file only to `pa-atwork.org` as part of that form. The app does not keep it. |
| Data stored on the device by the app | The WebView session cookie (so login persists), in app-private storage, excluded from backup. Files the user exports, in the public Downloads folder. No offline copy of pages. |
| Data shared by the app with a third-party SDK | No. |

Data the website collects when someone uses the app, which Play expects you to declare:

- Account: name, surname, email, phone, ID number, physical address, password, PIN. Required for an account. Collected and stored on the server.
- Incident report (residents): category, description, a map link the user pastes, optional photo URL.
- Section 78 dispute (residents): property address, municipal account number, erf / stand, title deed, statement, and consent flags. The page says PA leadership may take the billing query to the municipal valuer. If that happens, Data safety "sharing" is yes for that data, with the purpose "app functionality", not advertising. Confirm this with whoever runs the portal. The app itself does not integrate a municipal SDK.
- Admin CSV export: name, email, phone, town, address of selected residents. The user saves that file to the device. The app does not upload it anywhere else.

Do not declare advertising ID, crash logs, or browsing history as collected. The back stack stays on the device so the back button works.

## Decisions the owner still needs to make

1. Publish a real privacy policy at a public URL, and a real account-deletion URL, before production review.
2. Confirm the Data safety sharing answer for Section 78 (municipal valuer) and whether any other server-side sharing exists.
3. Create the upload keystore, turn on Play App Signing, and keep the keystore out of git.
4. Choose store countries and the content-rating answers.
5. Optional server follow-up, not required for the app to run: mark the session cookie `Secure` and give it a `Max-Age` so the session lifetime is explicit. The WebView already keeps the current session cookie across restarts.
6. Optional later: Android App Links, if a shared `https://pa-atwork.org/...` link should open the app. That would need `assetlinks.json` on the site. It is not part of this build.

## Site changes

None are required for the app to build or to talk to the live portal.

- Downloads already send `Content-Disposition: attachment` for the resident CSV. GET downloads are saved by `DownloadManager`. The live export is a POST to `/resident-management/export`, and the app handles that POST itself.
- Do not add `assetlinks.json` unless you later switch to App Links or a Trusted Web Activity.
- The app never opens a database. Do not put a connection string in the Android project.

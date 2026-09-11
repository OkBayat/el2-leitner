# Vocora Capacitor mobile architecture

Vocora uses Capacitor as a thin native runtime around the existing Angular application. Angular remains the only product UI and application source. The permanent app identifier is `ir.vocora`, derived directly from the owned `vocora.ir` domain; changing it creates a different store application and must not be done casually.

Capacitor was selected because it packages the existing Angular build locally while exposing only the small native surface Vocora needs. This preserves the web/PWA product, Angular Material/Bootstrap design system, router, and test strategy instead of introducing a second Ionic UI application.

## Runtime targets

| Target | Web source | API | Offline/update behavior |
| --- | --- | --- | --- |
| Web | Server-hosted Angular production build | Same-origin `/api/*` | Existing PWA service worker |
| Android | `ui/dist/browser` copied into the APK/AAB | `https://vocora.ir/api/*` | Bundled fallback plus opt-in Capgo live updates |
| iOS | `ui/dist/browser` copied into the app | `https://vocora.ir/api/*` | Bundled fallback plus opt-in Capgo live updates |

Production native builds never use `server.url`. `capacitor.config.ts` sets `webDir` to Angular's actual `dist/browser` output. The `native` Angular configuration replaces only the runtime environment and never runs `generate-pwa-worker.mjs`; `PwaUpdateService` also refuses to register a service worker in a native runtime. The normal `build:production` path and web PWA are unchanged.

Capacitor's native HTTP patch is enabled for `fetch` and `XMLHttpRequest`. Angular requests, TTS, and authenticated audio URLs go through the centralized runtime URL resolver. Native requests use HTTPS, send credentials, and the backend permits only the exact `https://localhost` and `capacitor://localhost` WebView origins. Never replace this allow-list with `*`. Production cookie configuration must remain secure; if browser-managed cross-site cookies are used, set `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none` together. The iOS app declares `vocora.ir` in `WKAppBoundDomains` for WebKit cookie behavior.

## Prerequisites

- Node.js 22 or newer (CI uses 22.22.3) and npm 10.
- Capacitor 8 requires Android Studio 2025.2.1 or newer, JDK 21, Android SDK 36, and a minimum device API of 24.
- Android builds use Gradle 8.14.3, Android Gradle Plugin 8.13.0, and Android Build Tools 36.0.0.
- Capacitor 8 requires macOS with Xcode 26 or newer for iOS. The deployment target is iOS 15.
- Run `npm ci` in `ui/` before mobile commands.

The native platform projects under `ui/android` and `ui/ios` are first-class, version-controlled source. Do not delete and regenerate them as a routine build step.

## Local commands

Run these from `ui/`:

```bash
npm run mobile:build          # optimized native Angular bundle; no service worker
npm run mobile:sync           # native Angular build, then cap sync
npm run mobile:android        # sync and run Android
npm run mobile:ios            # sync and run iOS (macOS only)
npm run mobile:android:open   # Android Studio
npm run mobile:ios:open       # Xcode (macOS only)
npm run mobile:version        # sync package version into both native projects
npm run mobile:assets         # regenerate platform branding from ui/resources
```

The release sequence is always dependency installation, `mobile:version`, `mobile:build`, `cap sync`, and then the native build. `mobile:sync` rebuilds before copying, so stale web assets cannot be shipped accidentally.

For Android CLI builds:

```bash
cd ui/android
./gradlew assembleDebug
./gradlew assembleRelease bundleRelease
```

Release tasks fail closed unless all four signing environment variables are present. Debug APKs are under `app/build/outputs/apk/debug`. Signed release APKs are under `app/build/outputs/apk/release`, and AABs are under `app/build/outputs/bundle/release`.

On macOS, open `ui/ios/App/App.xcodeproj` or use the documented GitHub workflow. Select the `App` scheme and a simulator/device. A simulator `.app` is not an installable physical-device IPA.

## Native behavior

`NativeLifecycleService` owns Capacitor-specific behavior instead of scattering platform checks through features:

- the Keyboard plugin emits the authoritative open/closed state and keyboard height, reflected by `html.native-keyboard-open` and `--native-keyboard-height`;
- native resize mode is `native`, so the WebView and `dvh` layout track the visible viewport;
- Android back delegates to browser history and minimizes only at the root;
- resume triggers update checks without resetting the current Angular session;
- `vocora://app/<route>` and approved Vocora links route through Angular;
- external HTTP(S) links open through the system browser;
- SystemBars injects safe-area variables and follows device appearance.

The app manifest directly requests only `INTERNET`. The Capgo updater's AndroidX WorkManager dependency adds `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `RECEIVE_BOOT_COMPLETED`, and `FOREGROUND_SERVICE`, plus Android's scoped dynamic-receiver permission, so background update work can be scheduled reliably; none is a runtime-dialog permission. iOS declares no privacy-sensitive permission. Android cleartext traffic and backups are disabled. Add Universal Links/App Links only after the associated-domain files and store signing identities exist; the custom scheme already supports deterministic deep routes.

## Versioning

`ui/package.json` is the human-readable release version source (`MAJOR.MINOR.PATCH`). `npm run mobile:version` synchronizes it to:

- the Angular `WEB_APP_VERSION` constant;
- Android `versionName`;
- iOS `CFBundleShortVersionString`.

Without an argument, the deterministic build number is `major * 1,000,000 + minor * 1,000 + patch`. CI supplies the monotonic GitHub run number with `--build-number`; that value becomes Android `versionCode` and iOS `CFBundleVersion`. Confirm that a migrated store application starts below the chosen CI value before its first upload.

## Binary/store update policy

The public endpoint `GET /api/mobile/releases/:platform` returns a disabled policy until all three environment variables for that platform are configured:

```text
MOBILE_ANDROID_LATEST_VERSION
MOBILE_ANDROID_MINIMUM_SUPPORTED_VERSION
MOBILE_ANDROID_STORE_URL
MOBILE_IOS_LATEST_VERSION
MOBILE_IOS_MINIMUM_SUPPORTED_VERSION
MOBILE_IOS_STORE_URL
```

`AppUpdateService` compares the installed native version with that policy. Below `latestVersion` produces an optional store banner; below `minimumSupportedVersion` produces a non-dismissible required update notice. Store URLs must use HTTPS. A store update is mandatory for Swift/Kotlin/Java changes, Capacitor or plugin changes, permissions, entitlements, manifests/plists, native dependencies, or native configuration.

## Live web-bundle updates

Capgo's maintained Capacitor 8 updater provides background download, validation, recovery to the built-in bundle, channel targeting, and native dependency compatibility checks. It is deliberately off by default. A native binary enables it only when both build settings are supplied before `cap sync`:

```text
VOCORA_LIVE_UPDATES_ENABLED=true
VOCORA_LIVE_UPDATE_CHANNEL=development|staging|production
```

With `onlyDownload`, the validated built-in/current bundle starts first. A compatible update downloads in the background and emits the Vocora notice. `Restart & Update` activates it immediately; `Later` queues it for a later lifecycle transition. `notifyAppReady()` confirms a successful launch inside the rollback timeout. A breaking/native-incompatible update is not activated.

Create distinct Capgo channels for development, staging, and production. Configure production with the metadata compatibility strategy and no development/emulator delivery. The CI upload always uses `--fail-on-incompatible --auto-min-update-version`. The only exception is the intentional baseline upload after a newly signed native binary has shipped; perform that once as an operator-reviewed step, without `--fail-on-incompatible`, then restore the guarded path. Apple live updates must stay within the reviewed app's purpose and must never add native capability or bypass store review.

Eligibility rule: a change is OTA-eligible only when `npx @capgo/cli@8.50.3 bundle releaseType ir.vocora --channel <channel>` returns `OTA` and the diff contains no native project, Capacitor config, native dependency, plugin, permission, entitlement, or store metadata change. Otherwise publish a new binary.

Rollback is channel-scoped: repoint the channel to a known-good bundle or force the built-in bundle. Do not delete the last good bundle during an incident.

## GitHub Actions release flow

`.github/workflows/mobile-release.yml` is the single artifact orchestration entry point. A manual run can build smoke artifacts, request signed releases, publish a guarded live update, or explicitly create a GitHub Release. Semantic `vX.Y.Z` tags require signed Android and iOS inputs and attach release binaries. Nothing publishes to Google Play or App Store automatically.

The workflow validates backend and UI tests, builds the web/PWA and native Angular targets, runs `cap sync`, builds Android on Linux, builds iOS on macOS, and exposes:

- `Vocora-Web` — deployable web bundle;
- `Vocora-Android-Debug` — unsigned development smoke APK when signed release is not requested;
- `Vocora-Android-APK` — signed `vocora-android-X.Y.Z.apk`;
- `Vocora-Android-AAB` — signed `vocora-android-X.Y.Z.aab`;
- `Vocora-iOS-Simulator` — simulator-only smoke build;
- `Vocora-iOS-IPA` — signed `vocora-ios-X.Y.Z.ipa`.

Required repository secrets:

| Secret | Content | Job | Required when |
| --- | --- | --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 release keystore | Android | Signed APK/AAB |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password | Android | Signed APK/AAB |
| `ANDROID_KEY_ALIAS` | Signing alias | Android | Signed APK/AAB |
| `ANDROID_KEY_PASSWORD` | Alias private-key password | Android | Signed APK/AAB |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Base64 Apple `.p12` | iOS | Signed IPA |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | `.p12` password | iOS | Signed IPA |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64 matching provisioning profile | iOS | Signed IPA |
| `IOS_TEAM_ID` | Apple Developer team ID | iOS | Signed IPA |
| `CAPGO_API_KEY` | Narrow Capgo app/channel deployment key | Live update | Intentional OTA publish |

Optional repository variable `IOS_EXPORT_METHOD` selects `app-store-connect` (default), `ad-hoc`, or `development` to match the provisioning profile. CI reconstructs signing files under the runner temporary directory, never logs their values, and removes them in an `always()` cleanup step.

## Distribution

- Use the signed AAB for Google Play internal testing; promote to later tracks manually after validation.
- Use an App Store Connect profile and the signed IPA for TestFlight. TestFlight is the preferred real-user test path.
- Development and Ad Hoc IPAs install only on devices allowed by their provisioning profile. A downloaded IPA is not universally installable.
- Public store publication requires a separate intentional operator action and account approval.

The existing server deployment remains `scripts/deploy.sh`. `Vocora-Web` is a downloadable build product, but production deployment still uses the repository's existing Docker build/setup/deploy transaction; mobile release automation does not invent a second server deployment mechanism.

## Adding a native plugin safely

1. Confirm the current feature cannot use web APIs or an existing plugin.
2. Pin the Capacitor-compatible plugin version and add only required permissions.
3. Update the plugin inventory below and native contract tests.
4. Run `npm run mobile:sync`, Android and iOS builds, and all repository tests.
5. Publish new signed store binaries.
6. Establish the matching live-update channel baseline only after those binaries are available.

Current native plugins:

- `@capacitor/app`: lifecycle, Android back, version/build data, and deep-link events.
- `@capacitor/keyboard`: authoritative keyboard visibility/height and native resize behavior.
- `@capacitor/browser`: external and store links outside the WebView.
- `@capgo/capacitor-updater`: opt-in guarded web-bundle updates and rollback.
- Capacitor core `CapacitorHttp`: cookie-capable native HTTP bridge.
- Capacitor core `SystemBars`: modern edge-to-edge safe-area and system-bar behavior.

## Troubleshooting

- A native request hitting `https://localhost/api` means the central runtime resolver was bypassed. Route all `/api/*` resources through it.
- Login failures should be checked in this order: HTTPS certificate, native environment URL, `CORS_ALLOWED_ORIGINS`, secure cookie settings, and `WKAppBoundDomains`.
- If `cap sync` copies stale files, use `npm run mobile:sync`; do not run `cap copy` against an old `dist` directory.
- If `service-worker.js` appears in `dist/browser` after `mobile:build`, stop the release. The native target must not include it.
- Android release tasks intentionally fail when signing variables are incomplete.
- An iOS simulator build proves compilation only. Check certificate, profile app ID, Team ID, export method, and registered devices when IPA export fails.
- A Capgo compatibility failure means the change needs a native release or the channel baseline is wrong. Do not bypass the gate for an ordinary OTA.

Primary upstream references: [Capacitor configuration](https://capacitorjs.com/docs/config), [Capacitor HTTP](https://capacitorjs.com/docs/apis/http), [App lifecycle](https://capacitorjs.com/docs/apis/app), [Keyboard](https://capacitorjs.com/docs/apis/keyboard), [System Bars](https://capacitorjs.com/docs/apis/system-bars), and [Capgo native compatibility](https://capgo.app/docs/live-updates/compatibility/).

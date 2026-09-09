# Vocora PWA

Vocora ships as an installable Progressive Web App for Android and iPhone/iPad. The production build includes a web app manifest, regular and maskable icons, Apple Home Screen metadata, a versioned service worker, update handling, and an offline launch screen.

## Production requirements

- Serve the public Vocora origin over HTTPS. Browsers also allow service workers on `localhost` for development.
- Keep `service-worker.js` and `manifest.webmanifest` at the origin root. The application server already serves both with `Cache-Control: no-store`; the worker also receives `Service-Worker-Allowed: /`.
- Do not put a CDN rule in front of these two files that overrides those headers.
- The service worker deliberately does **not** cache `/api` responses or mutations. Authentication, progress writes, library changes, and account data remain server-authoritative and require a connection.

## Build

From `ui/`:

```bash
npm ci
npm run build:production
npm run check:pwa
```

The Angular build emits hashed production bundles to `ui/dist/browser`. `tools/generate-pwa-worker.mjs` then inventories those exact files, creates a content-derived cache version, and writes `ui/dist/browser/service-worker.js`.

Never copy a handwritten service worker into the production output after this step; it would break the version-to-bundle contract.

## Install on Android

1. Open Vocora through its HTTPS address in Chrome, Edge, or Samsung Internet.
2. Sign in and open **Settings**.
3. Use **Install on this device** when the browser offers the native prompt.
4. If the direct button is not available, use the browser menu and choose **Install app** or **Add to Home screen**.

The installed app starts at `/dashboard`, runs in standalone display mode, and exposes Review and Words shortcuts where the launcher supports web app shortcuts.

## Install on iPhone or iPad

Installation is controlled by Safari:

1. Open Vocora in Safari.
2. Tap **Share**.
3. Tap **Add to Home Screen**.
4. Enable **Open as Web App**.
5. Tap **Add**.

The Settings page detects iOS and shows these steps. When Vocora is opened in another iOS browser, it directs the user to Safari.

## Offline behavior

The service worker precaches the production app shell, route bundles, styles, static vocabulary source, fonts, audio, and PWA icons. A previously loaded installation can therefore open and render the interface without a network connection.

Because user state is server-backed, a cold authenticated route that cannot verify the session is redirected to the cached `/offline` screen. The screen provides a retry action when connectivity returns. The app also shows a compact offline status while an already-open session loses connectivity.

## Updates

- The application checks for worker updates when it comes online, becomes visible, and periodically while open.
- A new version installs in the background but does not replace the running code immediately.
- Vocora shows **A new Vocora version is ready**. Selecting **Reload** sends `SKIP_WAITING`, waits for the new worker to control the page, and reloads once.
- Old versioned caches are deleted during worker activation.

This avoids mixing an old lazy-loaded chunk graph with new deployed bundles.

## Verification checklist

- `npm test` passes in `ui/`.
- Backend tests include manifest and worker response-header coverage.
- Fast artifact and component regressions verify the manifest, worker scope, registration lifecycle, cache policy, and offline route; verify a real offline reload manually when changing complete-system PWA connectivity.
- Test Android installation from the production HTTPS origin.
- Test iPhone installation from Safari and verify the icon, standalone launch, status-bar/safe-area spacing, and update prompt.

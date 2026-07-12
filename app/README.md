# FiApp Android shell (Capacitor)

This is the native Android wrapper for FiApp. It loads the live site
(`https://fiapp.onrender.com`) via Capacitor `server.url`, so a Render deploy reaches the
app on the next launch with no rebuild (the "AM4 model"). The only thing that does not work
in a bare webview is Google OAuth; the app fixes that with a native Google Sign-In plugin
whose `id_token` is posted to the same-origin `/auth/google/native` endpoint (already live
in `FinalProject/app.py`).

- **appId:** `com.fiapp.app`
- **Target:** Capacitor 6, Android first.
- **Google:** the Android OAuth client (package `com.fiapp.app` + your debug SHA-1) is
  already registered in Google Cloud. Native sign-in uses your existing **Web** client id
  as `serverClientId`.

## One-time setup

1. **Set your Web client id.** Open `capacitor.config.ts` and replace
   `YOUR_WEB_CLIENT_ID.apps.googleusercontent.com` with the FiApp **Web** OAuth client id
   (the one the backend already uses, not the Android client id).

2. **Install dependencies** (from this `app/` folder):

   ```bash
   npm install
   ```

3. **Add the Android platform** (generates the `android/` Gradle project locally; it is
   gitignored and never committed):

   ```bash
   npx cap add android
   npx cap sync
   ```

4. **Open in Android Studio:**

   ```bash
   npx cap open android
   ```

   Let Gradle sync, then Run on your emulator or a connected device.

## Google Sign-In native config

The `@codetrix-studio/capacitor-google-auth` plugin reads `serverClientId` from
`capacitor.config.ts` (step 1), but **also requires it as a native Android string resource**
(confirmed by hitting Google error code 10 / `DEVELOPER_ERROR` without it) - add this to
`android/app/src/main/res/values/strings.xml`:

```xml
<string name="server_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
```

No client-side FiApp code needs the Android client id: Google authorizes the request by
matching the package name (`com.fiapp.app`) plus the signing SHA-1 you registered.

## App Lock (biometric) native config

`@aparajita/capacitor-biometric-auth` does **not** declare the permission it needs itself
(confirmed by inspecting its bundled manifest) - add this to
`android/app/src/main/AndroidManifest.xml`, alongside the existing `INTERNET` permission:

```xml
<uses-permission android:name="android.permission.USE_BIOMETRIC" />
```

Also note: this plugin's public `authenticate()` method isn't reachable on the object
Capacitor exposes on this build (an inherited-prototype-method quirk, not a native crash) -
`static/js/native-lock.js` already works around this by falling back to the plugin's
`internalAuthenticate()` directly when `authenticate` isn't a function. No action needed
here; documented so it isn't mistaken for a regression if re-investigated later.

## Font size matching the PWA

Android's WebView scales page text by the device's system font-size (accessibility)
setting by default; Chrome (rendering the PWA) does not apply that setting to regular web
content. Without a fix, the same page can render visibly larger in the native app than in
the browser on a device with a bumped-up system font size. `MainActivity.java` pins the
WebView's text zoom to 100% in `onCreate()` to keep native and web sizing identical - this
file is **not regenerated** by `cap sync`, but *is* regenerated (back to Capacitor's bare
stub) if `android/` is ever deleted and recreated via `cap add android`. If that happens,
reapply:

```java
package com.fiapp.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().getSettings().setTextZoom(100);
    }
}
```

## What to test on device

- App launches and loads the live FiApp site.
- **Google sign-in (returning user):** tap "Continue with Google" -> signs straight in.
- **Google sign-in (new user):** signs in, then lands on the username-completion screen
  (finished by the existing `/auth/google/complete`).
- **Account page "Connect Google":** links the account (after the password step-up).
- **Push-to-deploy:** trigger a Render deploy, reopen/reload the app, confirm the change
  appears (AM4 property).
- Plain-browser Google sign-in is unaffected (the native bridge is a no-op outside the app).
- **App Lock (Account page):** enable the toggle -> a real biometric/PIN prompt appears ->
  background the app -> foreground it -> lock screen re-appears -> authenticate -> content
  shows. Ordinary in-app navigation (income/expenses/etc.) should **not** re-lock; only a
  real background/foreground cycle should.
- **Renewal reminders (Account -> Preferences -> Renewal Reminders):** enable the toggle -> a
  real OS notification-permission prompt appears -> granting it registers the device (the
  toggle stays on). Seed a subscription renewing tomorrow, run the scan curl above, and
  confirm the device receives "... renews tomorrow." Tapping it opens Subscriptions.
  Disabling the toggle stops future reminders. Web is unaffected (the card is hidden in a
  browser).

## Known limitations (follow-ups, not blockers)

- A **password-less** (Google-only) account deleting itself from the account page uses the
  redirect-based `/auth/google/confirm_delete`, which does not run inside the webview. That
  edge case is deferred; every other Google path has a native bridge.
- When bumping the **Capacitor major version** (e.g. to 7), also bump
  `@codetrix-studio/capacitor-google-auth` to a matching release; the web-side bridge
  (`FinalProject/static/js/native-auth.js`) expects the plugin's `GoogleAuth.signIn()` API.

## Push notifications - subscription-renewal reminders (Phase 5)

`@capacitor/push-notifications` (in `package.json`) delivers reminders via **Firebase Cloud
Messaging (FCM)**. All the web + server code is already live and testable with FCM *stubbed*
(the server logs instead of sending until credentials are set); the steps below wire up real
delivery. The web side is a strict no-op outside the native shell, so the browser is
unaffected.

**How it works end-to-end:** the account page's "Renewal Reminders" toggle (Preferences tab)
asks for OS notification permission, then `static/js/native-push.js` posts the FCM device
token to `POST /api/push/register`. A daily **Render Cron Job** hits
`POST /internal/run-renewal-scan` (shared-secret protected); the server ports
`upcomingRenewals()` to find subscriptions renewing within 7 days, sends a heads-up ~7 days
out and a final nudge the day before (deduped so each fires once), and tapping a reminder
opens `/subscriptions`.

### Owner provisioning checklist (server + Firebase)

1. **Firebase project + FCM.** Create a Firebase project, add an **Android app** with package
   `com.fiapp.app`, and download its **`google-services.json`** into `android/app/`
   (gitignored; re-add after any `cap add android`).
2. **Service account.** In Firebase console -> Project settings -> Service accounts ->
   "Generate new private key". Put the **entire JSON** into the Render env var
   **`FIREBASE_CREDENTIALS`** (the server reads it via `firebase-admin`; if unset, sends are
   stubbed to the log).
3. **Scan secret.** Set **`PUSH_SCAN_SECRET`** to a long random string on the Render web
   service (this is what authorizes the scan endpoint).
4. **Render Cron Job.** Add a Cron Job service (same repo) that runs daily, e.g.:

   ```bash
   curl -fsS -X POST https://fiapp.onrender.com/internal/run-renewal-scan \
     -H "X-Scan-Secret: $PUSH_SCAN_SECRET"
   ```

   It returns `{"ok":true,"users_scanned":N,"reminders_sent":M}`. Without the header (or with
   a wrong secret) it returns 403.
5. **Android 13+ notifications permission.** After `cap sync`, confirm the plugin added
   `<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>` to
   `android/app/src/main/AndroidManifest.xml`; add it manually if not (same class of gotcha as
   the biometric permission above).

`requirements.txt` already pins `firebase-admin`; no other backend change is needed.

## Release signing (later, Phase 6)

Before Play submission, register the **release/upload key** SHA-1 (different from debug) in
the same Google Cloud Android OAuth client, or native sign-in will fail on the store build.

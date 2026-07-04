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
`capacitor.config.ts` (step 1). If a build complains it cannot find the server client id,
add it to `android/app/src/main/res/values/strings.xml` as well:

```xml
<string name="server_client_id">YOUR_WEB_CLIENT_ID.apps.googleusercontent.com</string>
```

No client-side FiApp code needs the Android client id: Google authorizes the request by
matching the package name (`com.fiapp.app`) plus the signing SHA-1 you registered.

## What to test on device

- App launches and loads the live FiApp site.
- **Google sign-in (returning user):** tap "Continue with Google" -> signs straight in.
- **Google sign-in (new user):** signs in, then lands on the username-completion screen
  (finished by the existing `/auth/google/complete`).
- **Account page "Connect Google":** links the account (after the password step-up).
- **Push-to-deploy:** trigger a Render deploy, reopen/reload the app, confirm the change
  appears (AM4 property).
- Plain-browser Google sign-in is unaffected (the native bridge is a no-op outside the app).

## Known limitations (follow-ups, not blockers)

- A **password-less** (Google-only) account deleting itself from the account page uses the
  redirect-based `/auth/google/confirm_delete`, which does not run inside the webview. That
  edge case is deferred; every other Google path has a native bridge.
- When bumping the **Capacitor major version** (e.g. to 7), also bump
  `@codetrix-studio/capacitor-google-auth` to a matching release; the web-side bridge
  (`FinalProject/static/js/native-auth.js`) expects the plugin's `GoogleAuth.signIn()` API.

## Release signing (later, Phase 6)

Before Play submission, register the **release/upload key** SHA-1 (different from debug) in
the same Google Cloud Android OAuth client, or native sign-in will fail on the store build.

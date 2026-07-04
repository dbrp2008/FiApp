import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fiapp.app',
  appName: 'FiApp',
  // Capacitor requires a local webDir even though we load the remote site below.
  webDir: 'www',
  server: {
    // AM4 model: the shell loads the live site, so a Render deploy reaches the app on the
    // next launch/reload without a rebuild or store resubmission.
    url: 'https://fiapp.onrender.com',
    androidScheme: 'https',
    // Deliberately NO broad allowNavigation: native Google sign-in happens outside the
    // webview (Google Play services), so the webview stays locked to the app origin.
  },
  plugins: {
    GoogleAuth: {
      // Use the existing FiApp WEB OAuth client id here (NOT the Android client id), so the
      // returned id_token's `aud` equals the backend's GOOGLE_CLIENT_ID and server-side
      // verification in /auth/google/native passes. Replace the placeholder below.
      serverClientId: '469728059248-uulttndbafgfq0jadnq07kbi8dk1h4m4.apps.googleusercontent.com',
      forceCodeForRefreshToken: false,
      scopes: ['email', 'profile'],
    },
  },
};

export default config;

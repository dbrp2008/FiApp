/* FiApp native (Capacitor) auth bridge.
 *
 * Loaded on every page via base.html (script-src 'self' covers it, no nonce). It is a
 * no-op in a plain browser: window.Capacitor is undefined, so fiappIsNative() is false and
 * nothing is intercepted - the existing redirect-based Google web flow runs unchanged.
 *
 * Inside the Capacitor shell (server.url loads the live site, and Capacitor injects its
 * bridge into the remote page), the embedded webview cannot do Google's redirect OAuth
 * (Google blocks it, and a Custom Tab's cookie jar is separate). Instead the native Google
 * plugin returns an id_token to JS, which we POST same-origin so the Set-Cookie lands in
 * this webview's own jar. See /auth/google/native and /auth/google/native_link in app.py.
 */
'use strict';

function fiappIsNative() {
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
            && window.Capacitor.isNativePlatform());
}
window.fiappIsNative = fiappIsNative;

// Runs the native Google plugin and returns its id_token, or null on cancel/error.
async function _fiappNativeGoogleIdToken() {
  var GA = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth;
  if (!GA) return null;
  if (typeof GA.initialize === 'function') { try { GA.initialize(); } catch (e) { /* native reads config */ } }
  var user = await GA.signIn();
  return (user && user.authentication && user.authentication.idToken) || null;
}

function _fiappPost(url, idToken) {
  var f = window.fiappFetchTimeout
    ? function (u, o) { return window.fiappFetchTimeout(u, 15000, o); }
    : fetch;
  return f(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._CSRF || '' },
    body: JSON.stringify({ id_token: idToken })
  });
}

// Login/register: native sign-in. Navigates to the same destinations the web flow uses,
// so the existing /login?finish=google completion UI and ?google= error banners are reused.
async function fiappNativeGoogleSignIn() {
  try {
    var idt = await _fiappNativeGoogleIdToken();
    if (!idt) { window.location = '/login?google=error'; return; }
    var res = await _fiappPost('/auth/google/native', idt);
    var data = await res.json();
    if (res.ok && data.ok) { window.location = '/'; }
    else if (res.ok && data.finish === 'google') { window.location = '/login?finish=google'; }
    else { window.location = '/login?google=' + encodeURIComponent(data.error || 'error'); }
  } catch (e) { window.location = '/login?google=error'; }
}
window.fiappNativeGoogleSignIn = fiappNativeGoogleSignIn;

// Account page connect/change (called from account.html after the password step-up).
// Navigates to /account?google=<code>, reusing the existing notice map on that page.
async function fiappNativeGoogleLink() {
  try {
    var idt = await _fiappNativeGoogleIdToken();
    if (!idt) { window.location = '/account?google=error'; return; }
    var res = await _fiappPost('/auth/google/native_link', idt);
    var data = await res.json();
    if (res.ok && data.ok) { window.location = '/account?google=linked'; }
    else { window.location = '/account?google=' + encodeURIComponent(data.error || 'error'); }
  } catch (e) { window.location = '/account?google=error'; }
}
window.fiappNativeGoogleLink = fiappNativeGoogleLink;

// Progressive enhancement: only inside the native shell, intercept the login/register
// "Continue with Google" links (class .google-btn) and run the native flow instead.
document.addEventListener('DOMContentLoaded', function () {
  if (!fiappIsNative()) return;
  var links = document.querySelectorAll('a.google-btn');
  Array.prototype.forEach.call(links, function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      fiappNativeGoogleSignIn();
    });
  });
});

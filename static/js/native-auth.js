'use strict';

function fiappIsNative() {
  return !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function'
            && window.Capacitor.isNativePlatform());
}
window.fiappIsNative = fiappIsNative;

async function _fiappNativeGoogleIdToken() {
  var GA = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GoogleAuth;
  if (!GA) return null;
  if (typeof GA.initialize === 'function') { try { GA.initialize(); } catch (e) {  } }

  try { await GA.signOut(); } catch (e) {  }
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

/* FiApp native (Capacitor) app lock.
 *
 * Optional biometric / device-credential gate shown on every launch and resume. Loaded on
 * every page from base.html (script-src 'self', no nonce) right after native-auth.js, and a
 * strict no-op in a plain browser: fiappIsNative() is false, so nothing renders or binds and
 * the web app is entirely unaffected.
 *
 * Enabled flag lives in localStorage ('fiapp_app_lock'='1'), readable synchronously so the
 * cold-start anti-flash guard below can hide the page before first paint. See the Batch C
 * plan for the fail-open tradeoff (durability backstopped by navigator.storage.persist()).
 */
'use strict';

(function () {
  // Anti-flash: runs as this <head> script parses, before <body> paints. If the app is
  // locked, hide the page immediately; the overlay (mounted on DOMContentLoaded) then covers
  // it and this class is removed. CSS rule lives in styles.css (html.fiapp-lock-pending body).
  try {
    if (window.fiappIsNative && window.fiappIsNative()
        && localStorage.getItem('fiapp_app_lock') === '1') {
      document.documentElement.classList.add('fiapp-lock-pending');
    }
  } catch (e) { /* localStorage blocked: fall through, no lock */ }
})();

(function () {
  var LOCK_KEY = 'fiapp_app_lock';
  var _overlay = null;
  var _locking = false;   // guards against re-entrant auth (the system sheet fires app events)

  function isNative() { return !!(window.fiappIsNative && window.fiappIsNative()); }

  // Plugins are only reachable via the bridge (the remote page can't import the app's node
  // modules). @aparajita/capacitor-biometric-auth registers itself as 'BiometricAuthNative'
  // (confirmed from the published package's registerPlugin() call); 'BiometricAuth' is kept
  // as a defensive fallback in case a future major renames it.
  function bioPlugin() {
    var P = (window.Capacitor && window.Capacitor.Plugins) || {};
    return P.BiometricAuthNative || P.BiometricAuth || null;
  }
  function appPlugin() {
    var P = (window.Capacitor && window.Capacitor.Plugins) || {};
    return P.App || null;
  }

  function isEnabled() {
    try { return localStorage.getItem(LOCK_KEY) === '1'; } catch (e) { return false; }
  }

  // One biometric / device-credential challenge. Resolves true on success, false otherwise.
  async function runAuth() {
    var bio = bioPlugin();
    if (!bio) return false;
    try {
      await bio.authenticate({
        reason: 'Unlock FiApp',
        cancelTitle: 'Cancel',
        allowDeviceCredential: true,
        androidTitle: 'Unlock FiApp',
        androidSubtitle: "Confirm it's you to continue",
        androidConfirmationRequired: false,
        iosFallbackTitle: 'Use passcode'
      });
      return true;
    } catch (e) {
      return false;   // cancelled, failed, or lockout
    }
  }

  function buildOverlay() {
    if (_overlay) return _overlay;
    var o = document.createElement('div');
    o.id = 'fiapp-lock-overlay';
    // Inline styles so the overlay renders even mid-load; visibility:visible survives the
    // anti-flash body-hide. Themed via the app's own CSS vars with safe fallbacks.
    o.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:2147483647',
      'display:none', 'visibility:visible',
      'flex-direction:column', 'align-items:center', 'justify-content:center',
      'gap:1rem', 'padding:1.5rem', 'text-align:center',
      'background:var(--bg,#ffffff)', 'color:var(--fg,#0f172a)',
      'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif'
    ].join(';');
    var img = document.createElement('img');
    img.src = '/static/icons/icon-192.png';
    img.width = 72; img.height = 72; img.alt = '';
    img.style.cssText = 'width:72px;height:72px;border-radius:18px';
    var h = document.createElement('div');
    h.textContent = 'Unlock FiApp';
    h.style.cssText = 'font-size:1.15rem;font-weight:700';
    var p = document.createElement('div');
    p.textContent = 'Confirm your identity to continue.';
    p.style.cssText = 'font-size:.92rem;color:var(--muted,#475569)';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Unlock';
    btn.style.cssText = [
      'margin-top:.4rem', 'padding:.6rem 1.4rem', 'border:none', 'border-radius:9px',
      'font-weight:600', 'font-size:1rem', 'color:#fff', 'background:var(--accent,#7c3aed)',
      'cursor:pointer'
    ].join(';');
    btn.addEventListener('click', unlockAttempt);
    o.appendChild(img); o.appendChild(h); o.appendChild(p); o.appendChild(btn);
    document.body.appendChild(o);
    _overlay = o;
    return o;
  }

  function showOverlay() {
    buildOverlay().style.display = 'flex';
    // Overlay is up and opaque; safe to reveal <body> (overlay covers it).
    document.documentElement.classList.remove('fiapp-lock-pending');
  }
  function hideOverlay() {
    if (_overlay) _overlay.style.display = 'none';
    document.documentElement.classList.remove('fiapp-lock-pending');
  }

  async function unlockAttempt() {
    if (_locking) return;
    _locking = true;
    var ok = await runAuth();
    _locking = false;
    if (ok) hideOverlay();       // else leave the overlay up; the Unlock button retries
  }

  function lockNow() {
    showOverlay();
    unlockAttempt();
  }

  // ---- Account-page toggle -------------------------------------------------
  function wireToggle() {
    var card = document.getElementById('app-lock-card');
    var toggle = document.getElementById('app-lock-toggle');
    if (!card || !toggle) return;
    card.style.display = '';   // reveal only inside the native shell
    toggle.checked = isEnabled();

    var fbEl = document.getElementById('app-lock-feedback');
    function fb(msg, ok) {
      if (!fbEl) return;
      fbEl.textContent = msg;
      fbEl.style.color = ok ? 'var(--success,#2a9d4a)' : 'var(--danger,#c0392b)';
      fbEl.style.display = msg ? 'block' : 'none';
    }

    toggle.addEventListener('change', async function () {
      fb('');
      if (!toggle.checked) {                 // disable: no challenge needed
        try { localStorage.removeItem(LOCK_KEY); } catch (e) {}
        fb('App lock is off.', true);
        return;
      }
      var bio = bioPlugin();
      if (!bio) { toggle.checked = false; fb('Biometric lock is not available on this device.'); return; }
      try {
        var info = await bio.checkBiometry();
        var canAuth = info && (info.isAvailable || info.deviceIsSecure || info.strongBiometryIsAvailable);
        if (!canAuth) {
          toggle.checked = false;
          fb('Set up a fingerprint, face unlock, or a screen lock (PIN/pattern) on your device first.');
          return;
        }
      } catch (e) { /* checkBiometry unsupported shape: fall through to a real attempt */ }
      var ok = await runAuth();              // prove it works before persisting
      if (ok) {
        try { localStorage.setItem(LOCK_KEY, '1'); } catch (e) {}
        fb('App lock is on. You will unlock each time you open FiApp.', true);
      } else {
        toggle.checked = false;
        fb('Could not verify. App lock was not enabled.');
      }
    });
  }

  // ---- Wiring --------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    if (!isNative()) {
      // Never leave the page hidden in a plain browser (defensive; the guard above is native-gated).
      document.documentElement.classList.remove('fiapp-lock-pending');
      return;
    }
    buildOverlay();
    wireToggle();

    var app = appPlugin();
    if (app && app.addListener) {
      app.addListener('appStateChange', function (state) {
        if (!isEnabled()) return;
        if (state && state.isActive === false) {
          showOverlay();          // hide content in the recent-apps thumbnail + on next resume
        } else if (state && state.isActive === true) {
          if (_overlay && _overlay.style.display !== 'none') unlockAttempt();
        }
      });
    }

    // Cold start: if launched locked, challenge now.
    if (isEnabled()) lockNow();
    else document.documentElement.classList.remove('fiapp-lock-pending');
  });
})();

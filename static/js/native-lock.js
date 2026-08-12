'use strict';

(function () {
  var LOCK_KEY = 'fiapp_app_lock';
  var UNLOCKED_KEY = 'fiapp_lock_unlocked';
  var _overlay = null;
  var _locking = false;

  function isNative() { return !!(window.fiappIsNative && window.fiappIsNative()); }

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

  function isUnlockedThisSession() {
    try { return sessionStorage.getItem(UNLOCKED_KEY) === '1'; } catch (e) { return false; }
  }
  function markUnlocked() {
    try { sessionStorage.setItem(UNLOCKED_KEY, '1'); } catch (e) {}
  }
  function markLocked() {
    try { sessionStorage.removeItem(UNLOCKED_KEY); } catch (e) {}
  }

  async function runAuth() {
    var bio = bioPlugin();
    if (!bio) { console.error('[fiapp-lock] runAuth: no biometric plugin resolved'); return false; }
    var opts = {
      reason: 'Unlock FiApp',
      cancelTitle: 'Cancel',
      allowDeviceCredential: true,
      androidTitle: 'Unlock FiApp',
      androidSubtitle: "Confirm it's you to continue",
      androidConfirmationRequired: false,
      iosFallbackTitle: 'Use passcode'
    };
    try {
      if (typeof bio.authenticate === 'function') {
        await bio.authenticate(opts);
      } else if (typeof bio.internalAuthenticate === 'function') {
        await bio.internalAuthenticate(opts);
      } else {
        console.error('[fiapp-lock] neither authenticate() nor internalAuthenticate() found on plugin');
        return false;
      }
      return true;
    } catch (e) {
      console.error('[fiapp-lock] authenticate rejected:', e && e.code, e && e.message, e);
      return false;
    }
  }

  function buildOverlay() {
    if (_overlay) return _overlay;
    var o = document.createElement('div');
    o.id = 'fiapp-lock-overlay';

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
    if (ok) { markUnlocked(); hideOverlay(); }
  }

  function lockNow() {
    showOverlay();
    unlockAttempt();
  }

  function wireToggle() {
    var card = document.getElementById('app-lock-card');
    var toggle = document.getElementById('app-lock-toggle');
    if (!card || !toggle) return;
    card.style.display = '';
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
      if (!toggle.checked) {
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
      } catch (e) {
        console.error('[fiapp-lock] checkBiometry() threw:', e && e.code, e && e.message, e);
      }
      var ok = await runAuth();
      if (ok) {
        try { localStorage.setItem(LOCK_KEY, '1'); } catch (e) {}
        markUnlocked();
        fb('App lock is on. You will unlock each time you open FiApp.', true);
      } else {
        toggle.checked = false;
        fb('Could not verify. App lock was not enabled.');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!isNative()) {

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
          markLocked();
          showOverlay();
        } else if (state && state.isActive === true) {
          if (_overlay && _overlay.style.display !== 'none') unlockAttempt();
        }
      });
    }

    if (isEnabled() && !isUnlockedThisSession()) lockNow();
    else document.documentElement.classList.remove('fiapp-lock-pending');
  });
})();

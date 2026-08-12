(function () {
  'use strict';

  function isNative() { return !!(window.fiappIsNative && window.fiappIsNative()); }
  function plugin() {
    var P = (window.Capacitor && window.Capacitor.Plugins) || {};
    return P.PushNotifications || null;
  }
  function platform() {
    try { return (window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || 'android'; }
    catch (_) { return 'android'; }
  }
  function csrf() { return window._CSRF || window._csrfToken || ''; }

  var _token = null;
  var _listenersBound = false;

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
      body: JSON.stringify(body || {}),
    });
  }

  function setToggle(on) {
    var t = document.getElementById('push-toggle');
    if (t) t.checked = !!on;
  }
  function feedback(msg, bad) {
    var el = document.getElementById('push-feedback');
    if (!el) return;
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
    el.style.color = bad ? 'var(--sem-bad)' : 'var(--muted)';
  }

  function bindListeners(P) {
    if (_listenersBound) return;
    _listenersBound = true;

    P.addListener('registration', function (t) {
      _token = t && t.value;
      if (!_token) return;
      post('/api/push/register', { token: _token, platform: platform() })
        .then(function (r) {
          if (r.ok) { setToggle(true); feedback('Renewal reminders are on for this device.', false); }
          else { setToggle(false); feedback('Could not enable notifications. Please try again.', true); }
        })
        .catch(function () { setToggle(false); feedback('Could not reach the server. Please try again.', true); });
    });
    P.addListener('registrationError', function () {
      setToggle(false);
      feedback('Notifications could not be set up on this device.', true);
    });

    P.addListener('pushNotificationActionPerformed', function (ev) {
      var route = ev && ev.notification && ev.notification.data && ev.notification.data.route;
      if (route && route.charAt(1) !== '/' && /^\/[a-z/]*$/.test(route)) {
        try { window.location = route; } catch (_) {}
      }
    });
  }

  function enable() {
    var P = plugin();
    if (!P) { setToggle(false); feedback('Notifications are not available on this device.', true); return; }
    bindListeners(P);
    feedback('Setting up...', false);
    P.checkPermissions()
      .then(function (res) { return (res && res.receive === 'granted') ? res : P.requestPermissions(); })
      .then(function (res) {
        if (res && res.receive === 'granted') { P.register(); }
        else { setToggle(false); feedback('Notification permission was declined. You can enable it in system settings.', true); }
      })
      .catch(function () { setToggle(false); feedback('Could not set up notifications.', true); });
  }

  function disable() {
    feedback('', false);
    post('/api/push/unregister', { token: _token || '' }).catch(function () {});
    _token = null;
  }

  function init() {
    if (!isNative()) return;
    var card = document.getElementById('push-card');
    var toggle = document.getElementById('push-toggle');
    if (!card || !toggle) return;
    card.style.display = '';
    var P = plugin();
    if (P) bindListeners(P);
    toggle.addEventListener('change', function () { toggle.checked ? enable() : disable(); });

    var over = document.getElementById('push-overspend-toggle');
    if (over) {
      over.addEventListener('change', function () {
        var want = over.checked;
        fetch('/api/prefs', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
          body: JSON.stringify({ push_overspend: want }),
        }).then(function (r) {
          if (!r.ok) { over.checked = !want; feedback('Could not save that preference.', true); }
        }).catch(function () {
          over.checked = !want; feedback('Could not reach the server. Please try again.', true);
        });
      });
    }

    fetch('/api/prefs').then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        if (d.push_enabled) setToggle(true);
        if (over && d.push_overspend) over.checked = true;
      })
      .catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

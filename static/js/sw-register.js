/* Registers the FiApp service worker at root scope.
 *
 * Loaded as an external script (covered by script-src 'self', so no nonce needed).
 * base.html appends ?v={{ ASSET_V }} to THIS script's src; we forward that version
 * onto the /sw.js registration URL so each deploy registers a new scriptURL, which
 * guarantees the browser runs an update check and the new SW purges old caches.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  var v = '';
  try {
    var me = document.currentScript;
    if (me && me.src) v = new URL(me.src).searchParams.get('v') || '';
  } catch (e) { /* non-fatal: fall back to an unversioned register */ }

  var url = '/sw.js' + (v ? ('?v=' + encodeURIComponent(v)) : '');
  var _reg = null;

  function refreshPrecache() {
    if (_reg && _reg.active) _reg.active.postMessage({ type: 'refresh-precache' });
  }

  // Fill any empty tracker localStorage keys from the server while online.
  // Only runs when a key is missing or has no rows/cells - never overwrites
  // existing local data, so offline edits are safe.
  var _TRACKERS = [
    ['fiapp_expenses_v4', '/api/load/expenses'],
    ['fiapp_income_v1',   '/api/load/income'],
    ['fiapp_subs_v4',     '/api/load/subs'],
  ];
  function _seedOfflineCache() {
    if (!navigator.onLine) return;
    _TRACKERS.forEach(function(pair) {
      try {
        var raw = localStorage.getItem(pair[0]);
        if (raw) {
          var p = JSON.parse(raw);
          var hasContent = (Array.isArray(p.rows) && p.rows.length > 0) ||
                           (p.cells && Object.keys(p.cells).length > 0);
          if (hasContent) return; // already has data, skip
        }
      } catch (e) {}
      fetch(pair[1], { credentials: 'same-origin' }).then(function(res) {
        if (!res.ok) return;
        return res.json().then(function(resp) {
          var d = resp && resp.data;
          if (!d || typeof d !== 'object') return;
          var hasContent = (Array.isArray(d.rows) && d.rows.length > 0) ||
                           (d.cells && Object.keys(d.cells).length > 0);
          if (hasContent) {
            try { localStorage.setItem(pair[0], JSON.stringify(d)); } catch (_) {}
          }
        });
      }).catch(function() {});
    });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(url, { scope: '/' }).then(function (reg) {
      _reg = reg;
      return navigator.serviceWorker.ready;
    }).then(refreshPrecache).catch(function () {});
    _seedOfflineCache();
  });

  window.addEventListener('online', function() {
    refreshPrecache();
    _seedOfflineCache();
  });
})();

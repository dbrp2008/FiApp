/* Registers the FiApp service worker at root scope, and hosts the two globals
 * that keep offline data healthy on EVERY page (not just tracker pages):
 *   - window.__fiappFlushDirtyTrackers: pushes offline edits (dirty trackers)
 *     to the server on load / reconnect.
 *   - window.__fiappSeedTrackers: fills EMPTY tracker localStorage keys from
 *     the server while online (never overwrites existing or dirty data).
 *
 * Loaded as an external script (covered by script-src 'self', so no nonce
 * needed). base.html appends ?v={{ ASSET_V }} to THIS script's src; we forward
 * that version onto the /sw.js registration URL so each deploy registers a new
 * scriptURL, which guarantees the browser runs an update check and the new SW
 * purges old caches.
 */
(function () {
  var _TRACKERS = [
    ['fiapp_expenses_v4', '/api/load/expenses', '/api/save/expenses'],
    ['fiapp_income_v1',   '/api/load/income',   '/api/save/income'],
    ['fiapp_subs_v4',     '/api/load/subs',     '/api/save/subs'],
  ];

  // Push any tracker with unsynced offline edits (<key>__dirty) to the server.
  // Skips keys owned by the current page's sync manager (it has richer 409
  // handling). On 409/401/network failure the flag stays set - the data is safe
  // in localStorage and the tracker page merges properly on its next open.
  function _flushDirtyTrackers() {
    if (navigator.onLine === false) return;
    _TRACKERS.forEach(function (t) {
      var key = t[0], saveApi = t[2];
      try {
        if (window.__fiappSyncManagedKeys && window.__fiappSyncManagedKeys[key]) return;
        if (!localStorage.getItem(key + '__dirty')) return;
        var blob = JSON.parse(localStorage.getItem(key) || 'null');
        if (!blob || typeof blob !== 'object') return;
        var flushedAt = Date.now();
        fetch(saveApi, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window._CSRF || '' },
          body: JSON.stringify({ data: blob, base_version: parseInt(localStorage.getItem(key + '__ver') || '0', 10) })
        }).then(function (r) {
          if (!r.ok) return; // 409/401/...: leave __dirty for the tracker page to resolve
          return r.json().then(function (resp) {
            if (resp && typeof resp.version === 'number') {
              try { localStorage.setItem(key + '__ver', String(resp.version)); } catch (_) {}
            }
            var d = parseInt(localStorage.getItem(key + '__dirty') || '0', 10);
            if (d && d <= flushedAt) { try { localStorage.removeItem(key + '__dirty'); } catch (_) {} }
          });
        }).catch(function () {});
      } catch (e) { /* per-tracker best-effort */ }
    });
  }
  window.__fiappFlushDirtyTrackers = _flushDirtyTrackers;

  // Fill any empty tracker localStorage keys from the server while online.
  // Only runs when a key is missing or has no rows/cells - never overwrites
  // existing local data. Dirty keys are skipped too: an empty-but-dirty state
  // can mean "user deleted rows offline", and reseeding would resurrect them.
  function _seedOfflineCache() {
    if (navigator.onLine === false) return;
    _TRACKERS.forEach(function (t) {
      var key = t[0], loadApi = t[1];
      try {
        if (localStorage.getItem(key + '__dirty')) return;
        var raw = localStorage.getItem(key);
        if (raw) {
          var p = JSON.parse(raw);
          var hasContent = (Array.isArray(p.rows) && p.rows.length > 0) ||
                           (p.cells && Object.keys(p.cells).length > 0);
          if (hasContent) return; // already has data, skip
        }
      } catch (e) {}
      fetch(loadApi, { credentials: 'same-origin' }).then(function (res) {
        if (!res.ok) return;
        return res.json().then(function (resp) {
          var d = resp && resp.data;
          if (!d || typeof d !== 'object') return;
          var hasContent = (Array.isArray(d.rows) && d.rows.length > 0) ||
                           (d.cells && Object.keys(d.cells).length > 0);
          if (hasContent) {
            try { localStorage.setItem(key, JSON.stringify(d)); } catch (_) {}
          }
        });
      }).catch(function () {});
    });
  }
  window.__fiappSeedTrackers = _seedOfflineCache;

  window.addEventListener('online', function () {
    _flushDirtyTrackers();
    _seedOfflineCache();
  });

  if (!('serviceWorker' in navigator)) {
    // No SW support: still flush/seed on load so offline edits sync.
    window.addEventListener('load', function () {
      _flushDirtyTrackers();
      _seedOfflineCache();
    });
    return;
  }

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

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(url, { scope: '/' }).then(function (reg) {
      _reg = reg;
      return navigator.serviceWorker.ready;
    }).then(refreshPrecache).catch(function () {});
    // Ask the browser not to evict this origin's storage under pressure
    // (protects localStorage + SW caches on Android; iOS decides for itself).
    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) {}
    _flushDirtyTrackers();
    _seedOfflineCache();
  });

  window.addEventListener('online', refreshPrecache);
})();

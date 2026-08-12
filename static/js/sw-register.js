(function () {
  var _TRACKERS = [
    ['fiapp_expenses_v4', '/api/load/expenses', '/api/save/expenses'],
    ['fiapp_income_v1',   '/api/load/income',   '/api/save/income'],
    ['fiapp_subs_v4',     '/api/load/subs',     '/api/save/subs'],
  ];

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
          if (!r.ok) return;
          return r.json().then(function (resp) {
            if (resp && typeof resp.version === 'number') {
              try { localStorage.setItem(key + '__ver', String(resp.version)); } catch (_) {}
            }
            var d = parseInt(localStorage.getItem(key + '__dirty') || '0', 10);
            if (d && d <= flushedAt) { try { localStorage.removeItem(key + '__dirty'); } catch (_) {} }
          });
        }).catch(function () {});
      } catch (e) {  }
    });
  }
  window.__fiappFlushDirtyTrackers = _flushDirtyTrackers;

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
          if (hasContent) return;
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
  } catch (e) {  }

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

    try {
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});
    } catch (e) {}
    _flushDirtyTrackers();
    _seedOfflineCache();
  });

  window.addEventListener('online', refreshPrecache);
})();

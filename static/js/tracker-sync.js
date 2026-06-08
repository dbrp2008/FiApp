// tracker-sync.js — Shared server-sync manager for FiApp trackers
// Usage:
//   var sync = createSyncManager(storageKey, saveApiPath, loadApiPath, opts);
//   var syncToServer   = sync.syncToServer;
//   var loadFromServer = sync.loadFromServer;
//   var setSyncStatus  = sync.setSyncStatus;
//   var saveLocal      = sync.saveLocal;
//
// opts (all optional):
//   getState()       : returns the tracker's current state object (required for saveLocal)
//   onReload()       : called after server data is loaded in the stale-reload path,
//                      and again after a 409 conflict has been merged into localStorage
//   onMerge(message) : called after a 409 merge actually changes the user's local view,
//                      so the tracker can surface a brief "merged changes" toast
//   showQuotaWarning(): called when localStorage quota is exceeded
//   contentGuard(data): returns true if server response has real content worth persisting
//                       default: checks data.rows || data.cells || data.rowsByMonth

// How many times one save cycle will retry after a 409 before giving up (and marking
// the status as failed). Each retry re-merges against the latest server state, so this
// only matters for back-to-back conflicts landing on the same save attempt.
var _MAX_MERGE_RETRIES = 3;

// Order-independent deep equality for plain JSON values (objects/arrays/primitives).
// Needed because a blob that round-trips through the server's JSONB column can come
// back with object keys in a different order than the client's own JSON.stringify,
// even when the underlying data is byte-for-byte the same.
function _deepEqual(a, b) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) { if (!_deepEqual(a[i], b[i])) return false; }
    return true;
  }
  var ak = Object.keys(a), bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (var j = 0; j < ak.length; j++) {
    var k = ak[j];
    if (!Object.prototype.hasOwnProperty.call(b, k) || !_deepEqual(a[k], b[k])) return false;
  }
  return true;
}

// Merges a local tracker blob with the server's blob after a 409 conflict.
//   - cells/cellTimes: union of keys; whichever side has the strictly-newer cellTimes
//     entry wins (a key absent from `cells` but present in `cellTimes` is a deletion);
//     ties prefer whichever side actually has a value, then fall back to the server.
//   - Every other field (rows, cols, goals, rowsByMonth, income, collapsed, ...) is
//     taken wholesale from the server's blob — EXCEPT currentYear/currentMonth, which
//     (mirroring loadFromServer's existing stale-reload behavior below) stay on the
//     local device's own choice, since they're per-device viewing state, not synced data.
function _mergeTrackerBlobs(localBlob, serverBlob) {
  var local  = (localBlob  && typeof localBlob  === 'object') ? localBlob  : {};
  var server = (serverBlob && typeof serverBlob === 'object') ? serverBlob : local;
  var merged = JSON.parse(JSON.stringify(server));

  var localCells  = local.cells      || {};
  var localTimes  = local.cellTimes  || {};
  var serverCells = server.cells     || {};
  var serverTimes = server.cellTimes || {};

  var keys = {};
  Object.keys(localCells).forEach(function(k)  { keys[k] = true; });
  Object.keys(localTimes).forEach(function(k)  { keys[k] = true; });
  Object.keys(serverCells).forEach(function(k) { keys[k] = true; });
  Object.keys(serverTimes).forEach(function(k) { keys[k] = true; });

  var mergedCells = {};
  var mergedTimes = {};
  Object.keys(keys).forEach(function(k) {
    var lHas  = Object.prototype.hasOwnProperty.call(localCells, k);
    var sHas  = Object.prototype.hasOwnProperty.call(serverCells, k);
    var lTime = localTimes[k]  || 0;
    var sTime = serverTimes[k] || 0;
    var useLocal;
    if (lTime !== sTime)    useLocal = lTime > sTime;
    else if (lHas !== sHas) useLocal = lHas;   // tie, one side a tombstone: the value wins
    else                    useLocal = false;  // genuine tie: server/incoming wins

    if (useLocal) {
      if (lHas)  mergedCells[k] = localCells[k];
      if (lTime) mergedTimes[k] = lTime;
    } else {
      if (sHas)  mergedCells[k] = serverCells[k];
      if (sTime) mergedTimes[k] = sTime;
    }
  });

  merged.cells = mergedCells;
  merged.cellTimes = mergedTimes;
  if (local.currentYear != null) {
    merged.currentYear = local.currentYear;
    merged.currentMonth = local.currentMonth;
  }
  return merged;
}

function createSyncManager(storageKey, saveApiPath, loadApiPath, opts) {
  opts = opts || {};

  var _syncTimer      = null;
  var _syncPending    = false;
  var _serverLoaded   = false;
  var _wtWasBlocking  = false;
  var _reloadPending  = false;
  var _baseVersion    = 0;

  function setSyncStatus(msg, cls) {
    var el = document.getElementById('sync-status');
    if (!el) return;
    el.textContent = msg; el.className = cls || '';
  }

  function _buildSavePayload() {
    var blob = null;
    try { blob = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
    return JSON.stringify({ data: blob, base_version: _baseVersion });
  }

  // A 409 means our base_version is stale: merge the server's current blob with
  // whatever's in localStorage right now, persist + adopt the merged result, then
  // retry the save against the version we just learned about.
  function _resolveConflict(resp, retriesLeft) {
    var serverData = resp && resp.server_data;
    var serverVersion = (resp && typeof resp.server_version === 'number') ? resp.server_version : _baseVersion;
    var localBlob = null;
    try { localBlob = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}

    var merged = _mergeTrackerBlobs(localBlob, serverData);
    var changed = !_deepEqual(merged, localBlob);

    localStorage.setItem(storageKey, JSON.stringify(merged));
    _baseVersion = serverVersion;
    if (opts.onReload) opts.onReload();
    if (changed && opts.onMerge) opts.onMerge('Merged changes from another device');

    _attemptSave(retriesLeft - 1);
  }

  function _attemptSave(retriesLeft) {
    fetch(saveApiPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window._CSRF || ''
      },
      body: _buildSavePayload()
    })
    .then(function(r) {
      if (r.ok) {
        return r.json().then(function(resp) {
          if (resp && typeof resp.version === 'number') _baseVersion = resp.version;
          setSyncStatus(
            '☁ Saved at ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            'synced'
          );
        });
      }
      if (r.status === 409 && retriesLeft > 0) {
        return r.json().then(function(resp) { _resolveConflict(resp, retriesLeft); });
      }
      setSyncStatus('⚠ Sync failed', 'failed');
    })
    .catch(function() { setSyncStatus('⚠ Offline', 'failed'); });
  }

  function syncToServer() {
    if (!window.__currentUser) { setSyncStatus('Offline', ''); return; }
    try {
      var _wts = JSON.parse(localStorage.getItem('fiapp_walkthrough_v1') || 'null');
      if (_wts && _wts.active) { setSyncStatus('', ''); return; }
    } catch (_) {}
    if (!_serverLoaded) {
      if (_wtWasBlocking && !_reloadPending) {
        _reloadPending = true;
        setSyncStatus('Loading…', '');
        loadFromServer().then(function() {
          if (opts.onReload) opts.onReload();
          _reloadPending = false;
          setSyncStatus('', '');
        }).catch(function() {
          _serverLoaded = true;
          _reloadPending = false;
          setSyncStatus('', '');
        });
      }
      return;
    }
    _syncPending = true;
    if (_syncTimer) clearTimeout(_syncTimer);
    _syncTimer = setTimeout(function() {
      _syncPending = false;
      _attemptSave(_MAX_MERGE_RETRIES);
    }, 1500);

    // Flush to server immediately on page unload if a sync is still pending
    window.addEventListener('beforeunload', function() {
      if (!_syncPending) return;
      fetch(saveApiPath, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window._CSRF || ''
        },
        body: _buildSavePayload()
      });
    }, { once: true });
  }

  function loadFromServer() {
    if (!window.__currentUser) return Promise.resolve();
    try {
      var _wtr = JSON.parse(localStorage.getItem('fiapp_walkthrough_v1') || 'null');
      if (_wtr && _wtr.active) {
        _wtWasBlocking = true;
        return Promise.resolve();
      }
    } catch (_) {}
    return fetch(loadApiPath).then(function(res) {
      if (!res.ok) { _serverLoaded = true; return; }
      return res.json().then(function(resp) {
        var data = resp && resp.data;
        if (resp && typeof resp.version === 'number') _baseVersion = resp.version;
        var guard = opts.contentGuard || function(d) {
          return Array.isArray(d.rows) || d.cells || d.rowsByMonth;
        };
        if (data && typeof data === 'object' && guard(data)) {
          var _srvHas = data.cells && Object.keys(data.cells).length > 0;
          var _locRaw = localStorage.getItem(storageKey);
          var _locHas = _locRaw && (function() {
            try { var l = JSON.parse(_locRaw); return l.cells && Object.keys(l.cells).length > 0; }
            catch (_) { return false; }
          })();
          if (_srvHas || !_locHas) {
            try {
              var _ln = JSON.parse(_locRaw || 'null');
              if (_ln && _ln.currentYear != null) {
                data.currentYear = _ln.currentYear;
                data.currentMonth = _ln.currentMonth;
              }
            } catch (_) {}
            localStorage.setItem(storageKey, JSON.stringify(data));
          }
        }
        _serverLoaded = true;
      });
    }).catch(function() { _serverLoaded = true; });
  }

  function saveLocal() {
    try {
      var _s = JSON.stringify(opts.getState ? opts.getState() : {});
      if (localStorage.getItem(storageKey) !== _s) localStorage.setItem(storageKey, _s);
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.error('FiApp: localStorage quota exceeded');
        if (opts.showQuotaWarning) opts.showQuotaWarning();
      } else { throw e; }
    }
  }

  return {
    syncToServer:   syncToServer,
    loadFromServer: loadFromServer,
    setSyncStatus:  setSyncStatus,
    saveLocal:      saveLocal
  };
}

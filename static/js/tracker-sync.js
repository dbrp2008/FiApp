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

// Merges two arrays of {id,...} objects (rows or columns) by unioning on `id`,
// preserving each side's ordering for items it contributed and appending any
// items the other side added that it doesn't have. Items present on both sides
// keep the local version (the side currently trying to save — the freshest
// edit from the user's perspective).
//
// Why this matters: bulk operations (CSV/OFX import, paste, "+Row"/"+Column",
// copy-from-previous-month) create NEW rows/cols *and* new cells in the same
// state mutation. Taking rows/cols wholesale from the server would silently
// drop those newly-created rows/cols on a 409, while the cell-merge logic below
// (which operates on `cells`/`cellTimes` independently) keeps the values that
// reference them — leaving orphaned cells that point at rows/cols which no
// longer exist, and are therefore permanently invisible in the UI.
function _mergeIdArrays(localArr, serverArr) {
  var local  = Array.isArray(localArr)  ? localArr  : [];
  var server = Array.isArray(serverArr) ? serverArr : [];
  var byId = {};
  var order = [];
  server.forEach(function(item) {
    if (item && item.id != null && !Object.prototype.hasOwnProperty.call(byId, item.id)) {
      byId[item.id] = item; order.push(item.id);
    }
  });
  local.forEach(function(item) {
    if (!item || item.id == null) return;
    if (!Object.prototype.hasOwnProperty.call(byId, item.id)) order.push(item.id);
    byId[item.id] = item; // local wins when both sides have this id
  });
  return order.map(function(id) { return byId[id]; });
}

// Same id-union merge, applied per month-key for rowsByMonth/colsByMonth maps.
function _mergeArraysByMonth(localMap, serverMap) {
  var local  = (localMap  && typeof localMap  === 'object') ? localMap  : {};
  var server = (serverMap && typeof serverMap === 'object') ? serverMap : {};
  var out = {};
  Object.keys(server).forEach(function(mk) { out[mk] = server[mk]; });
  Object.keys(local).forEach(function(mk) { out[mk] = _mergeIdArrays(local[mk], server[mk]); });
  return out;
}

// Merges a local tracker blob with the server's blob after a 409 conflict.
//   - cells/cellTimes: union of keys; whichever side has the strictly-newer cellTimes
//     entry wins (a key absent from `cells` but present in `cellTimes` is a deletion);
//     ties prefer whichever side actually has a value, then fall back to the server.
//   - rows/cols/rowsByMonth/colsByMonth: id-union merge (see _mergeIdArrays) so that
//     bulk operations which add new rows/cols can't have those additions clobbered.
//   - Every other field (goals, income, collapsed, ...) is taken wholesale from the
//     server's blob — EXCEPT currentYear/currentMonth, which (mirroring loadFromServer's
//     existing stale-reload behavior below) stay on the local device's own choice,
//     since they're per-device viewing state, not synced data.
function _mergeTrackerBlobs(localBlob, serverBlob) {
  var local  = (localBlob  && typeof localBlob  === 'object') ? localBlob  : {};
  var server = (serverBlob && typeof serverBlob === 'object') ? serverBlob : local;
  var merged = JSON.parse(JSON.stringify(server));

  if (local.rows  || server.rows)  merged.rows = _mergeIdArrays(local.rows, server.rows);
  if (local.cols  || server.cols)  merged.cols = _mergeIdArrays(local.cols, server.cols);
  if (local.rowsByMonth || server.rowsByMonth) merged.rowsByMonth = _mergeArraysByMonth(local.rowsByMonth, server.rowsByMonth);
  if (local.colsByMonth || server.colsByMonth) merged.colsByMonth = _mergeArraysByMonth(local.colsByMonth, server.colsByMonth);

  // expenses.js's per-month budget-panel figures (gross/tax/taxCurrency), keyed by
  // month like rowsByMonth. This merge only runs while a local edit is unsynced
  // (loadFromServer's dirty path, or a 409 during save) - taking it wholesale from
  // the server like the fields below would silently discard whatever just changed
  // locally (e.g. the tax calculator's "apply to month" carryover racing the boot-time
  // server fetch: the tax gets set and saved locally, but since save() can't actually
  // reach the server until _serverLoaded flips true, the local edit sits unsynced and
  // this merge is exactly what's supposed to protect it). Per-month, local wins when
  // both sides have the same month - same principle as the row/col id-union above.
  if (local.income || server.income) merged.income = Object.assign({}, server.income || {}, local.income || {});

  // recurringRules ride the wholesale server copy, but on the dirty/409 path the local
  // device may hold rules the server hasn't seen yet - keep local when the server has none.
  if (local.recurringRules && (!server.recurringRules || !server.recurringRules.length)) {
    merged.recurringRules = local.recurringRules;
  }

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

// Per-month row/column reconstruction, shared by the expenses and income trackers (their
// getRows/getCols were previously byte-identical copies). Returns the month's own forked
// rows/cols if that month has been forked, else falls back to the global rows/cols.
// A forked-but-empty month is returned as-is (truthy check) — that's the trackers' current
// behavior; note analytics_core's expRows uses a length>0 check instead, an intentional
// difference left untouched here.
function effectiveRowsForMonth(state, mk) {
  return (state && state.rowsByMonth && state.rowsByMonth[mk]) ? state.rowsByMonth[mk] : (state && state.rows) || [];
}
function effectiveColsForMonth(state, mk) {
  return (state && state.colsByMonth && state.colsByMonth[mk]) ? state.colsByMonth[mk] : (state && state.cols) || [];
}

// Is the onboarding walkthrough currently active? Centralizes the localStorage read +
// JSON parse + guard the trackers previously inlined at ~19 call sites (each with its own
// try/catch). Returns false on any parse error, matching the inlined behavior.
function isWalkthroughActive() {
  try {
    var w = JSON.parse(localStorage.getItem('fiapp_walkthrough_v1') || 'null');
    return !!(w && w.active);
  } catch (e) { return false; }
}

function createSyncManager(storageKey, saveApiPath, loadApiPath, opts) {
  opts = opts || {};

  // Pages with a live sync manager own their key's flushing; the global flusher
  // in sw-register.js skips these (see window.__fiappFlushDirtyTrackers).
  try {
    window.__fiappSyncManagedKeys = window.__fiappSyncManagedKeys || {};
    window.__fiappSyncManagedKeys[storageKey] = true;
  } catch (_) {}

  function _setDirty()   { try { localStorage.setItem(storageKey + '__dirty', String(Date.now())); } catch (_) {} }
  function _getDirty()   { try { return localStorage.getItem(storageKey + '__dirty'); } catch (_) { return null; } }
  function _persistVer(v){ try { localStorage.setItem(storageKey + '__ver', String(v)); } catch (_) {} }

  var _syncTimer      = null;
  var _syncPending    = false;
  var _serverLoaded   = false;
  var _wtWasBlocking  = false;
  var _reloadPending  = false;
  var _baseVersion    = 0;

  function setSyncStatus(msg, cls) {
    var el = document.getElementById('sync-status');
    if (!el) return;
    // C4 (Playful): a small sparkle on the saved confirmation. Default/Quiet unchanged.
    if (cls === 'synced' && msg && window.fiappPersonality && fiappPersonality() === 'playful') msg += ' ✨';
    el.textContent = msg; el.className = cls || '';
  }

  // Surface the existing revision-history safety net (server keeps the last
  // _REVISION_KEEP=20 versions per tracker, app.py) next to the save status —
  // trust signal, not a transient status message, so it's a separate static element.
  (function() {
    var statusEl = document.getElementById('sync-status');
    if (!statusEl || document.getElementById('sync-revision-note')) return;
    var note = document.createElement('span');
    note.id = 'sync-revision-note';
    note.textContent = 'Autosaved · last 20 versions kept';
    statusEl.insertAdjacentElement('afterend', note);
  })();

  function _buildSavePayload() {
    var blob = null;
    try { blob = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
    if (!blob || typeof blob !== 'object' || !Array.isArray(blob.rows)) {
      blob = opts.getState ? opts.getState() : blob;
    }
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
    _persistVer(serverVersion);
    if (opts.onReload) opts.onReload();
    if (changed && opts.onMerge) opts.onMerge('Merged changes from another device');

    _attemptSave(retriesLeft - 1);
  }

  function _attemptSave(retriesLeft) {
    var _payloadTime = Date.now();
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
          if (resp && typeof resp.version === 'number') { _baseVersion = resp.version; _persistVer(resp.version); }
          // Clear the dirty flag only if no edit landed after this payload was
          // built; a newer edit has its own pending save that will clear it.
          var d = parseInt(_getDirty() || '0', 10);
          if (d && d <= _payloadTime) { try { localStorage.removeItem(storageKey + '__dirty'); } catch (_) {} }
          setSyncStatus(
            '☁ Saved at ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}),
            'synced'
          );
        });
      }
      if (r.status === 409 && retriesLeft > 0) {
        return r.json().then(function(resp) { _resolveConflict(resp, retriesLeft); });
      }
      _setDirty();
      setSyncStatus('⚠ Sync failed', 'failed');
    })
    .catch(function() { _setDirty(); setSyncStatus('Saved locally - will sync when online', 'failed'); });
  }

  function syncToServer() {
    try {
      var _wts = JSON.parse(localStorage.getItem('fiapp_walkthrough_v1') || 'null');
      if (_wts && _wts.active) { setSyncStatus('', ''); return; }
    } catch (_) {}
    // A data edit is pending until the server acks it. Marked here rather than in
    // saveLocal so per-device view-state writes (month navigation, derived income
    // mirrors - saveLocal-only callers) don't flag the blob as needing merge/flush.
    _setDirty();
    if (!window.__currentUser) { setSyncStatus('Saved locally - will sync when online', 'failed'); return; }
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
        if (resp && typeof resp.version === 'number') _persistVer(resp.version);
        var guard = opts.contentGuard || function(d) {
          return Array.isArray(d.rows) || d.cells || d.rowsByMonth;
        };
        if (data && typeof data === 'object' && guard(data)) {
          if (_getDirty()) {
            // Unsynced offline edits exist: merge the server's blob into the local
            // one (cells win by newer cellTimes, rows/cols union by id) instead of
            // overwriting, then push the merged result. __dirty clears only when
            // the server acks that save.
            var _dirtyLocal = null;
            try { _dirtyLocal = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
            localStorage.setItem(storageKey, JSON.stringify(_mergeTrackerBlobs(_dirtyLocal, data)));
            _serverLoaded = true;
            _attemptSave(_MAX_MERGE_RETRIES);
            return;
          }
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

  function flushIfDirty() {
    if (!_getDirty()) return;
    if (!window.__currentUser) return;
    _attemptSave(_MAX_MERGE_RETRIES);
  }

  // Reconnect: __currentUser is null after an offline boot (auth/me failed), so
  // re-establish it before flushing any pending offline edits.
  try {
    window.addEventListener('online', function () {
      var authP = (typeof window.fiappFetchTimeout === 'function')
        ? window.fiappFetchTimeout('/auth/me', 5000)
        : fetch('/auth/me');
      authP.then(function (r) { return r.json(); }).then(function (me) {
        if (me && me.username) window.__currentUser = me.username;
        flushIfDirty();
      }).catch(function () {});
    });
  } catch (_) {}

  return {
    syncToServer:   syncToServer,
    loadFromServer: loadFromServer,
    setSyncStatus:  setSyncStatus,
    saveLocal:      saveLocal,
    flushIfDirty:   flushIfDirty
  };
}

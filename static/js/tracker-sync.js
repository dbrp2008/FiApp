var _MAX_MERGE_RETRIES = 3;

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

function _mergeIdArrays(localArr, serverArr, maxLen) {
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
    byId[item.id] = item;
  });
  var out = order.map(function(id) { return byId[id]; });

  if (maxLen && out.length > maxLen) out = out.slice(0, maxLen);
  return out;
}

function _mergeArraysByMonth(localMap, serverMap, maxLen) {
  var local  = (localMap  && typeof localMap  === 'object') ? localMap  : {};
  var server = (serverMap && typeof serverMap === 'object') ? serverMap : {};
  var out = {};
  Object.keys(server).forEach(function(mk) { out[mk] = server[mk]; });
  Object.keys(local).forEach(function(mk) { out[mk] = _mergeIdArrays(local[mk], server[mk], maxLen); });
  return out;
}

function _mergeTrackerBlobs(localBlob, serverBlob, caps) {
  var local  = (localBlob  && typeof localBlob  === 'object') ? localBlob  : {};
  var server = (serverBlob && typeof serverBlob === 'object') ? serverBlob : local;
  var merged = JSON.parse(JSON.stringify(server));
  caps = caps || {};

  if (local.rows  || server.rows)  merged.rows = _mergeIdArrays(local.rows, server.rows, caps.rows);
  if (local.cols  || server.cols)  merged.cols = _mergeIdArrays(local.cols, server.cols, caps.cols);
  if (local.rowsByMonth || server.rowsByMonth) merged.rowsByMonth = _mergeArraysByMonth(local.rowsByMonth, server.rowsByMonth, caps.rows);
  if (local.colsByMonth || server.colsByMonth) merged.colsByMonth = _mergeArraysByMonth(local.colsByMonth, server.colsByMonth, caps.cols);

  if (local.income || server.income) merged.income = Object.assign({}, server.income || {}, local.income || {});

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
    else if (lHas !== sHas) useLocal = lHas;
    else                    useLocal = false;

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

function effectiveRowsForMonth(state, mk) {
  return (state && state.rowsByMonth && state.rowsByMonth[mk]) ? state.rowsByMonth[mk] : (state && state.rows) || [];
}
function effectiveColsForMonth(state, mk) {
  return (state && state.colsByMonth && state.colsByMonth[mk]) ? state.colsByMonth[mk] : (state && state.cols) || [];
}

function isWalkthroughActive() {
  try {
    var w = JSON.parse(localStorage.getItem('fiapp_walkthrough_v1') || 'null');
    return !!(w && w.active);
  } catch (e) { return false; }
}

function createSyncManager(storageKey, saveApiPath, loadApiPath, opts) {
  opts = opts || {};

  var _caps = { rows: opts.maxRows, cols: opts.maxCols };

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

    if (cls === 'synced' && msg && window.fiappPersonality && fiappPersonality() === 'playful') msg += ' ✨';
    el.textContent = msg; el.className = cls || '';
  }

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

  function _resolveConflict(resp, retriesLeft) {
    var serverData = resp && resp.server_data;
    var serverVersion = (resp && typeof resp.server_version === 'number') ? resp.server_version : _baseVersion;
    var localBlob = null;
    try { localBlob = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}

    var merged = _mergeTrackerBlobs(localBlob, serverData, _caps);
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

      return r.json().catch(function() { return {}; }).then(function(resp) {
        var why = (resp && resp.error) ? ' - ' + resp.error : '';
        setSyncStatus('⚠ Sync failed' + why, 'failed');
      });
    })
    .catch(function() { _setDirty(); setSyncStatus('Saved locally - will sync when online', 'local'); });
  }

  function syncToServer() {
    try {
      var _wts = JSON.parse(localStorage.getItem('fiapp_walkthrough_v1') || 'null');
      if (_wts && _wts.active) { setSyncStatus('', ''); return; }
    } catch (_) {}

    _setDirty();
    if (!window.__currentUser) { setSyncStatus('Local only - sign in to sync', 'local'); return; }
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

            var _dirtyLocal = null;
            try { _dirtyLocal = JSON.parse(localStorage.getItem(storageKey) || 'null'); } catch (_) {}
            localStorage.setItem(storageKey, JSON.stringify(_mergeTrackerBlobs(_dirtyLocal, data, _caps)));
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

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

  // The SW's own 'activate' handler already covers a silent background update
  // (claim() can take over open tabs with no reload), but a normal reload of an
  // already-active worker never refires 'activate' - so refreshing here on every
  // load, and again on reconnect, is what actually keeps pages cache-fresh day to day.
  function refreshPrecache() {
    if (_reg && _reg.active) _reg.active.postMessage({ type: 'refresh-precache' });
  }

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(url, { scope: '/' }).then(function (reg) {
      _reg = reg;
      return navigator.serviceWorker.ready;
    }).then(refreshPrecache).catch(function () {
      /* registration failure must never break the page */
    });
  });

  window.addEventListener('online', refreshPrecache);
})();

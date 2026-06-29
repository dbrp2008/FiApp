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

  window.addEventListener('load', function () {
    navigator.serviceWorker.register(url, { scope: '/' }).catch(function () {
      /* registration failure must never break the page */
    });
  });
})();

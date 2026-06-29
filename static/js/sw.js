/* FiApp service worker.
 *
 * Served at the root scope via the Flask /sw.js route (NOT registered from
 * /static/), so it can control the whole origin. The route prepends
 *   self.__SW_VERSION = "<ASSET_V>";
 * so every Render deploy (new ASSET_V) produces a byte-different SW that the
 * browser treats as an update, and the activate handler purges the previous
 * deploy's caches.
 *
 * Strategy (deliberately network-first for pages so push-to-deploy still wins):
 *   - navigations/HTML : network-first -> cached page -> offline fallback
 *   - /static/* + /styles.css : stale-while-revalidate
 *   - /api/*, /auth/*  : never touched (per-user, must be fresh)
 */
'use strict';

var VERSION = self.__SW_VERSION || 'dev';
var CACHE = 'fiapp-' + VERSION;
var OFFLINE_URL = '/__offline';

// Built in-SW (not fetched) so it's always available even on a cold first offline load.
var OFFLINE_HTML =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<title>FiApp - Offline</title>' +
  '<style>html,body{height:100%;margin:0}' +
  'body{display:flex;align-items:center;justify-content:center;' +
  'font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
  'background:#ffffff;color:#0f172a;text-align:center;padding:1.5rem}' +
  '.c{max-width:22rem}.m{width:72px;height:72px;border-radius:18px;margin:0 auto 1rem;display:block}' +
  'h1{font-size:1.15rem;margin:.2rem 0 .5rem}p{color:#475569;font-size:.92rem;line-height:1.5}' +
  '.btn{display:inline-block;margin-top:1.1rem;padding:.6rem 1.1rem;border-radius:9px;' +
  'text-decoration:none;font-weight:600;color:#fff;background:#7c3aed}</style></head><body><div class="c">' +
  '<img class="m" src="/static/icons/icon-192.png" width="72" height="72" alt="FiApp"><h1>You are offline</h1>' +
  '<p>FiApp could not reach the network. Your saved data on this device is still safe; ' +
  'reconnect to sync and load the latest.</p>' +
  '<a class="btn" href="/">Try again</a></div></body></html>';

self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    var cache = await caches.open(CACHE);
    await cache.put(OFFLINE_URL, new Response(OFFLINE_HTML, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    }));
    // Precache the icon the offline page references, so it renders even on a
    // cold install that never had a prior successful /static/* fetch to fall back on.
    try {
      var iconRes = await fetch('/static/icons/icon-192.png');
      if (iconRes.ok) await cache.put('/static/icons/icon-192.png', iconRes);
    } catch (e) { /* installing while already offline: best-effort only */ }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) {
      // Only own and drop FiApp caches, and only those from other deploys.
      return (k.indexOf('fiapp-') === 0 && k !== CACHE) ? caches.delete(k) : null;
    }));
    await self.clients.claim();
  })());
});

function isStatic(url) {
  return url.pathname.indexOf('/static/') === 0 || url.pathname === '/styles.css';
}

function isBypass(url) {
  return url.pathname.indexOf('/api/') === 0 ||
         url.pathname.indexOf('/auth/') === 0 ||
         url.pathname === '/sw.js' ||
         url.pathname === '/manifest.webmanifest' ||
         url.pathname === '/ping';
}

// Only cache responses we actually own and that succeeded.
function cacheable(res) {
  return res && res.ok && res.type === 'basic';
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;  // third-party: leave to the network
  if (isBypass(url)) return;                          // per-user / control endpoints

  // Page navigations: network-first so a fresh deploy always wins when online.
  if (req.mode === 'navigate') {
    event.respondWith((async function () {
      try {
        var fresh = await fetch(req);
        if (cacheable(fresh)) {
          var c = await caches.open(CACHE);
          c.put(req, fresh.clone());
        }
        return fresh;
      } catch (e) {
        var cached = await caches.match(req);
        return cached || (await caches.match(OFFLINE_URL));
      }
    })());
    return;
  }

  // Static assets: stale-while-revalidate (instant from cache, refresh in background).
  if (isStatic(url)) {
    event.respondWith((async function () {
      var c = await caches.open(CACHE);
      var cached = await c.match(req);
      var network = fetch(req).then(function (res) {
        if (cacheable(res)) c.put(req, res.clone());
        return res;
      }).catch(function () { return null; });
      return cached || (await network) || new Response('', { status: 504 });
    })());
    return;
  }

  // Everything else: default network handling.
});

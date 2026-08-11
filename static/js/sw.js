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

// Top-level pages (mirrors base.html's NAV_ITEMS) proactively cached rather than
// left to "whatever you happened to click into" - see precacheNavPages().
var NAV_PAGES = ['/', '/income', '/expenses', '/subscriptions', '/analytics', '/currency', '/tax', '/interest'];

// Never written to the cache, on any path. Cache-Control: no-store does NOT bind the Cache
// Storage API, so /account - which renders the email address, Google linkage and revision
// history - would otherwise sit on disk until an explicit logout purge, and survive the app
// simply being closed. It is the one page whose contents are worth more than its offline
// availability. Checked in BOTH precacheNavPages and the navigation handler, since a plain
// visit caches a page too.
var NEVER_CACHE = ['/account'];
function isSensitive(pathname) { return NEVER_CACHE.indexOf(pathname) !== -1; }

// Pulls same-origin static asset URLs out of page HTML (src=/href= attributes) or
// CSS (url(...) values). Only /static/* and /styles.css are eligible; everything
// else (pages, APIs, third-party origins) is ignored.
function _extractStaticUrls(text) {
  var out = [];
  var re = /(?:src|href)="(\/static\/[^"]+|\/styles\.css[^"]*)"|url\((['"]?)(\/static\/[^'")]+)\2\)/g;
  var m;
  while ((m = re.exec(text))) out.push(m[1] || m[3]);
  return out;
}

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
    // Covers a silent background update: claim() can take over already-open tabs
    // without a reload ever firing, so this is the only guaranteed refresh point
    // for that case. The 'message' handler below covers reload/reconnect refreshes
    // on an already-active worker, where 'activate' does not fire again.
    await precacheNavPages();
  })());
});

// Fetches each top-level page fresh (same-origin -> browser sends the current
// session cookie, so this reflects whoever is actually logged in right now),
// caches the successful ones, then caches every static asset those pages
// reference (scripts, styles, images) plus anything the cached CSS pulls in
// (fonts). Without the asset pass, a page never visited online would serve its
// cached HTML offline but 504 on its own scripts - a dead page.
// Best-effort throughout: a fetch that fails leaves any prior cache entry alone.
async function precacheNavPages() {
  var cache = await caches.open(CACHE);
  var assetUrls = {};

  await Promise.all(NAV_PAGES.map(async function (path) {
    if (isSensitive(path)) return;
    try {
      var res = await fetch(path, { credentials: 'same-origin' });
      if (cacheable(res)) {
        var body = await res.clone().text();
        _extractStaticUrls(body).forEach(function (u) { assetUrls[u] = true; });
        await cache.put(path, res);
      }
    } catch (e) { /* offline or transient error: leave the existing cache entry alone */ }
  }));

  async function cacheAsset(u) {
    try {
      if (await cache.match(u)) return; // already cached; SWR keeps it fresh
      var res = await fetch(u, { credentials: 'same-origin' });
      if (cacheable(res)) await cache.put(u, res);
    } catch (e) { /* best-effort */ }
  }

  await Promise.all(Object.keys(assetUrls).map(cacheAsset));

  // Second pass: fonts and images referenced only from inside CSS files.
  var cssUrls = Object.keys(assetUrls).filter(function (u) {
    return /\.css(\?|$)/.test(u) || u.indexOf('/styles.css') === 0;
  });
  var cssAssets = {};
  await Promise.all(cssUrls.map(async function (u) {
    try {
      var res = await cache.match(u);
      if (!res) return;
      _extractStaticUrls(await res.clone().text()).forEach(function (a) { cssAssets[a] = true; });
    } catch (e) { /* best-effort */ }
  }));
  await Promise.all(Object.keys(cssAssets).map(cacheAsset));
}

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'refresh-precache') {
    event.waitUntil(precacheNavPages());
  }
  // Logout / account-delete / a 401 from /auth/me: drop every FiApp cache so a prior
  // user's cached page shells (which embed the CSRF token and username) can't be served
  // offline to the next user. Acks over the MessagePort when the caller supplies one, so
  // logout can await the purge instead of racing the page unload.
  if (event.data && event.data.type === 'clear-cache') {
    var ack = event.ports && event.ports[0];
    event.waitUntil(caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k.indexOf('fiapp-') === 0 ? caches.delete(k) : null;
      }));
    }).then(function () {
      if (ack) { try { ack.postMessage({ ok: true }); } catch (e) { /* caller went away */ } }
    }));
  }
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
  // !res.redirected matters now that the tracker pages redirect to /login when signed out.
  // A SW fetch() follows redirects, so a logged-out precache of /expenses ends up holding a
  // response that is ok and basic - but whose body is the LOGIN page. Caching that files
  // login HTML under the tracker's URL, and a later offline visit serves it to a signed-in
  // user. (Chrome also rejects cache.put for a redirected response outright, which would
  // instead leave no offline page at all.) Either way the entry is wrong: skip it.
  return res && res.ok && res.type === 'basic' && !res.redirected;
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
        if (cacheable(fresh) && !isSensitive(url.pathname)) {
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

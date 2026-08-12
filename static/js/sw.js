'use strict';

var VERSION = self.__SW_VERSION || 'dev';
var CACHE = 'fiapp-' + VERSION;
var OFFLINE_URL = '/__offline';

var NAV_PAGES = ['/', '/income', '/expenses', '/subscriptions', '/analytics', '/currency', '/tax', '/interest'];

var NEVER_CACHE = ['/account'];
function isSensitive(pathname) { return NEVER_CACHE.indexOf(pathname) !== -1; }

function _extractStaticUrls(text) {
  var out = [];
  var re = /(?:src|href)="(\/static\/[^"]+|\/styles\.css[^"]*)"|url\((['"]?)(\/static\/[^'")]+)\2\)/g;
  var m;
  while ((m = re.exec(text))) out.push(m[1] || m[3]);
  return out;
}

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

    try {
      var iconRes = await fetch('/static/icons/icon-192.png');
      if (iconRes.ok) await cache.put('/static/icons/icon-192.png', iconRes);
    } catch (e) {  }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) {

      return (k.indexOf('fiapp-') === 0 && k !== CACHE) ? caches.delete(k) : null;
    }));
    await self.clients.claim();

    await precacheNavPages();
  })());
});

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
    } catch (e) {  }
  }));

  async function cacheAsset(u) {
    try {
      if (await cache.match(u)) return;
      var res = await fetch(u, { credentials: 'same-origin' });
      if (cacheable(res)) await cache.put(u, res);
    } catch (e) {  }
  }

  await Promise.all(Object.keys(assetUrls).map(cacheAsset));

  var cssUrls = Object.keys(assetUrls).filter(function (u) {
    return /\.css(\?|$)/.test(u) || u.indexOf('/styles.css') === 0;
  });
  var cssAssets = {};
  await Promise.all(cssUrls.map(async function (u) {
    try {
      var res = await cache.match(u);
      if (!res) return;
      _extractStaticUrls(await res.clone().text()).forEach(function (a) { cssAssets[a] = true; });
    } catch (e) {  }
  }));
  await Promise.all(Object.keys(cssAssets).map(cacheAsset));
}

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'refresh-precache') {
    event.waitUntil(precacheNavPages());
  }

  if (event.data && event.data.type === 'clear-cache') {
    var ack = event.ports && event.ports[0];
    event.waitUntil(caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k.indexOf('fiapp-') === 0 ? caches.delete(k) : null;
      }));
    }).then(function () {
      if (ack) { try { ack.postMessage({ ok: true }); } catch (e) {  } }
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

function cacheable(res) {

  return res && res.ok && res.type === 'basic' && !res.redirected;
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isBypass(url)) return;

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

});

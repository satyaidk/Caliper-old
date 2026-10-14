/* global self, caches, location */
/**
 * Caliper's service worker — a template. `vite build` fills in the version and
 * the exact list of files that build produced (see `serviceWorker()` in
 * vite.config.ts) and writes the result to dist/sw.js.
 *
 * Three rules, one per kind of request:
 *
 *   Pages        network first, cache as the fallback. A deploy must reach
 *                people on their next visit; the cached shell is only for when
 *                there is no network at all. This is the same lesson as the
 *                Cache-Control rule in vercel.json: never let a stale shell
 *                stand in front of a new build.
 *   /assets/     cache first. Vite hashes these names, so a name never changes
 *                meaning and a cached copy is always right.
 *   Kernels and  stale while revalidate, kept in a cache that survives deploys.
 *   fonts        The CAD and BIM kernels are 5–12 MB each; fetched once, they
 *                make those formats work offline from then on.
 *
 * Model files fetched with ?model= are never cached: they are the person's
 * data, not the app's.
 */

const VERSION = '__CALIPER_VERSION__';
const PRECACHE = __CALIPER_PRECACHE__;

const SHELL = `caliper-shell-${VERSION}`;
const RUNTIME = 'caliper-runtime-v1';
const RUNTIME_HOSTS = ['cdn.jsdelivr.net', 'www.gstatic.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
const NETWORK_TIMEOUT = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key.startsWith('caliper-shell-') && key !== SHELL).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

// The page asks before switching, so code is never swapped mid-measurement.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request, url.pathname.startsWith('/app') ? '/app/' : '/'));
    } else if (url.pathname.startsWith('/assets/')) {
      event.respondWith(cacheFirst(request));
    } else if (url.pathname !== '/sw.js') {
      event.respondWith(staleWhileRevalidate(request, SHELL));
    }
    return;
  }

  if (RUNTIME_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
  }
});

function keep(response) {
  // Opaque responses come from the font stylesheet, loaded without CORS.
  return response && (response.ok || response.type === 'opaque');
}

async function networkFirst(request, shellPath) {
  const cache = await caches.open(SHELL);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), NETWORK_TIMEOUT)),
    ]);
    if (keep(response)) await cache.put(shellPath, response.clone());
    return response;
  } catch {
    return (await cache.match(shellPath)) || (await cache.match(request)) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (keep(response)) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (keep(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit || Response.error());
  return hit || refresh;
}

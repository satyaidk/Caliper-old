/**
 * Registers the service worker that makes Caliper work offline and lets it be
 * installed as an app. Shared by the website and the app, which sit under the
 * same scope, so either one primes the cache for the other.
 *
 * The worker is generated at build time (see `serviceWorker()` in
 * vite.config.ts) with the exact list of files that build produced, so a new
 * deploy is a new worker. When one is waiting, `onUpdate` is called with a
 * function that switches to it and reloads — the page decides when to offer
 * that, rather than swapping code out from under someone mid-measurement.
 */
export function registerServiceWorker(onUpdate?: (apply: () => void) => void) {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;

  const offer = (worker: ServiceWorker) =>
    onUpdate?.(() => {
      navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
      worker.postMessage({ type: 'SKIP_WAITING' });
    });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) offer(registration.waiting);
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            // "installed" with a controller already in place means an update,
            // not the first install.
            if (worker.state === 'installed' && navigator.serviceWorker.controller) offer(worker);
          });
        });
      })
      .catch(() => {
        /* No worker means no offline copy; the app itself still runs. */
      });
  });
}

# 0003: Generate the service worker per build instead of using Workbox

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Installing and working offline need a service worker. The usual route is
`vite-plugin-pwa`, which wraps Workbox. Caliper's history argues for caution:
release 1.0.1 shipped a fix that browsers did not see, because the app shell was
cached with its old Content-Security-Policy header. A service worker is a second,
stronger cache in front of the HTTP one, and a misconfigured one makes a broken
deploy permanent on every device that saw it.

The caching rules Caliper needs are few: pages network-first, hashed assets
cache-first, the kernel and font CDNs stale-while-revalidate, and nothing else.

## Decision

Write the worker by hand, 112 lines in `src/pwa/sw.js` of which 76 are code, and generate
`dist/sw.js` from it in a small Vite plugin (`serviceWorker()` in
`vite.config.ts`). The plugin injects a version stamp and the exact list of
files the build produced, so every deploy is a new worker with a correct
precache list. Nothing in the list is written by hand.

Pages are network-first with a four-second timeout, so a new deploy reaches
people on their next visit. An update installs in the background and waits; the
app shows a prompt and switches only when the person accepts.

## Consequences

- No new dependency, and every caching rule is readable in one file.
- The precache list cannot drift from the build.
- Features Workbox provides for free — background sync, expiration policies,
  navigation preload — are not available. None are needed today; if they become
  needed, this decision should be revisited.
- The worker only exists in production builds, so `npm run dev` never serves
  stale code.

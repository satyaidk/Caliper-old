# 0002: Ship a website at `/` and the app at `/app/` from one build

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

In 1.0 the root URL was the app. A first-time visitor landed on an empty viewer
with a paragraph of explanation, and there was nowhere to say what the tool does,
how to install it, or which formats it opens without crowding the app itself.
The 2.0 request was for both a website and a web app.

Options considered:

1. **Two repositories**, a marketing site and the app. Two deploys, two places
   to update the format list, and a site that can drift from the product.
2. **A static-site generator** for the website. A second toolchain for one page.
3. **Two entry points in one Vite build.** `index.html` and `app/index.html`,
   sharing tokens, modules and chunks.

## Decision

Option 3. Vite's multi-page build emits both pages; Vercel rewrites `/app` and
`/app/*` to the app's HTML. The website is plain TypeScript with no React, and
loads the app's own Engine after first paint to run its hero.

Every product fact on the website is computed from the app's modules at
runtime: the format count and table from `lib/formats.ts`, the hero part's size
from `Engine.dimensions()`, its measurements from `Engine.addMeasurement()`.

Links from 1.0 (`/?model=…`) are forwarded to `/app/` by a script in the
website's head, before anything renders.

## Consequences

- One deploy, one version, one source of truth for what the app supports.
- The website's first load is 13.4 kB gzip; the 202.6 kB engine and three.js
  arrive after the words are on screen and are then cached for the app.
- The service worker's scope is `/`, so visiting either page primes the cache
  for the other.
- `vercel.json` no longer has a catch-all rewrite. An unknown path outside
  `/app/` is a real 404.

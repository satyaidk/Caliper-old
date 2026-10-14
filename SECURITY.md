# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| 2.x | Yes |
| 1.x | No; upgrade to 2.x |

## Reporting a vulnerability

Please do not open a public issue. Report it privately through GitHub:
**Security → Report a vulnerability** on
[the repository](https://github.com/satyaidk/Caliper/security/advisories/new).

Include what an attacker could do, the steps or file that reproduce it, and the
browser and version you saw it in. You can expect an acknowledgement within
seven days and a fix or a plan within thirty.

## In scope

- A crafted model file that runs script, reads data from other origins, or
  escapes the page's Content-Security-Policy
- A way to make the app send a person's file anywhere
- Weaknesses in the security headers in `vercel.json` or in the service worker
- A `?model=` URL that can be abused beyond fetching a file

Out of scope: a file that is slow or crashes the tab without any other effect
(report it as a bug), and the third-party geometry kernels themselves (report
those upstream to occt-import-js, web-ifc or rhino3dm).

## How Caliper limits risk

- **Files stay on the device.** They are read with the File API and parsed in
  the tab. There is no upload endpoint.
- **A strict Content-Security-Policy** in `vercel.json` allows scripts only from
  this origin, `cdn.jsdelivr.net` and `www.gstatic.com`, which host the pinned
  WebAssembly kernels. `'unsafe-eval'` is present because the Emscripten
  runtimes those kernels are built with require it; see CHANGELOG 1.0.1.
- **Framing is denied** (`frame-ancestors 'none'`, `X-Frame-Options: DENY`),
  forms post nowhere (`form-action 'none'`) and object embeds are blocked.
- **`?model=` only follows `http` and `https`,** and the fetched file goes
  through the same parsers as a dropped file.
- **The service worker never caches model files.** It caches the app's own build
  output and the kernel and font CDNs, nothing else.

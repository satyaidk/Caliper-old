# End-to-end tests

These are not run by `npm test`, because they need a browser and a network. Run
them by hand before a release, and any time you touch a loader or `vercel.json`.

They exist because of a real bug: the production Content-Security-Policy blocked
the WebAssembly kernels, so every CAD format failed **only in production**. Unit
tests could not have caught it and neither could `npm run dev`, which serves no
headers at all. The fix was to test against the real config.

## Setup

```bash
npm i -D playwright
npx playwright install chromium

node e2e/fetch-fixtures.mjs        # downloads one real file per format
node e2e/make-fixtures-extra.mjs   # generates the two with no public sample
```

Fixtures land in `e2e/fixtures/` and are gitignored — they are ~20 MB of
third-party models.

## Running

```bash
npm run build

# serve dist/ with the exact headers from vercel.json
node e2e/serve-production.mjs . 5188

# open every fixture and assert it renders
node e2e/formats.mjs http://localhost:5188/app/
```

Expected output is `19/19 formats rendered`. A format that fails prints the
error toast or the CSP violation that caused it.

## Why the server matters

`serve-production.mjs` reads `vercel.json` directly and replays its headers and
its SPA rewrite. It cannot drift from the deployed configuration, because it has
no configuration of its own. That is the whole point: `npm run preview` serves
the same *files* as production but none of the *headers*, and headers are where
this class of bug lives.

## Coverage

| Pipeline | Extensions exercised |
| --- | --- |
| Mesh | `stl` `obj`+`mtl` `ply` `off` `gltf` `glb` `fbx` `dae` `3ds` `3mf` `amf` `wrl` |
| CAD B-rep | `step` `stp` `igs` `brep` `fcstd` `3dm` |
| BIM | `bim` |

`ifc` has no small public fixture and is not covered. It uses the same
`loadScript` + WebAssembly path as the others, so a CSP or CDN regression would
show up on those first — but a real IFC file is still worth adding when you have
one.

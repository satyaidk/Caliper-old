# Learning path

A route through the Caliper codebase for someone new to React, three.js or
both. Each stop names the files to read, what to look for, and an exercise that
proves you understood it. Plan on an evening per stop.

Read [design.md](design.md) first for the map. This page is the walk.

## 0. Run it and break it

```bash
npm install
npm run dev
```

Open `http://localhost:5173/app/?sample`. Press <kbd>?</kbd> for the keys and try
every tool on the sample gear. Then run `npm test` and `npm run typecheck`.

**Exercise.** Change `GEAR.teeth` in `src/lib/sample.ts` to 24 and reload. Run
`npm test`: one test now fails. Read it, and work out why it was right to fail.
Put the value back.

## 1. Pure functions first: `src/lib/`

Start with code that has no framework in it.

- `format.ts`: how a number becomes `49.88 mm`. Note the nudge in `dim()` that
  stops 25.4 mm printing as 0.9999 inches.
- `formats.ts`: the registry every format decision reads from.
- `printers.ts`: bed sizes, the fit check, and the layer maths.

Read each next to its test in `test/`. The tests are the specification.

**Exercise.** Add a printer bed of your choice to `BEDS` and a test that a part
of a known size fits or does not fit it.

## 2. Geometry without a scene: `src/viewer/measure.ts`, `printability.ts`, `orient.ts`

These take triangles and vectors and return numbers. `triangles.ts` explains the
`TriangleSource` idea that lets the same code run in a test and in the app.

- In `printability.ts`, follow `analyse()`: why does summing signed tetrahedra
  give a volume, and why is it only right for a closed surface?
- In `orient.ts`, follow `restingFaces()`: why is the largest face not enough,
  and what does "on the outermost plane" add?

**Exercise.** Write a test in `test/printability.test.ts` for a box with one face
missing: its open-edge count should be 4. (One already exists; delete it and
write your own before looking.)

## 3. The store: `src/store/useViewer.ts`

Zustand keeps all state in one object with actions beside it. Find:

- `open()`: the whole life of a file, from drop to toast.
- `syncView()` and `syncPlate()`: how several settings become one Engine call.
- `persist()`: what is remembered between visits, and why the file is not.

**Exercise.** Add a setting to `Display`, persist it, and show it in the status
bar. Notice you never touched the Engine.

## 4. React components: `src/components/`

Read `App.tsx`, then `TopBar.tsx`, `Sidebar.tsx` and `Toolbars.tsx`. Each reads
from the store with a selector and calls actions; none imports three.js.

- `ui.tsx` holds the five controls everything else is built from.
- `ObjectList.tsx` shows windowing: only the rows on screen exist.
- `Viewport.tsx` shows the one place React touches the Engine: creating it, and
  writing tag positions to the DOM directly rather than through state.

**Exercise.** In `Viewport.tsx`, find why measurement tags are positioned with
`node.style.transform` rather than React state. Try the state version, open
React DevTools' highlighter, and orbit the model.

## 5. three.js: `src/viewer/Engine.ts` and friends

Read in this order:

1. `CameraRig.ts`: two cameras and orbit controls; how framing works.
2. `Stage.ts`: everything that is not the model.
3. `Engine.ts`, top to bottom. Keep the scene graph diagram from design.md open.
   Follow `setModel()`, then a click through `pick()`, `placePoint()` and
   `buildMeasurement()`.
4. `materials.ts`: the overhang shader, a few lines of GLSL spliced into a
   standard material.
5. `Section.ts`: the stencil trick. [ADR 0004](adr/0004-stencil-section-caps.md)
   explains why.

**Exercise.** Change the overhang colour in `Stage.ts`'s `SKIN` and watch both
the model and the legend. Then find why the legend did not change, and fix it.

## 6. Loading files: `src/viewer/loaders/`

`index.ts` picks the loader. `mesh.ts` handles the formats three.js reads
directly; `occt.ts`, `ifc.ts` and `rhino.ts` load WebAssembly kernels from a CDN
on first use. `normals.ts` is why STL files look right
([ADR 0005](adr/0005-crease-normals-for-stl.md)).

**Exercise.** Export an STL from any CAD tool, open it, and compare shading with
`creasedNormals` swapped for `geometry.computeVertexNormals()`.

## 7. Shipping: `vite.config.ts`, `vercel.json`, `src/pwa/`

- Two pages from one build ([ADR 0002](adr/0002-website-and-app-split.md)).
- The service worker and the plugin that writes it
  ([ADR 0003](adr/0003-generated-service-worker.md)).
- The security headers, and why `'unsafe-eval'` is there (CHANGELOG 1.0.1).

**Exercise.** Run `npm run build && npm run preview`, open the app, then turn
the network off in DevTools and reload. Find the cached files under
Application → Cache Storage.

## 8. Make a real change

Pick an item from the README's roadmap, open an issue describing your approach,
and follow [CONTRIBUTING.md](../CONTRIBUTING.md).

## Glossary

| Term | Meaning here |
| --- | --- |
| B-rep | Boundary representation: exact surfaces, as CAD stores them, turned into triangles on open |
| Convex hull | The tightest convex shape around a part; a part can only rest on a face that touches it |
| Overhang | A downward face steeper than the limit from vertical; it would print in mid-air |
| Stencil buffer | A per-pixel counter the GPU can test against; used here to find "inside the solid" |
| Tone mapping | The curve from lighting values to screen colours |
| Windowing | Rendering only the list rows that are visible |

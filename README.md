<div align="center">

<img src="public/icon.svg" alt="" width="88" height="88" />

# Caliper

**A 3D model viewer that works like your slicer.** Open 22 mesh, CAD and BIM file types in the browser, then measure, orient, section and preview them with Bambu Studio's tools and keys. Nothing is uploaded.

[![CI](https://github.com/satyaidk/Caliper/actions/workflows/ci.yml/badge.svg)](https://github.com/satyaidk/Caliper/actions/workflows/ci.yml)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?logo=nodedotjs&logoColor=white)](.nvmrc)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-3178c6?logo=typescript&logoColor=white)](tsconfig.json)
[![Unit tests](https://img.shields.io/badge/unit%20tests-98%20passing-00ae42)](test/)
[![Coverage](https://img.shields.io/badge/line%20coverage-67.9%25-00ae42)](#testing--quality)
[![License: MIT](https://img.shields.io/badge/license-MIT-262e30)](LICENSE)

[Getting started](#getting-started) · [Design doc](docs/design.md) · [Learning path](docs/learning-path.md) · [ADRs](docs/adr/) · [Changelog](CHANGELOG.md)

<img src="public/screens/prepare.png" alt="Caliper's Prepare tab: a gear measured with a diameter and a distance, the Bambu-style sidebar on the left and the canvas toolbar above" width="900" />

</div>

## Overview

Caliper opens a 3D model in a browser tab and answers the questions asked before printing or machining it: how big it is, how big a feature on it is, which way up it should sit, what it looks like inside, and whether it will print without support. The file is read on the device; there is no server, no account and no upload.

Version 2 rebuilds the interface after Bambu Studio, the slicer most people opening a model already have in another window. The palette is taken from Bambu Studio's source, the workspace is split into the same Home, Prepare and Preview tabs, the sidebar runs Printer, Filament and Objects in the same order, and the keys are the same keys. Caliper ships as two pages: a website at `/` whose hero is the real viewer running on a generated part, and the app at `/app/`, which installs as an offline-capable desktop or phone app.

Caliper is an independent project and is not affiliated with or endorsed by Bambu Lab.

## Key features

| Area | What it does |
| --- | --- |
| **Formats** | 22 extensions through three pipelines: mesh (`stl` `obj` `ply` `off` `gltf` `glb` `fbx` `dae` `3ds` `3mf` `amf` `wrl`), CAD B-rep tessellated by WebAssembly kernels (`step` `stp` `iges` `igs` `brep` `brp` `fcstd` `3dm`) and BIM (`ifc` `bim`). |
| **Measure** | Distance with an X/Y/Z split, diameter from three points on an arc, and angle from arm, corner, arm. Clicks snap to the nearest corner, edge midpoint or face centre within 14 screen pixels. |
| **Orient** | Lay on face (click a face and it goes down onto the plate) and auto orient (stand the part on its largest flat face on the convex hull). The size readout follows the new orientation. |
| **Look inside** | Section view along X, Y or Z with a hatched, stencil-filled cap so a cut reads as solid; assembly view that pulls parts apart along lines from the centre, ratio 1 to 3. |
| **Preview** | A layer slider that cuts the part at any layer for the chosen layer height, with overhangs past a configurable limit painted red. |
| **Printability** | Closed-surface check (open-edge count), volume, solid-PLA weight, surface area and overhang area, each computed from the triangles. |
| **Printer plates** | Bambu Lab X1/P1/A1 (256 mm), A1 mini (180 mm), Prusa MK4 and Creality Ender-3 beds drawn at true size, with a fit check that allows a quarter turn. |
| **View** | Perspective and orthographic cameras, shaded, wireframe and edges modes, part labels, an orientation gizmo, Bambu's 0–7 view keys, and PNG export. |
| **Objects** | Per-part visibility, isolate and search, windowed so a 10,000-part IFC model scrolls smoothly. |
| **App** | Installable PWA with window-controls overlay, OS file handlers, an app shortcut, and offline use from a build-generated service worker. |
| **Themes** | Bambu Studio's dark and light palettes, with every text pair adjusted to clear WCAG AA. |

## Demo

| Prepare | Preview |
| --- | --- |
| ![Prepare tab with measurements](public/screens/prepare.png) | ![Preview tab with a part cut at a layer and its overhang painted red](public/screens/preview.png) |

| Section view, light theme | Phone |
| --- | --- |
| ![Section view through a gear, with the cut face hatched](docs/images/light-section.png) | <img src="public/screens/phone.png" alt="Caliper on a phone" width="260" /> |

Try it without a file: `/app/?sample` opens a generated gear, and `/app/?sample&tab=preview` opens it in the Preview tab.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    Site["index.html<br/>website (TypeScript)"] -->|dynamic import| Engine
    App["app/index.html<br/>React app"] --> Store["Zustand store<br/>(single source of truth)"]
    Store -->|commands| Engine["Engine<br/>three.js, no React"]
    Engine -->|hooks: frame, selection,<br/>measurements, parts| Store
    Store --> UI["Components<br/>no three.js"]
    Engine --> Loaders["Loaders<br/>mesh · OCCT · web-ifc · rhino3dm"]
    Loaders -.->|first use only| CDN["jsDelivr / gstatic<br/>WASM kernels"]
    Engine --> Analysis["Pure modules<br/>measure · orient · printability · normals"]
  end
  SW["Service worker<br/>(generated per build)"] -.->|precache + runtime cache| Site
  SW -.-> App
```

The split that holds it together: `viewer/` never imports React and `components/` never imports three.js. They meet in the store, which turns every click into an Engine command and every Engine report into state. Analysis code is written against a plain stream of triangles rather than three.js scenes, so the same functions run in the browser and in Node's test runner. The full design, including the scene graph, the section stencil technique and the caching rules, is in [docs/design.md](docs/design.md).

## Getting started

### Prerequisites

- Node.js 22 or newer (`.nvmrc` pins 24)
- A browser with WebGL 2: current Chrome, Edge, Firefox or Safari

### Install

```bash
git clone https://github.com/satyaidk/Caliper.git
cd Caliper
npm install
```

### Configure

There is nothing to configure for local use. Two places to know about before deploying:

| File | What to set |
| --- | --- |
| `index.html`, `app/index.html`, `public/sitemap.xml`, `public/robots.txt` | The production domain in the `canonical` links, the `og:image` URLs and the sitemap. They hold the placeholder `caliper.app` until a domain is chosen. |
| `src/lib/cdn.ts` | Where the CAD and BIM WebAssembly kernels are fetched from. Point these at `public/vendor/` to run with no CDN at all. |

### Run

```bash
npm run dev        # http://localhost:5173 (website) and /app/ (the app)
npm run build      # typecheck, then build both pages and the service worker to dist/
npm run preview    # serve the production build
```

The service worker is only generated and registered in production builds, so `npm run dev` always serves fresh code.

## Usage

Open the app, then drop a file or folder anywhere in the window, use **File → Open a model**, or pass one by URL:

```
https://your-domain/app/?model=https://example.com/bracket.step
https://your-domain/app/?model=/models/bracket.step&name=Bracket.step&tab=preview
```

Only `http` and `https` URLs are followed, and the remote host must send permissive CORS headers. Links to the old root URL (`/?model=…`) are forwarded to `/app/`.

**Units.** STL and most mesh formats carry no unit, so their numbers are read as millimetres, as a slicer would. glTF is metres by specification and BIM geometry arrives in metres, so those default to metres. The **Size** section's *The file's numbers are in* menu changes it for the file in front of you, and a part under 1 mm across prompts the switch.

**Installing.** In Chrome or Edge, use the install button in the top bar or the address bar. Installed, Caliper opens model files from the file manager, keeps working offline, and uses its top bar as the window's title bar. On iPhone and iPad, use Safari's Share menu and *Add to Home Screen*.

### Keyboard

The keys follow Bambu Studio where it has an equivalent. Press <kbd>?</kbd> in the app for the same list.

| Camera | | Tools | | Display | |
| --- | --- | --- | --- | --- | --- |
| <kbd>0</kbd> | Default view | <kbd>R</kbd> | Auto orient | <kbd>Q</kbd> | Shaded |
| <kbd>1</kbd> <kbd>2</kbd> | Top, bottom | <kbd>F</kbd> | Lay on face | <kbd>W</kbd> | Wireframe |
| <kbd>3</kbd> <kbd>4</kbd> | Front, rear | <kbd>U</kbd> | Distance | <kbd>E</kbd> | Shaded with edges |
| <kbd>5</kbd> <kbd>6</kbd> | Left, right | <kbd>D</kbd> | Diameter | <kbd>G</kbd> | Plate |
| <kbd>7</kbd> | Isometric | <kbd>A</kbd> | Angle | <kbd>S</kbd> | Shadows |
| <kbd>Z</kbd> | Fit to view | <kbd>X</kbd> | Section view | <kbd>L</kbd> | Part labels |
| <kbd>K</kbd> | Perspective / orthographic | <kbd>Y</kbd> | Assembly view | <kbd>O</kbd> | Overhangs |
| | | <kbd>Backspace</kbd> | Undo last point | <kbd>Ctrl</kbd> <kbd>O</kbd> / <kbd>S</kbd> | Open, save PNG |
| | | <kbd>Esc</kbd> | Put the tool away | <kbd>Ctrl</kbd> <kbd>B</kbd> / <kbd>J</kbd> | Sidebar, theme |

## Project structure

```
index.html              the website
app/index.html          the app
src/
  site/                 website script and styles (no React)
  App.tsx, main.tsx     app shell and entry
  components/           React, no three.js: TopBar, Sidebar, Toolbars, Viewport, Home, ...
  store/useViewer.ts    Zustand store, the single source of truth
  viewer/               three.js, no React
    Engine.ts           renderer, model, picking, tools
    CameraRig.ts        perspective and orthographic cameras
    Stage.ts            build plate, grid, build volume, lights
    Section.ts          clipping plane and stencil-filled cap
    Explode.ts          assembly view
    materials.ts        filament, wireframe and overhang materials
    measure.ts          snapping, circle fit, angle            (pure)
    orient.ts           resting faces for lay on face           (pure)
    printability.ts     volume, area, open edges, overhang      (pure)
    normals.ts          crease-angle normals for STL            (pure)
    triangles.ts        triangle streams over meshes or arrays  (pure)
    loaders/            one module per pipeline
  lib/                  formats, units, printers, shortcuts, sample part, labels
  pwa/                  service worker template and registration
  styles/               tokens.css (palette and type), base.css, app.css
test/                   unit tests, Node's built-in runner
e2e/                    production-config format sweep, run by hand
docs/                   design doc, ADRs, learning path, technical manual
```

## Testing & quality

```bash
npm test             # 98 unit tests
npm run coverage     # the same, with Node's built-in coverage report
npm run typecheck    # tsc --noEmit, strict mode
npm run contrast     # every text colour against every surface, both themes, WCAG AA
```

Unit tests use Node's built-in runner and native TypeScript support, so there is no test framework to install. They pin every piece of maths the app reports as a number: snapping, the circle fit, angles, volume, surface area, open edges, overhang area, resting faces, crease normals, bed fit, layer counts, unit conversion, number formatting and the sample part's dimensions.

Measured on 2026-10-15 with `npm run coverage`: **67.89 %** line coverage across the modules the tests load, and **100 %** line coverage of `measure.ts`, `orient.ts`, `printability.ts`, `normals.ts`, `triangles.ts`, `format.ts` and `labels.ts`. The loaders score low on unit coverage by design; they are exercised by the end-to-end sweep instead.

The end-to-end sweep in [`e2e/`](e2e/) serves `dist/` with the exact headers from `vercel.json`, including the Content-Security-Policy, and opens one real file per format. On 2026-10-15 it reported **19/19 formats rendered**, including every CAD and BIM kernel. See [`e2e/README.md`](e2e/README.md).

`npm run contrast` checks all 60 text-on-surface pairs in `styles/tokens.css` against WCAG AA; Bambu Studio's own muted greys and greens fall short for small text, so those tokens keep Bambu's hue at a lightness that passes.

CI runs typecheck, unit tests, the contrast check and a production build on every push and pull request to `main` and `dev` ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Evaluation

**Accuracy against shapes with known answers.** Read from the app, compared with values worked out by hand:

| Check | Shape | Expected | Caliper |
| --- | --- | --- | --- |
| Diameter, three clicks on a bore | Sample gear, 8 mm bore (48-sided) | 8.00 mm | 8.00 mm |
| Diameter fitted through three tooth tips | Sample gear, module 2.5, 18 teeth | 50.00 mm | 50.00 mm |
| Volume | Flared stand, 72-sided lathe | 29.24 cm³ | 29.24 cm³ |
| Overhang area past 45° | Flared stand's 49° cone | 19.70 cm² (true cone) | 19.68 cm² (72-sided) |
| Layer count | 40 mm part at 0.20 mm | 200 | 200 |

**Page weight.** From `npm run build` on 2026-10-15, gzip sizes:

| Load | Files | gzip |
| --- | --- | --- |
| Website, before the live hero | HTML, CSS, script | 13.4 kB |
| Website hero, after first paint | Engine, three.js and sample-part chunks | 202.6 kB |
| App, first load | HTML, CSS, React, three.js, Engine, app | 430.3 kB |
| CAD or BIM kernel | WebAssembly, fetched on first use of that format | 5–12 MB each, cached offline after |

## Design decisions

Each decision with lasting consequences has an ADR in [`docs/adr/`](docs/adr/):

| ADR | Decision |
| --- | --- |
| [0001](docs/adr/0001-bambu-studio-interface.md) | Follow Bambu Studio's interface, palette and keys |
| [0002](docs/adr/0002-website-and-app-split.md) | Ship a website at `/` and the app at `/app/` from one build |
| [0003](docs/adr/0003-generated-service-worker.md) | Generate the service worker per build instead of using Workbox |
| [0004](docs/adr/0004-stencil-section-caps.md) | Fill section cuts with a stencil-buffer cap |
| [0005](docs/adr/0005-crease-normals-for-stl.md) | Shade STL files with crease-angle normals |

## Documentation

| Document | For |
| --- | --- |
| [docs/design.md](docs/design.md) | How the app is built and why: scene graph, data flow, rendering, caching, security |
| [docs/learning-path.md](docs/learning-path.md) | A beginner's route through the codebase, in reading order, with exercises |
| [docs/adr/](docs/adr/) | Architecture decision records |
| [docs/Caliper-Technical-Documentation.pdf](docs/Caliper-Technical-Documentation.pdf) | The 84-page manual written for 1.0, still accurate for the loaders, the measuring maths and the deployment chapters |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each release |

## Roadmap

- Open recent files again from the Home tab, using the File System Access API where the browser supports it
- Measure between features — plane to plane, edge to edge — rather than only between picked points
- Per-part filament colours for multi-material models, read from 3MF where the file carries them
- Export the reoriented part as STL or 3MF, ready for the slicer
- Shareable links that carry measurements and the camera
- A desktop build through Tauri for file associations on browsers without the File Handling API
- Regenerate the technical manual for 2.0

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the branch model, the checks a pull request must pass, and the code conventions. Everyone taking part agrees to the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Model files never leave the device, and the production Content-Security-Policy limits scripts to this origin and the two CDNs that host the geometry kernels. To report a vulnerability, follow [SECURITY.md](SECURITY.md); please do not open a public issue.

## License

[MIT](LICENSE).

## Acknowledgements

- [three.js](https://threejs.org/) for rendering and most of the mesh loaders
- [occt-import-js](https://github.com/kovacsv/occt-import-js), built on Open CASCADE Technology, for STEP, IGES, BREP and FCStd
- [web-ifc](https://github.com/ThatOpen/engine_web-ifc) for IFC and [rhino3dm](https://github.com/mcneel/rhino3dm) for 3DM
- [Bambu Studio](https://github.com/bambulab/BambuStudio), whose source is the reference for the palette, layout and keys; no Bambu Studio code or artwork is included
- [Onest](https://fonts.google.com/specimen/Onest), the typeface, under the SIL Open Font License
- [Contributor Covenant](https://www.contributor-covenant.org/), on which the Code of Conduct is based

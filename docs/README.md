# Documentation

| Document | What it is |
| --- | --- |
| [design.md](design.md) | How Caliper 2.0 is built and why: pages, layers, scene graph, rendering, analysis, caching, security |
| [learning-path.md](learning-path.md) | A beginner's route through the code, in reading order, with an exercise per stop |
| [adr/](adr/) | Architecture decision records |
| [images/](images/) | Screenshots used by the README |

## The technical manual

The manual below was written for 1.0. Its chapters on the loaders, the measuring
maths, the build, CI and the security headers still hold. The interface chapters
describe the 1.0 layout; for 2.0's, read design.md.

**[Caliper-Technical-Documentation.pdf](Caliper-Technical-Documentation.pdf)** —
84 pages covering the whole application, from `index.html` to the deployed site.

There is also [technical-documentation.html](technical-documentation.html), the
same content as a single self-contained file you can open in a browser. It has
no external dependencies — no fonts, no scripts, no images — so it works offline
and from a `file://` URL.

## What is in it

| Part | Chapters | Covers |
| --- | --- | --- |
| I — Orientation | 1–3 | What the app is, every dependency and why, getting it running |
| II — The codebase | 4–12 | Every file explained: boot sequence, store, components, hooks, the 3D engine, loaders, styles |
| III — The ideas | 13–20 | React patterns, Zustand from scratch, three.js from scratch, the measuring maths, routing, performance, TypeScript, accessibility |
| IV — Shipping | 21–26 | Vite, tsconfig, git, GitHub Actions line by line, Vercel, security headers and CSP |
| V — Learning | 27–30 | Ten exercises, mistakes avoided, glossary, further reading |

Plus an appendix with the keyboard reference and a "where to change what" table.

## Regenerating it

The source lives in `src/` as numbered HTML fragments, assembled and rendered by
`build.mjs`. Playwright is not a project dependency — the app does not need it
and this runs perhaps twice a year — so install it when you want to rebuild:

```bash
npm i -D playwright
npx playwright install chromium
node docs/build.mjs
```

That writes both `technical-documentation.html` and the PDF. Remove Playwright
again afterwards if you would rather keep the dependency list clean:

```bash
npm uninstall playwright
```

## Editing it

Edit the fragments in `src/`, not the assembled HTML — that file is generated
and will be overwritten.

| Fragment | Contents |
| --- | --- |
| `_head.html` | The `<head>`, and all of the print CSS |
| `01-front.html` | Cover, how to read it, contents, Part I |
| `02-files.html` | Part II |
| `03-concepts.html` | Part III |
| `04-ship.html` | Part IV |
| `05-learn.html` | Part V and the appendix |
| `_tail.html` | Closing tags |

Two conventions worth keeping:

- **Fonts are system-only.** A PDF render that waits on Google Fonts either
  hangs or silently falls back, and neither is acceptable for a document that
  has to build reproducibly.
- **Code samples are hand-highlighted** with `<span class="k">`, `s`, `c`, `n`
  and `t` for keyword, string, comment, number and type. There is no syntax
  highlighter to load, which is what keeps the HTML self-contained. Remember to
  escape `<`, `>` and `&` inside `<pre>` blocks.

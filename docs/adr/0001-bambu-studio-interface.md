# 0001: Follow Bambu Studio's interface, palette and keys

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

Caliper 1.0 had its own visual identity: graphite surfaces, an amber accent and
a tool rail on the left. It worked, but it was a new interface to learn, and the
people most likely to open a model in a browser to check it are the people about
to print it. Most of them already spend hours in Bambu Studio or a fork of it
(OrcaSlicer shares its layout). The request for 2.0 was to make the viewer look
and work like that slicer.

## Decision

Follow Bambu Studio closely, using its open-source code as the reference rather
than screenshots:

- **Palette** from `StateColor.cpp` (light and dark surfaces, `#00AE42` brand
  green and its dark-mode `#21A452`), `BBLTopbar.cpp` (the `#262E30` slate top
  bar, the same in both themes) and `GLCanvas3D.cpp` (the flat `#54545A` and
  `#E7E7E7` canvas).
- **Layout**: top bar with File menu and Home / Prepare / Preview tabs; sidebar
  of folding sections in Bambu's order, Printer first; a floating toolbar
  centred on the canvas.
- **Keys** from `KBShortcutsDialog.cpp` and `GLCanvas3D.cpp`: 0–7 for views, Z to
  fit, R to orient, F to lay on face, U to measure, Y for the assembly view.
- **Tools** that exist in Bambu's viewer and make sense without slicing: lay on
  face, auto orient, measure, section view, assembly view with its 1–3 explosion
  ratio, show overhang, show labels, orthographic camera, and a Preview tab whose
  layer slider cuts the model rather than showing G-code.

Where Bambu's values fail WCAG AA for small text, the token keeps the hue and
moves only the lightness, and `npm run contrast` enforces it. Bambu ships
HarmonyOS Sans, which is not on a font CDN; Onest is the closest available
neutral grotesque with tabular figures.

No Bambu Studio code, icons or artwork are copied. Its source is AGPL-3.0;
Caliper is MIT. Colours, layout conventions and key assignments are not
copyrightable expression, and every icon is drawn new.

## Consequences

- Bambu users recognise the tool and its keys on first use.
- Keys changed from 1.0: views moved from 1–6 and 0 to 0–7, fit from F to Z,
  distance from M to U. This is the main reason the release is 2.0.0.
- Green now means "active" and also marks the Y axis, as it does in Bambu Studio.
  They never share a context: green marks controls, Y marks a direction.
  Measurements moved from amber to Bambu's orange so they stay readable on a
  green part.
- The website and the README state that Caliper is independent of Bambu Lab, so
  the resemblance is not read as endorsement.

# 0005: Shade STL files with crease-angle normals

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

STL stores loose triangles with one normal each. Caliper 1.0 welded shared
corners and called `computeVertexNormals`, which averages every face around a
corner. On a scan that looks smooth. On a CAD part it averages across 90° edges,
so flat faces shade with dark diagonal smears — visible on the first bracket
tested for 2.0. Showing the file's face normals as they come fixes CAD parts but
makes scans look cut from facets.

three.js ships `toCreasedNormals`, which smooths only below a crease angle. It
welds corners on a fixed 0.01-unit grid, which merges whole features in a file
drawn in metres, and allocates a vector per triangle.

## Decision

Write `viewer/normals.ts`: weld corners on a grid scaled to a millionth of the
part's size, gather each corner's faces in typed arrays, and average only the
faces within 30° of the corner's own face, weighted by area. STL files under
800,000 triangles use it; larger ones keep the file's face normals, because
welding that many corners would stall the tab.

## Consequences

- CAD parts shade flat with sharp edges, and scans shade smooth, from one rule.
- The behaviour is unit-tested: a 90° edge stays sharp, a 10° fold is smoothed,
  and a part a thousandth the size gives the same result.
- STL geometry is no longer indexed, using three vertices per triangle. Most
  STLs arrive that way anyway; the 800,000-triangle cut-off bounds the memory.

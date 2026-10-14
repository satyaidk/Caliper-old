# 0004: Fill section cuts with a stencil-buffer cap

- **Status:** Accepted
- **Date:** 2026-10-15

## Context

A section view cuts the model with a plane. three.js clipping planes discard
fragments on one side, which leaves a hollow shell: you look through the cut at
the inside of the surface. That reads as a broken render, and it hides exactly
what a section is for — wall thickness, holes, internal features.

Options considered:

1. **Compute the cross-section polygons** on the CPU (intersect every triangle
   with the plane, chain the segments, triangulate) and draw them. Exact, but
   expensive on large meshes, fragile on meshes that are not closed, and it has
   to be redone on every slider movement.
2. **Render back faces in a flat colour** with `side: DoubleSide`. Cheap, but it
   needs every material modified, and the "cap" is really the far inside wall,
   so it shades wrong and shows through holes.
3. **Stencil-buffer caps**, the technique in three.js's clipping example: draw
   every mesh again with colour writes off, incrementing the stencil on back
   faces and decrementing on front faces; where the ray is inside the solid the
   count is non-zero, and a large plane on the cut draws only there.

## Decision

Option 3. `viewer/Section.ts` adds two stencil copies as children of each mesh,
so they follow explode and reorientation for free, and draws one cap plane with
a hatched texture. The cap is unlit, so it reads as a drawing convention rather
than another surface of the part. The renderer is created with `stencil: true`.

## Consequences

- Correct caps at drawing speed, independent of triangle count, and updated for
  free as the slider moves.
- Two extra draw calls per mesh while a section is active, and none otherwise.
- Open meshes produce partial caps, because the in/out count assumes a closed
  surface. The printability check already reports open edges, which explains it.
- Raycasting has to ignore hits on the cut-away side, since the raycaster does
  not know about clipping. `Engine.nearestHit()` filters them.

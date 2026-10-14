import type { Printability } from '@/types';
import type { TriangleSource } from './triangles';

/**
 * The checks a slicer runs before it slices: how much material is in the part,
 * whether its surface is closed, and how much of it hangs over nothing.
 *
 * All of it is plain arithmetic over a stream of triangles, with no three.js
 * scene involved, so every number here is unit-tested against shapes whose
 * answers are known by hand. Results are in the file's own units; the store
 * converts them to millimetres.
 */

export type Vec3 = [number, number, number];

/** The default overhang limit: the 45° rule every FDM printer is tuned around. */
export const OVERHANG_DEFAULT = 45;

/**
 * Faces that point down more steeply than `degrees` from vertical need
 * support. A wall is 0°, a flat ceiling is 90°. Returned as the threshold on
 * the dot product between a face normal and the down direction.
 */
export function overhangThreshold(degrees: number): number {
  return Math.sin((degrees * Math.PI) / 180);
}

interface Bounds {
  min: Vec3;
  max: Vec3;
}

/**
 * The scratch the per-triangle maths writes into, so the hot loop allocates
 * nothing. Edge vectors, the cross product, and its length.
 */
function cross(t: ArrayLike<number>, out: Float64Array): number {
  const ux = t[3] - t[0];
  const uy = t[4] - t[1];
  const uz = t[5] - t[2];
  const vx = t[6] - t[0];
  const vy = t[7] - t[1];
  const vz = t[8] - t[2];
  out[0] = uy * vz - uz * vy;
  out[1] = uz * vx - ux * vz;
  out[2] = ux * vy - uy * vx;
  return Math.hypot(out[0], out[1], out[2]);
}

function lowestAlong(source: TriangleSource, down: Vec3): number {
  let bottom = -Infinity;
  source((t) => {
    for (let c = 0; c < 9; c += 3) {
      const d = t[c] * down[0] + t[c + 1] * down[1] + t[c + 2] * down[2];
      if (d > bottom) bottom = d;
    }
  });
  return bottom;
}

/**
 * Area of the surface that would print in mid-air. A face counts when its
 * normal points down past the threshold *and* it is not already lying on the
 * plate — the underside of a cube faces straight down, and it needs nothing.
 *
 * `down` is the direction of the plate, in the same space as the triangles.
 */
export function overhangArea(source: TriangleSource, down: Vec3, degrees = OVERHANG_DEFAULT): number {
  const bottom = lowestAlong(source, down);
  const threshold = overhangThreshold(degrees);
  const n = new Float64Array(3);
  let area = 0;
  let span = 0;

  // A tolerance for "on the plate" that scales with the part, so a 2 mm clip
  // and a 2 m beam are judged the same way.
  source((t) => {
    for (let c = 0; c < 9; c += 3) {
      span = Math.max(span, Math.abs(t[c]), Math.abs(t[c + 1]), Math.abs(t[c + 2]));
    }
  });
  const onPlate = Math.max(span * 1e-5, 1e-9);

  source((t) => {
    const length = cross(t, n);
    if (length === 0) return;
    const facing = (n[0] * down[0] + n[1] * down[1] + n[2] * down[2]) / length;
    if (facing <= threshold) return;

    let resting = true;
    for (let c = 0; c < 9 && resting; c += 3) {
      const d = t[c] * down[0] + t[c + 1] * down[1] + t[c + 2] * down[2];
      if (bottom - d > onPlate) resting = false;
    }
    if (!resting) area += length / 2;
  });

  return area;
}

/**
 * Welds corners that sit within `tolerance` of each other and counts the edges
 * that only one triangle uses. A closed, printable surface has none; each one
 * is the rim of a hole a slicer will have to guess its way across.
 */
export function openEdges(source: TriangleSource, tolerance: number): number {
  const ids = new Map<string, number>();
  const edges = new Map<number, number>();
  const scale = 1 / Math.max(tolerance, 1e-12);
  // Vertex ids stay far below this, so a pair packs into one safe integer.
  const STRIDE = 67_108_864;

  const idOf = (x: number, y: number, z: number) => {
    const key = `${Math.round(x * scale)},${Math.round(y * scale)},${Math.round(z * scale)}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = ids.size;
      ids.set(key, id);
    }
    return id;
  };

  source((t) => {
    const a = idOf(t[0], t[1], t[2]);
    const b = idOf(t[3], t[4], t[5]);
    const c = idOf(t[6], t[7], t[8]);
    // A triangle with two welded corners has no area and no real edges.
    if (a === b || b === c || c === a) return;
    for (const [p, q] of [
      [a, b],
      [b, c],
      [c, a],
    ]) {
      const key = p < q ? p * STRIDE + q : q * STRIDE + p;
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  });

  let open = 0;
  for (const uses of edges.values()) if (uses === 1) open++;
  return open;
}

/**
 * Volume, surface area and closure in one go.
 *
 * Volume is the sum of signed tetrahedra from the origin to each face — exact
 * for a closed surface, whatever its shape, and meaningless for an open one,
 * which is why the open-edge count travels with it.
 */
export function analyse(
  source: TriangleSource,
  options: { down?: Vec3; overhangDeg?: number; skipEdges?: boolean } = {},
): Printability {
  const n = new Float64Array(3);
  const bounds: Bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  let volume = 0;
  let area = 0;
  let triangles = 0;

  source((t) => {
    triangles++;
    area += cross(t, n) / 2;
    // a · (b × c), the signed volume of the tetrahedron to the origin, ×6.
    volume +=
      (t[0] * (t[4] * t[8] - t[5] * t[7]) -
        t[1] * (t[3] * t[8] - t[5] * t[6]) +
        t[2] * (t[3] * t[7] - t[4] * t[6])) /
      6;
    for (let c = 0; c < 9; c += 3) {
      for (let k = 0; k < 3; k++) {
        const value = t[c + k];
        if (value < bounds.min[k]) bounds.min[k] = value;
        if (value > bounds.max[k]) bounds.max[k] = value;
      }
    }
  });

  if (!triangles) return { volume: null, area: null, openEdges: null, overhangArea: null };

  const diagonal = Math.hypot(
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  );

  return {
    volume: Math.abs(volume),
    area,
    openEdges: options.skipEdges ? null : openEdges(source, Math.max(diagonal * 1e-6, 1e-9)),
    overhangArea: overhangArea(source, options.down ?? [0, -1, 0], options.overhangDeg),
  };
}

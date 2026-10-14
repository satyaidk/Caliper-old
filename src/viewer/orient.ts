import type { TriangleSource } from './triangles';
import type { Vec3 } from './printability';

/**
 * Which way up should a part sit on the plate?
 *
 * A part can only rest on a face that touches its convex hull — a face at the
 * very bottom of the part when that face points down. This groups triangles by
 * the direction they face, keeps only the area that lies on the outermost plane
 * in that direction, and ranks the directions by that area. The winner is the
 * largest flat face the part can stand on, which is what Bambu Studio's
 * "lay on face" offers and the first thing its auto-orient looks for.
 *
 * Plain arithmetic over a triangle stream, so it is unit-tested with shapes
 * whose answer is obvious: a slab lies flat, a cube picks a side.
 */

export interface RestingFace {
  /** Unit normal of the face, pointing out of the part. Lay the part so this points down. */
  normal: Vec3;
  /** Area of the part's surface that lies on that outermost plane. */
  area: number;
}

/** Normals within ~2° of each other are treated as the same direction. */
const BUCKETS_PER_UNIT = 30;
/** Only the largest candidate directions are checked against the hull. */
const CANDIDATES = 24;

interface Bucket {
  sum: Vec3;
  area: number;
}

const keyOf = (x: number, y: number, z: number) =>
  `${Math.round(x * BUCKETS_PER_UNIT)},${Math.round(y * BUCKETS_PER_UNIT)},${Math.round(z * BUCKETS_PER_UNIT)}`;

export function restingFaces(source: TriangleSource, count = 6): RestingFace[] {
  const buckets = new Map<string, Bucket>();
  let span = 0;

  source((t) => {
    const ux = t[3] - t[0];
    const uy = t[4] - t[1];
    const uz = t[5] - t[2];
    const vx = t[6] - t[0];
    const vy = t[7] - t[1];
    const vz = t[8] - t[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    for (let i = 0; i < 9; i++) span = Math.max(span, Math.abs(t[i]));
    if (length === 0) return;

    const key = keyOf(nx / length, ny / length, nz / length);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { sum: [0, 0, 0], area: 0 };
      buckets.set(key, bucket);
    }
    // Area-weighted, so the averaged direction leans toward the big faces.
    bucket.sum[0] += nx / 2;
    bucket.sum[1] += ny / 2;
    bucket.sum[2] += nz / 2;
    bucket.area += length / 2;
  });

  const candidates = [...buckets.values()]
    .sort((a, b) => b.area - a.area)
    .slice(0, CANDIDATES)
    .map((bucket) => {
      const length = Math.hypot(...bucket.sum) || 1;
      return [bucket.sum[0] / length, bucket.sum[1] / length, bucket.sum[2] / length] as Vec3;
    });

  if (!candidates.length) return [];

  // The outermost plane along each candidate: the hull's support value.
  const support = candidates.map(() => -Infinity);
  source((t) => {
    for (let c = 0; c < 9; c += 3) {
      for (let k = 0; k < candidates.length; k++) {
        const n = candidates[k];
        const d = t[c] * n[0] + t[c + 1] * n[1] + t[c + 2] * n[2];
        if (d > support[k]) support[k] = d;
      }
    }
  });

  // Only the area that actually lies on that plane can carry the part.
  const tolerance = Math.max(span * 1e-4, 1e-9);
  const onHull = candidates.map(() => 0);
  source((t) => {
    const ux = t[3] - t[0];
    const uy = t[4] - t[1];
    const uz = t[5] - t[2];
    const vx = t[6] - t[0];
    const vy = t[7] - t[1];
    const vz = t[8] - t[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0) return;

    for (let k = 0; k < candidates.length; k++) {
      const n = candidates[k];
      if ((nx * n[0] + ny * n[1] + nz * n[2]) / length < 0.999) continue;
      let flush = true;
      for (let c = 0; c < 9 && flush; c += 3) {
        const d = t[c] * n[0] + t[c + 1] * n[1] + t[c + 2] * n[2];
        if (support[k] - d > tolerance) flush = false;
      }
      if (flush) onHull[k] += length / 2;
    }
  });

  return candidates
    .map((normal, k) => ({ normal, area: onHull[k] }))
    .filter((face) => face.area > 0)
    .sort((a, b) => b.area - a.area)
    .slice(0, count);
}

/**
 * The resting face whose normal is closest to `normal`, if one is within
 * `maxDegrees`. Clicking a face to lay it down snaps to the hull face it
 * belongs to, so a click on a slightly faceted surface still lands square.
 */
export function nearestRestingFace(
  faces: RestingFace[],
  normal: Vec3,
  maxDegrees = 12,
): RestingFace | null {
  const limit = Math.cos((maxDegrees * Math.PI) / 180);
  let best: RestingFace | null = null;
  let bestDot = limit;
  for (const face of faces) {
    const dot = face.normal[0] * normal[0] + face.normal[1] * normal[1] + face.normal[2] * normal[2];
    if (dot >= bestDot) {
      best = face;
      bestDot = dot;
    }
  }
  return best;
}

import * as THREE from 'three';
import type { SnapKind } from '@/types';

/**
 * Picking geometry for the measuring tools.
 *
 * A caliper is only as good as where its jaws land, so a raw surface hit is the
 * last resort here rather than the first answer. Every ray that lands on a
 * triangle offers seven better places to sit: the three corners, the three edge
 * midpoints and the centroid. Whichever of those is closest to the cursor *on
 * screen* wins, which is the only measure of "close" that matches what the hand
 * is doing. Corners beat midpoints beat centroids at equal distance, because a
 * corner is the feature a person was aiming at.
 */

const SNAP_RADIUS_PX = 14;

export interface Snap {
  point: THREE.Vector3;
  kind: SnapKind;
}

interface Candidate {
  point: THREE.Vector3;
  kind: SnapKind;
  /** Lower wins ties: a corner is a more deliberate target than a centroid. */
  rank: number;
}

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _projected = new THREE.Vector3();

/** World-space corners of the triangle a raycast landed on, if it hit one. */
function triangleOf(hit: THREE.Intersection): [THREE.Vector3, THREE.Vector3, THREE.Vector3] | null {
  const face = hit.face;
  const mesh = hit.object as THREE.Mesh;
  const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
  const position = geometry?.getAttribute('position');
  if (!face || !position) return null;

  _a.fromBufferAttribute(position as THREE.BufferAttribute, face.a);
  _b.fromBufferAttribute(position as THREE.BufferAttribute, face.b);
  _c.fromBufferAttribute(position as THREE.BufferAttribute, face.c);

  mesh.updateWorldMatrix(true, false);
  return [
    _a.clone().applyMatrix4(mesh.matrixWorld),
    _b.clone().applyMatrix4(mesh.matrixWorld),
    _c.clone().applyMatrix4(mesh.matrixWorld),
  ];
}

/** Screen position in CSS pixels, measured from the canvas top-left. */
function toScreen(
  world: THREE.Vector3,
  camera: THREE.Camera,
  width: number,
  height: number,
): { x: number; y: number } {
  _projected.copy(world).project(camera);
  return {
    x: (_projected.x * 0.5 + 0.5) * width,
    y: (-_projected.y * 0.5 + 0.5) * height,
  };
}

/**
 * Picks the feature the cursor is really pointing at. `cursor` is in the same
 * CSS-pixel space as `width`/`height`, so the snap radius stays a constant
 * distance on screen no matter how far the camera has zoomed.
 */
export function snapToFeature(
  hit: THREE.Intersection,
  camera: THREE.Camera,
  cursor: { x: number; y: number },
  width: number,
  height: number,
): Snap {
  const surface: Snap = { point: hit.point.clone(), kind: 'surface' };
  const triangle = triangleOf(hit);
  if (!triangle) return surface;

  const [a, b, c] = triangle;
  const candidates: Candidate[] = [
    { point: a, kind: 'vertex', rank: 0 },
    { point: b, kind: 'vertex', rank: 0 },
    { point: c, kind: 'vertex', rank: 0 },
    { point: a.clone().add(b).multiplyScalar(0.5), kind: 'midpoint', rank: 1 },
    { point: b.clone().add(c).multiplyScalar(0.5), kind: 'midpoint', rank: 1 },
    { point: c.clone().add(a).multiplyScalar(0.5), kind: 'midpoint', rank: 1 },
    { point: a.clone().add(b).add(c).divideScalar(3), kind: 'centre', rank: 2 },
  ];

  let best: Candidate | null = null;
  let bestDistance = SNAP_RADIUS_PX;

  for (const candidate of candidates) {
    const screen = toScreen(candidate.point, camera, width, height);
    const distance = Math.hypot(screen.x - cursor.x, screen.y - cursor.y);
    if (distance > bestDistance) continue;
    // Equal-distance ties go to the more deliberate feature.
    if (best && distance === bestDistance && candidate.rank >= best.rank) continue;
    best = candidate;
    bestDistance = distance;
  }

  return best ? { point: best.point, kind: best.kind } : surface;
}

/**
 * The circle through three points — how a hole gets measured when the file has
 * long since forgotten it was ever a cylinder. Returns null when the points are
 * collinear, which is the one case that has no answer.
 */
export function circleThrough(
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
): { centre: THREE.Vector3; radius: number } | null {
  const ab = b.clone().sub(a);
  const ac = c.clone().sub(a);
  const normal = ab.clone().cross(ac);
  const denominator = 2 * normal.lengthSq();
  if (denominator < 1e-18) return null;

  const toCentre = normal
    .clone()
    .cross(ab)
    .multiplyScalar(ac.lengthSq())
    .add(ac.clone().cross(normal).multiplyScalar(ab.lengthSq()))
    .divideScalar(denominator);

  return { centre: a.clone().add(toCentre), radius: toCentre.length() };
}

/**
 * The angle at `vertex` between the arms out to `a` and `b`, in degrees — how
 * a chamfer or a draft gets read when the file only kept the triangles. Null
 * when either arm has no length, because then there is no direction to measure.
 */
export function angleAt(a: THREE.Vector3, vertex: THREE.Vector3, b: THREE.Vector3): number | null {
  const u = a.clone().sub(vertex);
  const v = b.clone().sub(vertex);
  const lengths = u.length() * v.length();
  if (lengths < 1e-12) return null;
  const cosine = THREE.MathUtils.clamp(u.dot(v) / lengths, -1, 1);
  return THREE.MathUtils.radToDeg(Math.acos(cosine));
}

/**
 * A unit vector across the measured span, used to lay the witness ticks flat
 * against the viewer. Falls back to world up for a span pointing at the camera.
 */
export function tickDirection(
  from: THREE.Vector3,
  to: THREE.Vector3,
  camera: THREE.Camera,
): THREE.Vector3 {
  const span = to.clone().sub(from);
  const toCamera = camera.getWorldPosition(new THREE.Vector3()).sub(from);
  const tick = span.clone().cross(toCamera);
  if (tick.lengthSq() < 1e-12) tick.set(0, 1, 0);
  return tick.normalize();
}

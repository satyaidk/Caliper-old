import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { angleAt, circleThrough, snapToFeature, tickDirection } from '../src/viewer/measure.ts';

/* The measuring maths is the one place in this app where a silent wrong answer
   is worse than a crash — a dimension that is confidently off by 2 mm is a
   scrapped part. These tests exist mostly to pin the degenerate cases. */

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

/**
 * `assert.ok` does not narrow a nullable through TypeScript's control flow when
 * the assertion comes in through a namespace import, so this does the narrowing
 * explicitly and keeps the tests free of non-null assertions.
 */
function must<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`expected ${what}, got null`);
  return value;
}

describe('circleThrough', () => {
  test('finds the circle through three points on a known circle', () => {
    // Unit circle in the XY plane, at 0°, 120° and 240°.
    const a = new THREE.Vector3(1, 0, 0);
    const b = new THREE.Vector3(-0.5, Math.sqrt(3) / 2, 0);
    const c = new THREE.Vector3(-0.5, -Math.sqrt(3) / 2, 0);

    const circle = must(circleThrough(a, b, c), 'a circle');
    near(circle.radius, 1);
    near(circle.centre.length(), 0);
  });

  test('works on a circle that is not centred on the origin', () => {
    const centre = new THREE.Vector3(10, -4, 7);
    const r = 3.5;
    const pts = [0, 2.1, 4.3].map(
      (t) => new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0).add(centre),
    );

    const circle = must(circleThrough(pts[0], pts[1], pts[2]), 'a circle');
    near(circle.radius, r, 1e-5);
    near(circle.centre.distanceTo(centre), 0, 1e-5);
  });

  test('works in a plane tilted out of the axes', () => {
    const r = 2;
    const axis = new THREE.Vector3(1, 1, 1).normalize();
    const pts = [0, 1.7, 3.9].map((t) =>
      new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r, 0).applyAxisAngle(axis, 0.9),
    );

    const circle = must(circleThrough(pts[0], pts[1], pts[2]), 'a circle');
    near(circle.radius, r, 1e-5);
  });

  test('returns null for collinear points instead of dividing by zero', () => {
    const a = new THREE.Vector3(0, 0, 0);
    const b = new THREE.Vector3(1, 1, 1);
    const c = new THREE.Vector3(2, 2, 2);
    assert.equal(circleThrough(a, b, c), null);
  });

  test('returns null for coincident points', () => {
    const a = new THREE.Vector3(1, 2, 3);
    assert.equal(circleThrough(a, a.clone(), new THREE.Vector3(4, 5, 6)), null);
  });

  test('never returns NaN for a valid circle', () => {
    const circle = must(
      circleThrough(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(4, 0, 0),
        new THREE.Vector3(0, 3, 0),
      ),
      'a circle',
    );
    assert.ok(Number.isFinite(circle.radius), 'radius must be finite');
    assert.ok(circle.centre.toArray().every(Number.isFinite), 'centre must be finite');
    near(circle.radius, 2.5); // 3-4-5 triangle: hypotenuse 5, circumradius 2.5
  });
});

describe('tickDirection', () => {
  test('is perpendicular to the span', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld(true);

    const from = new THREE.Vector3(-1, 0, 0);
    const to = new THREE.Vector3(1, 0, 0);
    const tick = tickDirection(from, to, camera);

    near(tick.length(), 1);
    near(tick.dot(to.clone().sub(from).normalize()), 0);
  });

  test('falls back to a usable vector when the span points at the camera', () => {
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 10);
    camera.updateMatrixWorld(true);

    // Span parallel to the view direction — the cross product degenerates.
    const tick = tickDirection(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 5), camera);
    assert.ok(tick.toArray().every(Number.isFinite), 'must not be NaN');
    near(tick.length(), 1);
  });
});

describe('snapToFeature', () => {
  /** A single triangle facing the camera, plus a fake raycast hit on it. */
  function scene() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 10, 0, 0, 0, 10, 0], 3),
    );
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.updateMatrixWorld(true);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
    camera.position.set(5, 5, 40);
    camera.lookAt(5, 5, 0);
    camera.updateMatrixWorld(true);

    return { mesh, camera };
  }

  test('snaps to a corner when the cursor is on one', () => {
    const { mesh, camera } = scene();
    const size = 800;

    // Project the triangle's first corner and aim the cursor straight at it.
    const corner = new THREE.Vector3(0, 0, 0);
    const projected = corner.clone().project(camera);
    const cursor = {
      x: (projected.x * 0.5 + 0.5) * size,
      y: (-projected.y * 0.5 + 0.5) * size,
    };

    const hit = {
      distance: 1,
      point: new THREE.Vector3(3, 3, 0), // deliberately not the corner
      object: mesh,
      face: { a: 0, b: 1, c: 2, normal: new THREE.Vector3(0, 0, 1), materialIndex: 0 },
    } as unknown as THREE.Intersection;

    const snap = snapToFeature(hit, camera, cursor, size, size);
    assert.equal(snap.kind, 'vertex');
    near(snap.point.distanceTo(corner), 0, 1e-4);
  });

  test('falls back to the raw surface point when nothing is near', () => {
    const { mesh, camera } = scene();
    const size = 800;
    const point = new THREE.Vector3(3.3, 3.3, 0);

    const hit = {
      distance: 1,
      point,
      object: mesh,
      face: { a: 0, b: 1, c: 2, normal: new THREE.Vector3(0, 0, 1), materialIndex: 0 },
    } as unknown as THREE.Intersection;

    // Cursor way off in the corner of the viewport, far from every candidate.
    const snap = snapToFeature(hit, camera, { x: 0, y: 0 }, size, size);
    assert.equal(snap.kind, 'surface');
    near(snap.point.distanceTo(point), 0);
  });

  test('returns the raw point when the hit carries no face', () => {
    const { mesh, camera } = scene();
    const point = new THREE.Vector3(1, 2, 0);
    const hit = { distance: 1, point, object: mesh } as unknown as THREE.Intersection;

    const snap = snapToFeature(hit, camera, { x: 10, y: 10 }, 800, 800);
    assert.equal(snap.kind, 'surface');
  });
});

describe('angleAt', () => {
  const o = new THREE.Vector3(0, 0, 0);

  test('reads a right angle', () => {
    near(must(angleAt(new THREE.Vector3(1, 0, 0), o, new THREE.Vector3(0, 5, 0)), 'an angle'), 90);
  });

  test('reads a straight line as 180 and a fold-back as 0', () => {
    near(must(angleAt(new THREE.Vector3(1, 0, 0), o, new THREE.Vector3(-3, 0, 0)), 'an angle'), 180);
    near(must(angleAt(new THREE.Vector3(1, 0, 0), o, new THREE.Vector3(4, 0, 0)), 'an angle'), 0);
  });

  test('reads a 45° chamfer away from the origin', () => {
    const vertex = new THREE.Vector3(10, 10, 10);
    const a = vertex.clone().add(new THREE.Vector3(2, 0, 0));
    const b = vertex.clone().add(new THREE.Vector3(3, 3, 0));
    near(must(angleAt(a, vertex, b), 'an angle'), 45);
  });

  test('returns null when an arm has no length', () => {
    assert.equal(angleAt(o.clone(), o, new THREE.Vector3(1, 0, 0)), null);
  });
});

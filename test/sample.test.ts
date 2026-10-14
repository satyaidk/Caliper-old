import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GEAR, gearGeometry, gearRadii, gearReferencePoints } from '../src/lib/sample.ts';
import { circleThrough } from '../src/viewer/measure.ts';

/* The website shows these measurements on the live gear and says what they
   are, so the numbers have to be what the copy claims. */

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);

describe('the sample gear', () => {
  test('tips sit on a 50 mm circle', () => {
    assert.equal(gearRadii().tip * 2, 50);
    const [a, b, c] = gearReferencePoints().tips.map((p) => new THREE.Vector3(...p));
    const circle = circleThrough(a, b, c);
    assert.ok(circle, 'the tips are not collinear');
    near(circle.radius * 2, 50);
  });

  test('the bore points fit an 8 mm circle', () => {
    const [a, b, c] = gearReferencePoints().bore.map((p) => new THREE.Vector3(...p));
    near((circleThrough(a, b, c)?.radius ?? 0) * 2, GEAR.bore);
  });

  test('the thickness reference spans the full thickness', () => {
    const [a, b] = gearReferencePoints().thickness.map((p) => new THREE.Vector3(...p));
    near(a.distanceTo(b), GEAR.thickness);
  });

  test('the geometry lies flat on the plate with the stated thickness', () => {
    const geometry = gearGeometry();
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    near(box.min.y, 0);
    near(box.max.y, GEAR.thickness);
    // Tooth tips reach the tip circle but no further.
    assert.ok(Math.max(box.max.x, -box.min.x, box.max.z, -box.min.z) <= gearRadii().tip + 1e-9);
  });
});

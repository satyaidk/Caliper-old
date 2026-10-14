import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { creasedNormals } from '../src/viewer/normals.ts';

const near = (actual: number, expected: number, tolerance = 1e-5) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `expected ${actual} to be within ${tolerance} of ${expected}`);

/** Loose triangles from a list of corners, the way an STL arrives. */
function soup(...triangles: number[][]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles.flat(), 3));
  return geometry;
}

const normalAt = (geometry: THREE.BufferGeometry, corner: number) =>
  new THREE.Vector3().fromBufferAttribute(geometry.getAttribute('normal') as THREE.BufferAttribute, corner);

describe('creasedNormals', () => {
  test('keeps a 90° edge sharp', () => {
    // A floor triangle and a wall triangle sharing the edge along x.
    const floor = [0, 0, 0, 1, 0, 0, 0, 0, -1];
    const wall = [0, 0, 0, 0, 1, 0, 1, 0, 0];
    const geometry = creasedNormals(soup(floor, wall));
    // The shared corner at the origin keeps each face's own direction.
    near(normalAt(geometry, 0).y, 1);
    near(normalAt(geometry, 3).z, -1);
  });

  test('smooths across a shallow fold', () => {
    // Two triangles folded by 10° along the y axis.
    const tilt = Math.sin((10 * Math.PI) / 180);
    const flat = [0, 0, 0, 0, 1, 0, -1, 0, 0];
    const folded = [0, 0, 0, 1, 0, -tilt, 0, 1, 0];
    const geometry = creasedNormals(soup(flat, folded));
    const shared = normalAt(geometry, 0);
    const other = normalAt(geometry, 3);
    // Both faces' copies of the shared corner agree, so there is no seam.
    near(shared.angleTo(other), 0);
    assert.ok(shared.z > 0.99, 'the averaged normal still points out of the surface');
  });

  test('welds corners relative to the part size, so tiny parts work', () => {
    // The same fold, a thousand times smaller: a fixed 0.01 grid would weld
    // all three corners of each triangle together.
    const s = 0.001;
    const tilt = Math.sin((10 * Math.PI) / 180) * s;
    const flat = [0, 0, 0, 0, s, 0, -s, 0, 0];
    const folded = [0, 0, 0, s, 0, -tilt, 0, s, 0];
    const geometry = creasedNormals(soup(flat, folded));
    near(normalAt(geometry, 0).angleTo(normalAt(geometry, 3)), 0);
    // A corner not shared keeps its own face's normal.
    near(normalAt(geometry, 2).z, 1);
  });

  test('returns unit normals and survives a degenerate triangle', () => {
    const geometry = creasedNormals(soup([0, 0, 0, 1, 0, 0, 0, 1, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]));
    for (let i = 0; i < 3; i++) near(normalAt(geometry, i).length(), 1);
  });
});

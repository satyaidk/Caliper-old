import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fromArray } from '../src/viewer/triangles.ts';
import {
  analyse,
  openEdges,
  overhangArea,
  overhangThreshold,
} from '../src/viewer/printability.ts';
import { nearestRestingFace, restingFaces } from '../src/viewer/orient.ts';

/* Shapes with answers you can work out on paper. A box of known sides has a
   known volume and area; a box with its lid missing has exactly four open
   edges; a mushroom has an overhang of exactly the cap's underside. */

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `expected ${actual} to be within ${tolerance} of ${expected}`,
  );

/**
 * An axis-aligned box from `min` to `max` as twelve outward-facing triangles.
 * `skip` drops faces by name, for building open shapes.
 */
function box(
  min: [number, number, number],
  max: [number, number, number],
  skip: string[] = [],
): number[] {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const quads: Record<string, number[][]> = {
    // Corners in counter-clockwise order seen from outside.
    bottom: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    top: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
    front: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    back: [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]],
    left: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    right: [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
  };
  const out: number[] = [];
  for (const [name, [a, b, c, d]] of Object.entries(quads)) {
    if (skip.includes(name)) continue;
    out.push(...a, ...b, ...c, ...a, ...c, ...d);
  }
  return out;
}

describe('analyse', () => {
  test('measures the volume and area of a box', () => {
    const report = analyse(fromArray(box([0, 0, 0], [10, 20, 30])));
    near(report.volume ?? NaN, 6000);
    near(report.area ?? NaN, 2 * (10 * 20 + 20 * 30 + 10 * 30));
  });

  test('gets the same volume wherever the box sits', () => {
    // Signed tetrahedra cancel properly only for a closed surface; moving it
    // far from the origin is the test that the cancellation really happens.
    const report = analyse(fromArray(box([500, -300, 120], [510, -280, 150])));
    near(report.volume ?? NaN, 6000, 1e-4);
  });

  test('reports a closed box as having no open edges', () => {
    assert.equal(analyse(fromArray(box([0, 0, 0], [1, 1, 1]))).openEdges, 0);
  });

  test('returns nulls for an empty stream rather than zeros', () => {
    const report = analyse(fromArray([]));
    assert.equal(report.volume, null);
    assert.equal(report.openEdges, null);
  });

  test('can skip the edge check on request', () => {
    assert.equal(analyse(fromArray(box([0, 0, 0], [1, 1, 1])), { skipEdges: true }).openEdges, null);
  });
});

describe('openEdges', () => {
  test('counts the rim of a box with no lid', () => {
    assert.equal(openEdges(fromArray(box([0, 0, 0], [1, 1, 1], ['top'])), 1e-6), 4);
  });

  test('welds corners that differ only by float noise', () => {
    const shape = box([0, 0, 0], [1, 1, 1]);
    // Nudge one copy of a shared corner by far less than the tolerance.
    shape[0] += 1e-9;
    assert.equal(openEdges(fromArray(shape), 1e-6), 0);
  });

  test('ignores triangles that collapse to a line', () => {
    const shape = [...box([0, 0, 0], [1, 1, 1]), 0, 0, 0, 0, 0, 0, 1, 1, 1];
    assert.equal(openEdges(fromArray(shape), 1e-6), 0);
  });
});

describe('overhangArea', () => {
  test('a box standing on the plate has no overhang', () => {
    near(overhangArea(fromArray(box([0, 0, 0], [10, 10, 10])), [0, -1, 0]), 0);
  });

  test('a mushroom overhangs by exactly the underside of its cap', () => {
    // A 2×2 stem under a 10×10 cap: the cap's underside is 100, of which the
    // 4 directly over the stem is hidden inside it — but the triangle stream
    // still includes it, since this shape is two separate closed boxes.
    const stem = box([4, 0, 4], [6, 5, 6]);
    const cap = box([0, 5, 0], [10, 7, 10]);
    near(overhangArea(fromArray([...stem, ...cap]), [0, -1, 0]), 100);
  });

  test('follows the down direction it is given', () => {
    // Laid on its side, the same box has its old bottom facing sideways.
    near(overhangArea(fromArray(box([0, 0, 0], [10, 10, 10])), [1, 0, 0]), 0);
  });

  test('a 30° slope passes a 45° limit, a 60° one does not', () => {
    // One downward-facing triangle tilted `deg` from vertical, lifted off the
    // plate by a separate point so it is not resting on it.
    const tilted = (deg: number) => {
      const r = (deg * Math.PI) / 180;
      const run = Math.sin(r);
      const rise = Math.cos(r);
      // Normal points down and out; the face rises as it moves along +x.
      return [0, 5, 0, run * 10, 5 + rise * 10, 0, 0, 5, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    };
    const steep = overhangArea(fromArray(tilted(30)), [0, -1, 0], 45);
    const shallow = overhangArea(fromArray(tilted(60)), [0, -1, 0], 45);
    near(steep, 0);
    assert.ok(shallow > 0, 'a face 60° from vertical needs support');
  });
});

describe('overhangThreshold', () => {
  test('is 0 for a wall and 1 for a ceiling', () => {
    near(overhangThreshold(0), 0);
    near(overhangThreshold(90), 1);
  });
});

describe('restingFaces', () => {
  test('a slab rests on one of its two broad faces', () => {
    const [best] = restingFaces(fromArray(box([0, 0, 0], [40, 2, 20])));
    near(Math.abs(best.normal[1]), 1);
    near(best.area, 800);
  });

  test('only counts the area that is on the outside', () => {
    // A step: the lower tread faces up but sits below the top, so a part
    // flipped onto "up" would rest on the higher face only.
    const lower = box([0, 0, 0], [10, 2, 10]);
    const upper = box([0, 2, 0], [5, 4, 10]);
    const faces = restingFaces(fromArray([...lower, ...upper]), 12);
    const up = faces.find((face) => face.normal[1] > 0.99);
    assert.ok(up, 'an upward face exists on the hull');
    near(up.area, 50);
  });

  test('returns nothing for nothing', () => {
    assert.deepEqual(restingFaces(fromArray([])), []);
  });
});

describe('nearestRestingFace', () => {
  const faces = [
    { normal: [0, -1, 0] as [number, number, number], area: 10 },
    { normal: [1, 0, 0] as [number, number, number], area: 5 },
  ];

  test('snaps a slightly-off click to the face it belongs to', () => {
    const tilt = Math.sin((5 * Math.PI) / 180);
    const hit = nearestRestingFace(faces, [tilt, -Math.cos((5 * Math.PI) / 180), 0]);
    assert.equal(hit?.area, 10);
  });

  test('refuses a direction no resting face is near', () => {
    assert.equal(nearestRestingFace(faces, [0, 0, 1]), null);
  });
});

describe('meshTriangles', () => {
  test('reads indexed geometry in the root’s own space, through child transforms', async () => {
    const THREE = await import('three');
    const { meshTriangles } = await import('../src/viewer/triangles.ts');
    const root = new THREE.Group();
    // Moving or scaling the root must not change the answer; scaling a child must.
    root.position.set(100, 0, 0);
    root.scale.setScalar(7);
    const child = new THREE.Mesh(new THREE.BoxGeometry(10, 20, 30));
    child.scale.set(2, 1, 1);
    child.position.set(5, 5, 5);
    root.add(child);
    const { source, total } = meshTriangles(root);
    assert.equal(total, 12);
    near(analyse(source).volume ?? NaN, 2 * 10 * 20 * 30, 1e-6);
  });

  test('skips helpers the Engine hangs off a mesh', async () => {
    const THREE = await import('three');
    const { meshTriangles } = await import('../src/viewer/triangles.ts');
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    const helper = new THREE.Mesh(mesh.geometry);
    helper.userData.caliperHelper = true;
    mesh.add(helper);
    root.add(mesh);
    assert.equal(meshTriangles(root).total, 12);
  });

  test('stops at the limit it is given', async () => {
    const THREE = await import('three');
    const { meshTriangles } = await import('../src/viewer/triangles.ts');
    const root = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
    let seen = 0;
    meshTriangles(root, 5).source(() => seen++);
    assert.equal(seen, 5);
  });
});

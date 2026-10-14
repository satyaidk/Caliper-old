import * as THREE from 'three';

/**
 * A stream of triangles, each handed over as nine numbers: the x, y, z of its
 * three corners. Analysis code is written against this rather than against
 * three.js meshes, so the same functions run on a loaded model in the browser
 * and on a hand-written cube in a unit test.
 */
export type TriangleSource = (visit: (t: ArrayLike<number>) => void) => void;

/** A source over a flat array, nine numbers per triangle. Used by the tests. */
export function fromArray(values: ArrayLike<number>): TriangleSource {
  return (visit) => {
    const t = new Float64Array(9);
    for (let i = 0; i + 8 < values.length; i += 9) {
      for (let k = 0; k < 9; k++) t[k] = values[i + k];
      visit(t);
    }
  };
}

/**
 * Every triangle under `root`, in `root`'s own coordinate space — the file's
 * units, before Caliper's framing. Point clouds and lines are skipped. Parts
 * hidden in the object list are included: hiding a part is a way of looking,
 * and does not take material out of the print.
 *
 * `limit` caps the work on very large models: past it, the stream stops and
 * the caller is told so through the return value.
 */
export function meshTriangles(root: THREE.Object3D, limit = Infinity): { source: TriangleSource; total: number } {
  root.updateWorldMatrix(true, true);
  const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert();

  const meshes: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 }[] = [];
  let total = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || mesh.userData.caliperHelper) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry?.getAttribute('position');
    if (!position) return;
    const index = geometry.getIndex();
    total += Math.floor((index ? index.count : position.count) / 3);
    meshes.push({ geometry, matrix: new THREE.Matrix4().multiplyMatrices(toRoot, mesh.matrixWorld) });
  });

  const source: TriangleSource = (visit) => {
    const t = new Float64Array(9);
    const v = new THREE.Vector3();
    let seen = 0;
    for (const { geometry, matrix } of meshes) {
      const position = geometry.getAttribute('position') as THREE.BufferAttribute;
      const index = geometry.getIndex();
      const count = index ? index.count : position.count;
      for (let i = 0; i + 2 < count; i += 3) {
        if (seen++ >= limit) return;
        for (let corner = 0; corner < 3; corner++) {
          const vertex = index ? index.getX(i + corner) : i + corner;
          v.fromBufferAttribute(position, vertex).applyMatrix4(matrix);
          t[corner * 3] = v.x;
          t[corner * 3 + 1] = v.y;
          t[corner * 3 + 2] = v.z;
        }
        visit(t);
      }
    }
  };

  return { source, total };
}

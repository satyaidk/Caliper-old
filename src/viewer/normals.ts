import * as THREE from 'three';

/**
 * Vertex normals with a crease angle, for formats that store loose triangles.
 *
 * An STL has one normal per face and no shared corners. Shading it as it comes
 * makes a scanned figure look cut from facets; welding every shared corner and
 * averaging makes a CAD bracket's flat faces shade with dark diagonal smears,
 * because a corner on a 90° edge averages two directions that have nothing to
 * do with each other. A crease angle does what a slicer's renderer does: faces
 * meeting at less than the angle are smoothed into each other, sharper edges
 * stay sharp.
 *
 * Three.js ships `toCreasedNormals`, but it welds corners on a fixed 0.01-unit
 * grid — a file drawn in metres has whole features smaller than that — and
 * allocates an object per triangle. This welds on a grid scaled to the part
 * and keeps everything in typed arrays.
 */
export function creasedNormals(geometry: THREE.BufferGeometry, creaseRadians = Math.PI / 6): THREE.BufferGeometry {
  const source = geometry.index ? geometry.toNonIndexed() : geometry;
  const position = source.getAttribute('position') as THREE.BufferAttribute;
  const corners = position.count;
  const triangles = Math.floor(corners / 3);
  if (!triangles) return source;

  // Weld corners that sit within a millionth of the part's size of each other.
  source.computeBoundingBox();
  const span = source.boundingBox!.getSize(new THREE.Vector3()).length();
  const scale = 1 / Math.max(span * 1e-6, 1e-12);
  const ids = new Uint32Array(corners);
  const lookup = new Map<string, number>();
  for (let i = 0; i < corners; i++) {
    const key = `${Math.round(position.getX(i) * scale)},${Math.round(position.getY(i) * scale)},${Math.round(position.getZ(i) * scale)}`;
    let id = lookup.get(key);
    if (id === undefined) {
      id = lookup.size;
      lookup.set(key, id);
    }
    ids[i] = id;
  }
  const vertices = lookup.size;

  // Unit face normals, and each face's area as its weight in the average.
  const face = new Float32Array(triangles * 3);
  const weight = new Float32Array(triangles);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let f = 0; f < triangles; f++) {
    a.fromBufferAttribute(position, f * 3);
    b.fromBufferAttribute(position, f * 3 + 1);
    c.fromBufferAttribute(position, f * 3 + 2);
    c.sub(b);
    a.sub(b);
    c.cross(a);
    const length = c.length();
    weight[f] = length;
    if (length > 0) c.divideScalar(length);
    face[f * 3] = c.x;
    face[f * 3 + 1] = c.y;
    face[f * 3 + 2] = c.z;
  }

  // The faces around each welded vertex, packed: faces[start[v] .. start[v+1]].
  const start = new Uint32Array(vertices + 1);
  for (let i = 0; i < corners; i++) start[ids[i] + 1]++;
  for (let v = 0; v < vertices; v++) start[v + 1] += start[v];
  const fill = start.slice(0, vertices);
  const faces = new Uint32Array(corners);
  for (let i = 0; i < corners; i++) faces[fill[ids[i]]++] = Math.floor(i / 3);

  const limit = Math.cos(creaseRadians);
  const normals = new Float32Array(corners * 3);
  for (let i = 0; i < corners; i++) {
    const own = Math.floor(i / 3);
    const ox = face[own * 3];
    const oy = face[own * 3 + 1];
    const oz = face[own * 3 + 2];
    let x = 0;
    let y = 0;
    let z = 0;
    const v = ids[i];
    for (let k = start[v]; k < start[v + 1]; k++) {
      const g = faces[k];
      const gx = face[g * 3];
      const gy = face[g * 3 + 1];
      const gz = face[g * 3 + 2];
      if (gx * ox + gy * oy + gz * oz < limit) continue;
      x += gx * weight[g];
      y += gy * weight[g];
      z += gz * weight[g];
    }
    const length = Math.hypot(x, y, z);
    if (length > 0) {
      normals[i * 3] = x / length;
      normals[i * 3 + 1] = y / length;
      normals[i * 3 + 2] = z / length;
    } else {
      normals[i * 3] = ox;
      normals[i * 3 + 1] = oy;
      normals[i * 3 + 2] = oz;
    }
  }

  source.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return source;
}

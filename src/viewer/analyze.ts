import * as THREE from 'three';
import type { Dimensions, SceneStats } from '@/types';

export function computeStats(root: THREE.Object3D): SceneStats {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let objects = 0;
  let meshes = 0;
  let triangles = 0;
  let vertices = 0;

  root.traverse((node) => {
    objects++;
    const geo = (node as THREE.Mesh).geometry as THREE.BufferGeometry | undefined;
    if (!geo?.isBufferGeometry) return;

    const isMesh = (node as THREE.Mesh).isMesh;
    if (isMesh) meshes++;

    const position = geo.getAttribute('position');
    if (position) {
      vertices += position.count;
      if (isMesh) {
        const indexed = geo.getIndex();
        triangles += (indexed ? indexed.count : position.count) / 3;
      }
    }

    const material = (node as THREE.Mesh).material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of list) {
      materials.add(m);
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        if (value && (value as THREE.Texture).isTexture) textures.add(value as THREE.Texture);
      }
    }
  });

  return {
    objects,
    meshes,
    triangles: Math.round(triangles),
    vertices,
    materials: materials.size,
    textures: textures.size,
  };
}

/**
 * The model's own bounding box, in the file's own units. Taken before the model
 * is added to the viewer's scaled holder, so these are the numbers the author
 * drew — which is the whole point of showing them.
 */
export function computeDimensions(root: THREE.Object3D): Dimensions {
  // Precise: a rotated node's bounding box, re-boxed, is bigger than the part.
  const box = new THREE.Box3().setFromObject(root, true);
  if (box.isEmpty()) {
    return { x: 0, y: 0, z: 0, diagonal: 0, center: [0, 0, 0] };
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return {
    x: size.x,
    y: size.y,
    z: size.z,
    diagonal: size.length(),
    center: [center.x, center.y, center.z],
  };
}

export function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    mesh.geometry?.dispose?.();
    const material = mesh.material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const m of list) {
      for (const value of Object.values(m as unknown as Record<string, unknown>)) {
        if (value && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
      }
      m.dispose();
    }
  });
}

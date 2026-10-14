import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { TDSLoader } from 'three/examples/jsm/loaders/TDSLoader.js';
import { ThreeMFLoader } from 'three/examples/jsm/loaders/3MFLoader.js';
import { AMFLoader } from 'three/examples/jsm/loaders/AMFLoader.js';
import { VRMLLoader } from 'three/examples/jsm/loaders/VRMLLoader.js';


import { baseOf, extOf } from '@/lib/formats';
import { CDN } from '@/lib/cdn';
import { getActiveRenderer } from '@/viewer/renderer-registry';
import { creasedNormals } from '@/viewer/normals';
import type { LoadContext, LoadResult } from '@/types';

/**
 * Files arrive as a flat drop, but glTF and OBJ reference siblings by relative
 * path. A URL modifier rewrites every request to the blob we already hold, so
 * textures and .mtl files resolve without a server.
 */
function managerFor(ctx: LoadContext): THREE.LoadingManager {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    const clean = decodeURIComponent(url.split('?')[0].split('#')[0]);
    return ctx.urls.get(clean.toLowerCase()) ?? ctx.urls.get(baseOf(clean).toLowerCase()) ?? url;
  });
  return manager;
}

function wrap(geometry: THREE.BufferGeometry, name: string): THREE.Object3D {
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = name;
  return mesh;
}

async function arrayBuffer(file: File) {
  return await file.arrayBuffer();
}

/** Point clouds and vertex-coloured scans need a different material. */
function pointsFrom(geometry: THREE.BufferGeometry, name: string): THREE.Object3D {
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere?.radius ?? 1;
  const material = new THREE.PointsMaterial({
    size: Math.max(radius / 400, 1e-4),
    vertexColors: Boolean(geometry.getAttribute('color')),
    color: geometry.getAttribute('color') ? 0xffffff : 0x9fb4cf,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geometry, material);
  points.name = name;
  return points;
}

export async function loadMesh(file: File, ctx: LoadContext): Promise<LoadResult> {
  const ext = extOf(file.name);
  const manager = managerFor(ctx);
  const url = ctx.urls.get(file.name.toLowerCase())!;
  ctx.onProgress(null, 'Reading geometry');

  switch (ext) {
    case 'stl': {
      const geometry = new STLLoader().parse(await arrayBuffer(file));
      // STL stores loose triangles with one normal per face. Smoothing every
      // shared corner would shade a flat face of a CAD part with dark
      // gradients; keeping only face normals makes a scan look like a disco
      // ball. A crease angle does both: corners sharper than 30° stay sharp,
      // gentler ones are smoothed. Past 800,000 triangles the face normals the
      // file came with are kept, because welding that many corners stalls.
      const triangles = geometry.getAttribute('position').count / 3;
      const shaded = triangles < 800_000 ? creasedNormals(geometry, Math.PI / 6) : geometry;
      return { object: wrap(shaded, file.name), hasAuthoredMaterials: false };
    }

    case 'ply': {
      const geometry = new PLYLoader().parse(await arrayBuffer(file));
      const isCloud = !geometry.getIndex() && !geometry.getAttribute('normal');
      if (isCloud && geometry.getAttribute('position').count > 5000) {
        return { object: pointsFrom(geometry, file.name), hasAuthoredMaterials: true };
      }
      geometry.computeVertexNormals();
      const mesh = wrap(geometry, file.name) as THREE.Mesh;
      if (geometry.getAttribute('color')) {
        (mesh.material as THREE.MeshStandardMaterial).vertexColors = true;
      }
      return { object: mesh, hasAuthoredMaterials: Boolean(geometry.getAttribute('color')) };
    }

    case 'obj': {
      const loader = new OBJLoader(manager);
      const mtlName = [...ctx.files.keys()].find((k) => k.endsWith('.mtl'));
      if (mtlName) {
        ctx.onProgress(null, 'Applying materials');
        const mtlLoader = new MTLLoader(manager);
        mtlLoader.setResourcePath('');
        const materials = mtlLoader.parse(await ctx.files.get(mtlName)!.text(), '');
        materials.preload();
        loader.setMaterials(materials);
      }
      const object = loader.parse(await file.text());
      object.name = file.name;
      return { object, hasAuthoredMaterials: Boolean(mtlName) };
    }

    case 'gltf':
    case 'glb': {
      const loader = new GLTFLoader(manager);
      const draco = new DRACOLoader(manager).setDecoderPath(CDN.draco);
      loader.setDRACOLoader(draco);
      // KTX2 transcodes to a GPU-specific format, so it needs the live renderer.
      const renderer = getActiveRenderer();
      let ktx2: KTX2Loader | null = null;
      if (renderer) {
        ktx2 = new KTX2Loader(manager).setTranscoderPath(CDN.basis).detectSupport(renderer);
        loader.setKTX2Loader(ktx2);
      }
      const gltf = await loader.loadAsync(url, (e) =>
        ctx.onProgress(e.total ? e.loaded / e.total : null),
      );
      draco.dispose();
      ktx2?.dispose();
      gltf.scene.name = file.name;
      return { object: gltf.scene, hasAuthoredMaterials: true };
    }

    case 'fbx': {
      const object = new FBXLoader(manager).parse(await arrayBuffer(file), '');
      object.name = file.name;
      return { object, hasAuthoredMaterials: true };
    }

    case 'dae': {
      const result = new ColladaLoader(manager).parse(await file.text(), '');
      result.scene.name = file.name;
      return { object: result.scene, hasAuthoredMaterials: true };
    }

    case '3ds': {
      const object = new TDSLoader(manager).parse(await arrayBuffer(file), '');
      object.name = file.name;
      return { object, hasAuthoredMaterials: true };
    }

    case '3mf': {
      const object = new ThreeMFLoader(manager).parse(await arrayBuffer(file));
      object.name = file.name;
      return { object, hasAuthoredMaterials: true };
    }

    case 'amf': {
      const object = new AMFLoader(manager).parse(await arrayBuffer(file));
      object.name = file.name;
      return { object, hasAuthoredMaterials: true };
    }

    case 'wrl': {
      const object = new VRMLLoader(manager).parse(await file.text(), '');
      object.name = file.name;
      return { object, hasAuthoredMaterials: true };
    }

    default:
      throw new Error(`No mesh loader is registered for .${ext}`);
  }
}

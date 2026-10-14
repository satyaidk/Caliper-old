import * as THREE from 'three';
import type { Axis, ClipState } from '@/types';

/**
 * A section view: one plane through the model, everything on one side of it
 * cut away, and the cut face filled in solid.
 *
 * Clipping alone leaves a hollow shell — you look through the cut into the
 * inside of the surface, which reads as a broken render rather than a section.
 * The fill uses the stencil buffer, the technique from three.js's clipping
 * example: every mesh is drawn once more with colour writes off, adding one to
 * the stencil for each back face and subtracting one for each front face. Where
 * the ray is inside the solid, the count is non-zero, and the cap — a big plane
 * lying on the cut — only draws there.
 *
 * The stencil copies are children of the meshes they shadow, so they follow
 * every explode and reorientation without being told. They are tagged as
 * helpers so the Engine's own traversals step over them.
 */

const AXES: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const noRaycast = () => {};

/** Hatch tile size on the cap, in world units: two stripes a tile, about fifty across a part. */
const HATCH = 0.32;

/**
 * Diagonal hatching, the way a section is marked on an engineering drawing,
 * so a cut face can never be mistaken for a real surface of the part. White
 * and grey here; the cap material's colour tints it.
 */
function hatchTexture(): THREE.Texture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d')!;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.strokeStyle = '#8c8c8c';
  context.lineWidth = 5;
  context.beginPath();
  for (let offset = -size; offset <= size * 2; offset += size / 2) {
    context.moveTo(offset, size);
    context.lineTo(offset + size, 0);
  }
  context.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function stencilMaterial(side: THREE.Side, op: THREE.StencilOp, plane: THREE.Plane) {
  return new THREE.MeshBasicMaterial({
    side,
    clippingPlanes: [plane],
    depthWrite: false,
    depthTest: false,
    colorWrite: false,
    stencilWrite: true,
    stencilFunc: THREE.AlwaysStencilFunc,
    stencilFail: op,
    stencilZFail: op,
    stencilZPass: op,
  });
}

export class Section {
  readonly group = new THREE.Group();
  readonly plane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);

  private readonly back: THREE.MeshBasicMaterial;
  private readonly front: THREE.MeshBasicMaterial;
  private readonly capMaterial: THREE.MeshBasicMaterial;
  private readonly hatch = hatchTexture();
  private readonly cap: THREE.Mesh;
  private readonly copies: THREE.Mesh[] = [];
  private active = false;

  constructor() {
    this.back = stencilMaterial(THREE.BackSide, THREE.IncrementWrapStencilOp, this.plane);
    this.front = stencilMaterial(THREE.FrontSide, THREE.DecrementWrapStencilOp, this.plane);

    // Unlit and hatched: a section is a drawing convention, not a lit surface.
    this.capMaterial = new THREE.MeshBasicMaterial({
      color: 0x8d929a,
      map: this.hatch,
      side: THREE.DoubleSide,
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
    });

    this.cap = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.capMaterial);
    this.cap.renderOrder = 1.1;
    // Clear the count once the cap has used it, so the next frame starts at 0.
    this.cap.onAfterRender = (renderer) => renderer.clearStencil();
    this.cap.visible = false;
    this.cap.raycast = noRaycast;
    this.group.add(this.cap);
  }

  /** The planes model materials should clip against: none, or this one. */
  get planes(): THREE.Plane[] {
    return this.active ? [this.plane] : [];
  }

  get enabled() {
    return this.active;
  }

  /**
   * Places the plane. `box` is the model's world bounds; `at` runs 0 → 1
   * across them. The kept side is below/left/behind the plane unless flipped.
   */
  set(state: ClipState | null, box: THREE.Box3) {
    this.active = Boolean(state) && !box.isEmpty();
    this.cap.visible = this.active;
    for (const copy of this.copies) copy.visible = this.active;
    if (!state || !this.active) return;

    const axis = AXES[state.axis];
    const lo = box.min.dot(axis);
    const hi = box.max.dot(axis);
    // A hair inside the bottom, so the first layer still shows a sliver. At
    // the top the plane goes just past the part: the whole part is kept and
    // there is no cut face to draw.
    const at = THREE.MathUtils.clamp(state.at, 0.0005, 1);
    const position = at >= 1 ? hi + (hi - lo) * 1e-4 : lo + (hi - lo) * at;

    if (state.flip) this.plane.set(axis.clone(), -position);
    else this.plane.set(axis.clone().negate(), position);

    const size = box.getSize(new THREE.Vector3()).length() * 4 + 1;
    this.cap.scale.set(size, size, 1);
    this.hatch.repeat.set(size / HATCH, size / HATCH);
    this.cap.position.copy(box.getCenter(new THREE.Vector3()));
    this.cap.position.setComponent('xyz'.indexOf(state.axis), position);
    this.cap.lookAt(this.cap.position.clone().add(axis));
  }

  /** Builds stencil copies for every mesh in `meshes`. Called once per model. */
  attach(meshes: THREE.Mesh[]) {
    this.detach();
    for (const mesh of meshes) {
      for (const material of [this.back, this.front]) {
        const copy = new THREE.Mesh(mesh.geometry, material);
        copy.renderOrder = 1;
        copy.raycast = noRaycast;
        copy.userData.caliperHelper = true;
        copy.visible = this.active;
        copy.frustumCulled = mesh.frustumCulled;
        mesh.add(copy);
        this.copies.push(copy);
      }
    }
  }

  /** Removes the stencil copies. The geometry belongs to the model, so it stays. */
  detach() {
    for (const copy of this.copies) copy.parent?.remove(copy);
    this.copies.length = 0;
  }

  setCapColour(hex: number) {
    this.capMaterial.color.setHex(hex);
  }

  dispose() {
    this.detach();
    this.back.dispose();
    this.front.dispose();
    this.capMaterial.dispose();
    this.hatch.dispose();
    this.cap.geometry.dispose();
  }
}

import * as THREE from 'three';

/**
 * Bambu Studio's assembly view: pull an assembly's parts away from its centre
 * so you can see how they go together.
 *
 * Each part moves along the line from the assembly's centre to its own centre,
 * by `ratio - 1` times that distance — at 1 everything is where the file put
 * it, at 2 every part is twice as far out. That is the same 1–3 range Bambu
 * Studio's explosion slider uses.
 *
 * The push is worked out once, in each part's parent's own space. Reorienting
 * the model rotates every parent with it, so the push stays correct without
 * being recomputed.
 */

interface Entry {
  node: THREE.Object3D;
  base: THREE.Vector3;
  push: THREE.Vector3;
}

export const EXPLODE_MAX = 3;

export class Explode {
  private entries: Entry[] = [];
  private ratio = 1;

  /** Measures every part against the centre of `root`. */
  prepare(root: THREE.Object3D, parts: THREE.Object3D[]) {
    this.reset();
    this.entries = [];
    if (parts.length < 2) return;

    root.updateWorldMatrix(true, true);
    const centre = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());

    for (const node of parts) {
      const parent = node.parent;
      if (!parent) continue;
      const own = new THREE.Box3().setFromObject(node);
      if (own.isEmpty()) continue;
      const from = own.getCenter(new THREE.Vector3());
      const to = from.clone().add(from.clone().sub(centre));
      // Both ends into the parent's frame; the difference is the local push.
      const push = parent.worldToLocal(to.clone()).sub(parent.worldToLocal(from.clone()));
      this.entries.push({ node, base: node.position.clone(), push });
    }
  }

  /** True when there are at least two parts to pull apart. */
  get available() {
    return this.entries.length > 1;
  }

  get value() {
    return this.ratio;
  }

  apply(ratio: number) {
    this.ratio = THREE.MathUtils.clamp(ratio, 1, EXPLODE_MAX);
    const t = this.ratio - 1;
    for (const { node, base, push } of this.entries) {
      node.position.copy(base).addScaledVector(push, t);
      node.updateMatrixWorld(true);
    }
  }

  reset() {
    if (this.ratio !== 1) this.apply(1);
    this.ratio = 1;
  }

  clear() {
    this.reset();
    this.entries = [];
  }
}

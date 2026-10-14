import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Projection, ViewPreset } from '@/types';

/**
 * The camera, in both of its projections, and the orbit controls that drive it.
 *
 * Perspective is how a part looks. Orthographic is how it measures: parallel
 * edges stay parallel and a feature at the back of the part is drawn at the
 * same scale as one at the front, which is why every CAD package and Bambu
 * Studio offer both. Switching keeps the view — the same target, the same
 * direction, and the same apparent size at the target — so the toggle reads as
 * a change of lens rather than a jump.
 */

const FOV = 38;

/** Camera directions for each preset, pointing from the target to the camera. */
export const VIEW_DIRECTIONS: Record<ViewPreset, [number, number, number]> = {
  default: [0, 0.62, 1],
  top: [0, 1, 0.0001],
  bottom: [0, -1, 0.0001],
  front: [0, 0, 1],
  rear: [0, 0, -1],
  left: [-1, 0, 0],
  right: [1, 0, 0],
  iso: [1, 0.82, 1],
};

export class CameraRig {
  readonly perspective = new THREE.PerspectiveCamera(FOV, 1, 0.01, 4000);
  readonly orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 4000);
  readonly controls: OrbitControls;

  private mode: Projection = 'perspective';
  private aspect = 1;
  /** Half the orthographic view height at zoom 1, in world units. */
  private halfHeight = 6;

  constructor(canvas: HTMLCanvasElement) {
    this.perspective.position.set(9, 6.5, 11);
    this.orthographic.position.copy(this.perspective.position);

    this.controls = new OrbitControls(this.perspective, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.rotateSpeed = 0.85;
    this.controls.panSpeed = 0.85;
    this.controls.zoomSpeed = 0.9;
    this.controls.maxDistance = 2000;
    this.controls.minDistance = 0.05;
    this.controls.minZoom = 0.02;
    this.controls.maxZoom = 400;
  }

  get camera(): THREE.PerspectiveCamera | THREE.OrthographicCamera {
    return this.mode === 'perspective' ? this.perspective : this.orthographic;
  }

  get projection(): Projection {
    return this.mode;
  }

  private tanHalfFov() {
    return Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  }

  private applyFrustum() {
    const h = this.halfHeight;
    this.orthographic.left = -h * this.aspect;
    this.orthographic.right = h * this.aspect;
    this.orthographic.top = h;
    this.orthographic.bottom = -h;
    this.orthographic.updateProjectionMatrix();
  }

  setAspect(aspect: number) {
    this.aspect = aspect || 1;
    this.perspective.aspect = this.aspect;
    this.perspective.updateProjectionMatrix();
    this.applyFrustum();
  }

  setProjection(mode: Projection) {
    if (mode === this.mode) return;
    const target = this.controls.target;
    const from = this.camera;
    const heading = new THREE.Vector3().subVectors(from.position, target);
    const distance = heading.length() || 1;
    heading.normalize();

    if (mode === 'orthographic') {
      // Match the view height the perspective camera has at the target.
      this.halfHeight = distance * this.tanHalfFov();
      this.orthographic.zoom = 1;
      this.orthographic.position.copy(from.position);
      this.orthographic.near = 0.01;
      this.orthographic.far = this.perspective.far;
    } else {
      const visible = this.halfHeight / this.orthographic.zoom;
      const next = visible / this.tanHalfFov();
      this.perspective.position.copy(target).addScaledVector(heading, next);
    }

    const to = mode === 'perspective' ? this.perspective : this.orthographic;
    to.up.copy(from.up);
    to.lookAt(target);
    this.mode = mode;
    this.applyFrustum();
    to.updateProjectionMatrix();
    this.controls.object = to;
    this.controls.update();
  }

  /**
   * Points the camera at `box` from `direction` (or from where it already is)
   * and backs off until the whole box is in view.
   */
  frame(box: THREE.Box3, direction?: THREE.Vector3) {
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.length() / 2, 0.001);

    const heading =
      direction?.clone().normalize() ??
      new THREE.Vector3().subVectors(this.camera.position, this.controls.target).normalize();
    if (heading.lengthSq() < 1e-6) heading.set(...VIEW_DIRECTIONS.iso).normalize();

    // Fit the bounding sphere to the narrower of the two view dimensions.
    const narrow = Math.min(1, this.aspect);
    const distance = (radius / (Math.sin(THREE.MathUtils.degToRad(FOV / 2)) * narrow)) * 1.04;

    this.controls.target.copy(centre);
    for (const camera of [this.perspective, this.orthographic]) {
      camera.position.copy(centre).addScaledVector(heading, distance);
      camera.up.set(0, 1, 0);
      camera.lookAt(centre);
    }

    this.perspective.near = Math.max(radius / 800, 0.005);
    this.perspective.far = Math.max(radius * 400, 100);
    this.perspective.updateProjectionMatrix();

    this.halfHeight = (radius / narrow) * 1.06;
    this.orthographic.zoom = 1;
    this.orthographic.near = 0.01;
    this.orthographic.far = distance + Math.max(radius * 400, 100);
    this.applyFrustum();

    this.controls.update();
  }

  /** Advances damping. True when the camera moved and a frame is due. */
  update(delta: number): boolean {
    return this.controls.update(delta);
  }

  dispose() {
    this.controls.dispose();
  }
}

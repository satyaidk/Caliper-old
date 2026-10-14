import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { circleThrough, tickDirection, type Snap } from './measure';
import type { Measurement } from '@/types';

/**
 * The measuring overlay, drawn the way a dimension is drawn on a paper drawing:
 * a span line between the two points, a short witness tick standing off each
 * end, and the number itself set clear of the geometry. The ticks turn to face
 * the camera as it orbits, which is the whole reason this rebuilds against the
 * view rather than baking once.
 *
 * Everything lives in one wide-line batch. Plain GL lines are locked to a single
 * device pixel, which on a retina panel is half a CSS pixel of colour over a
 * shaded model — too faint to trust a number to. LineSegments2 draws real
 * screen-space width instead, at the cost of having to be told the drawing
 * buffer size whenever the canvas resizes.
 */

const RING_STEPS = 72;

/** Committed work is solid; the span you are still dragging out is dimmer. */
const TONE = {
  solid: 1,
  pending: 0.5,
  cursor: 1,
} as const;

export class Annotations {
  readonly group = new THREE.Group();

  private readonly lines: LineSegments2;
  private readonly material: LineMaterial;

  private positions: number[] = [];
  private colours: number[] = [];

  private mark = new THREE.Color(0xff7a1a);
  /** Model radius in world units — every tick and ring is sized off this. */
  private scaleHint = 1;

  /** Rebuild is view-dependent, so it only runs when the view actually moved. */
  private readonly lastView = new THREE.Vector3(NaN, NaN, NaN);
  private dirty = true;

  constructor() {
    this.material = new LineMaterial({
      linewidth: 1.6,
      vertexColors: true,
      transparent: true,
      depthTest: false,
      dashed: false,
    });
    this.material.resolution.set(1, 1);

    this.lines = new LineSegments2(new LineSegmentsGeometry(), this.material);
    this.lines.renderOrder = 20;
    this.lines.frustumCulled = false;
    this.group.add(this.lines);
  }

  setColour(hex: number) {
    this.mark.setHex(hex);
    this.dirty = true;
  }

  setScaleHint(radius: number) {
    this.scaleHint = Math.max(radius, 1e-4);
    this.dirty = true;
  }

  /** Canvas size in device pixels — LineMaterial needs it to size its quads. */
  setResolution(width: number, height: number) {
    this.material.resolution.set(width, height);
  }

  invalidate() {
    this.dirty = true;
  }

  /* -------------------------------------------------------------- drawing */

  private push(a: THREE.Vector3, b: THREE.Vector3, tone: number) {
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    const { r, g, b: blue } = this.mark;
    this.colours.push(r * tone, g * tone, blue * tone, r * tone, g * tone, blue * tone);
  }

  /** A tick standing across the span, laid flat against the viewer. */
  private witness(at: THREE.Vector3, across: THREE.Vector3, length: number, tone: number) {
    const half = across.clone().multiplyScalar(length / 2);
    this.push(at.clone().sub(half), at.clone().add(half), tone);
  }

  /** A small three-axis cross — the glyph for "a point was placed here". */
  private cross(at: THREE.Vector3, size: number, tone: number) {
    const axes: [number, number, number][] = [
      [size, 0, 0],
      [0, size, 0],
      [0, 0, size],
    ];
    for (const [x, y, z] of axes) {
      const offset = new THREE.Vector3(x, y, z);
      this.push(at.clone().sub(offset), at.clone().add(offset), tone);
    }
  }

  private span(a: THREE.Vector3, b: THREE.Vector3, camera: THREE.Camera, tone: number) {
    const tick = this.scaleHint * 0.06;
    const across = tickDirection(a, b, camera);
    this.push(a, b, tone);
    this.witness(a, across, tick, tone);
    this.witness(b, across, tick, tone);
    this.cross(a, tick * 0.3, tone);
    this.cross(b, tick * 0.3, tone);
  }

  private ring(centre: THREE.Vector3, radius: number, normal: THREE.Vector3, tone: number) {
    const basis = new THREE.Vector3(1, 0, 0);
    if (Math.abs(normal.dot(basis)) > 0.9) basis.set(0, 1, 0);
    const u = basis.clone().cross(normal).normalize().multiplyScalar(radius);

    let previous = centre.clone().add(u);
    for (let i = 1; i <= RING_STEPS; i++) {
      const point = centre
        .clone()
        .add(u.clone().applyAxisAngle(normal, (Math.PI * 2 * i) / RING_STEPS));
      this.push(previous, point, tone);
      previous = point;
    }
    // The diameter itself, drawn across the circle so the number has a line.
    this.push(centre.clone().sub(u), centre.clone().add(u), tone);
  }

  /**
   * Two arms out from the vertex and an arc between them, sized off the
   * shorter arm so a sharp corner on a small feature does not get an arc
   * larger than the feature itself.
   */
  private angle(a: THREE.Vector3, vertex: THREE.Vector3, b: THREE.Vector3, tone: number) {
    this.push(vertex, a, tone);
    this.push(vertex, b, tone);
    this.cross(vertex, this.scaleHint * 0.018, tone);

    const u = a.clone().sub(vertex);
    const v = b.clone().sub(vertex);
    const reach = Math.min(u.length(), v.length()) * 0.35;
    const normal = u.clone().cross(v);
    const sweep = u.angleTo(v);
    if (reach <= 0 || normal.lengthSq() < 1e-18 || sweep < 1e-4) return;
    normal.normalize();
    const start = u.normalize().multiplyScalar(reach);

    const steps = Math.max(6, Math.round((sweep / Math.PI) * 36));
    let previous = vertex.clone().add(start);
    for (let i = 1; i <= steps; i++) {
      const point = vertex.clone().add(start.clone().applyAxisAngle(normal, (sweep * i) / steps));
      this.push(previous, point, tone);
      previous = point;
    }
  }

  /** The floating marker that tracks whatever feature the cursor has snapped to. */
  private cursor(snap: Snap, camera: THREE.Camera) {
    const size = this.scaleHint * (snap.kind === 'surface' ? 0.022 : 0.036);
    const at = snap.point;

    if (snap.kind === 'surface') {
      this.cross(at, size, TONE.cursor);
      return;
    }

    // Anything snapped gets a diamond standing square to the view, so a locked
    // corner never looks like a loose point on a face.
    const forward = camera.getWorldPosition(new THREE.Vector3()).sub(at).normalize();
    const right = new THREE.Vector3(0, 1, 0).cross(forward);
    if (right.lengthSq() < 1e-9) right.set(1, 0, 0);
    right.normalize().multiplyScalar(size);
    const up = forward.clone().cross(right).normalize().multiplyScalar(size);

    const north = at.clone().add(up);
    const east = at.clone().add(right);
    const south = at.clone().sub(up);
    const west = at.clone().sub(right);
    this.push(north, east, TONE.cursor);
    this.push(east, south, TONE.cursor);
    this.push(south, west, TONE.cursor);
    this.push(west, north, TONE.cursor);
  }

  /* ---------------------------------------------------------------- build */

  /**
   * Rebuilds the overlay for the current view. `pending` is the run of points
   * already clicked for a measurement that is not finished yet.
   */
  update(
    camera: THREE.Camera,
    measurements: Measurement[],
    pending: THREE.Vector3[],
    snap: Snap | null,
  ) {
    const view = camera.getWorldPosition(new THREE.Vector3());
    if (!this.dirty && view.distanceToSquared(this.lastView) < 1e-8) return;
    this.lastView.copy(view);
    this.dirty = false;

    this.positions = [];
    this.colours = [];

    for (const measurement of measurements) {
      const points = measurement.points.map((p) => new THREE.Vector3(...p.world));
      if (measurement.tool === 'distance' && points.length === 2) {
        this.span(points[0], points[1], camera, TONE.solid);
        continue;
      }
      if (measurement.tool === 'diameter' && points.length === 3) {
        const circle = circleThrough(points[0], points[1], points[2]);
        if (!circle) continue;
        const normal = points[1]
          .clone()
          .sub(points[0])
          .cross(points[2].clone().sub(points[0]))
          .normalize();
        this.ring(circle.centre, circle.radius, normal, TONE.solid);
        this.cross(circle.centre, this.scaleHint * 0.018, TONE.solid);
        continue;
      }
      if (measurement.tool === 'angle' && points.length === 3) {
        this.angle(points[0], points[1], points[2], TONE.solid);
      }
    }

    // Points already dropped for the measurement in progress.
    for (let i = 0; i < pending.length; i++) {
      this.cross(pending[i], this.scaleHint * 0.022, TONE.pending);
      if (i > 0) this.push(pending[i - 1], pending[i], TONE.pending);
    }
    // …and the rubber band out to wherever the cursor currently sits.
    if (pending.length && snap) {
      this.push(pending[pending.length - 1], snap.point, TONE.pending);
    }

    if (snap) this.cursor(snap, camera);

    const geometry = new LineSegmentsGeometry();
    if (this.positions.length) {
      geometry.setPositions(new Float32Array(this.positions));
      geometry.setColors(new Float32Array(this.colours));
    }
    this.lines.geometry.dispose();
    this.lines.geometry = geometry;
    this.lines.visible = this.positions.length > 0;
  }

  clear() {
    this.positions = [];
    this.colours = [];
    this.lines.visible = false;
    this.dirty = true;
  }

  dispose() {
    this.lines.geometry.dispose();
    this.material.dispose();
  }
}

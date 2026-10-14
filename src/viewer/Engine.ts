import * as THREE from 'three';
import { disposeObject } from './analyze';
import { setActiveRenderer } from './renderer-registry';
import { CANONICAL, Stage, type PlateSpec, type ThemeName } from './Stage';
import { Annotations } from './Annotations';
import { Bracket } from './Bracket';
import { CameraRig, VIEW_DIRECTIONS } from './CameraRig';
import { Section } from './Section';
import { Explode } from './Explode';
import { angleAt, circleThrough, snapToFeature, type Snap } from './measure';
import { capColour, filamentMaterial, overhangMaterial, wireMaterial, type OverhangMaterial } from './materials';
import { meshTriangles } from './triangles';
import { analyse, overhangArea, OVERHANG_DEFAULT, type Vec3 } from './printability';
import { nearestRestingFace, restingFaces, type RestingFace } from './orient';
import { fitOnBed, niceStep } from '@/lib/printers';
import type {
  ClipState,
  Dimensions,
  MeasurePoint,
  Measurement,
  MeasureTool,
  MeasuringTool,
  PartInfo,
  Printability,
  Projection,
  RenderMode,
  ViewPreset,
} from '@/types';

/**
 * The 3D viewport. No React in here: the Engine owns the renderer, the camera,
 * the model and every tool that touches them, and reports back through a small
 * set of hooks. The store is the only thing that calls it.
 *
 * The scene graph a model is mounted into:
 *
 *   modelGroup
 *     holder   uniform scale to the canonical size, and the seat on the plate
 *       pivot  orientation — what "lay on face" and auto-orient rotate
 *         the loaded object, untouched
 *
 * Keeping the three jobs on three nodes means a reorientation never fights the
 * framing and neither of them ever edits the file's own transforms.
 */

const EDGE_BUDGET = 350_000;
/** Above this many parts, hover picking costs more than it tells you. */
const HOVER_LIMIT = 6000;
/** Printability checks stop here; past it they would hold the tab for seconds. */
const ANALYSIS_LIMIT = 2_500_000;
/** The open-edge check needs a hash entry per edge, so it stops sooner. */
const EDGE_CHECK_LIMIT = 1_200_000;
/** Part labels past this many are noise, not information. */
const LABEL_LIMIT = 40;

export interface SelectionInfo {
  id: number;
  name: string;
  type: string;
  triangles: number;
  vertices: number;
}

export interface FrameInfo {
  fps: number;
  /** Renderer scale, 1 when running at full device resolution. */
  quality: number;
}

/** Screen position for one floating tag, in CSS pixels. */
export interface LabelAnchor {
  id: number;
  x: number;
  y: number;
  behind: boolean;
}

export interface PartLabel extends LabelAnchor {
  name: string;
}

export interface PlateInfo {
  /** Grid spacing in millimetres, or null with no model on the plate. */
  cellMm: number | null;
  /** Null without a printer chosen. */
  fits: boolean | null;
}

export interface EngineHooks {
  onSelect(info: SelectionInfo | null): void;
  onHover(name: string | null): void;
  onFrame(info: FrameInfo): void;
  onMeasure(measurements: Measurement[], pending: number): void;
  /** A finished set of points that does not describe anything measurable. */
  onMeasureRejected(reason: string): void;
  onContextChange(lost: boolean): void;
  /** The model was reoriented, so its bounds along each axis changed. */
  onTransform(dimensions: Dimensions): void;
  /** Visibility changed in the object list. */
  onParts(parts: PartInfo[]): void;
}

const NO_HOOKS: EngineHooks = {
  onSelect() {},
  onHover() {},
  onFrame() {},
  onMeasure() {},
  onMeasureRejected() {},
  onContextChange() {},
  onTransform() {},
  onParts() {},
};

/** How many points each tool needs before it produces a measurement. */
const POINTS_NEEDED: Record<MeasuringTool, number> = {
  distance: 2,
  diameter: 3,
  angle: 3,
};

/**
 * Why a completed set of points produced nothing. Silence would leave a person
 * clicking three times and watching the tool reset with no idea what it wanted.
 */
const REJECTION: Record<MeasuringTool, string> = {
  distance: 'Both points landed in the same spot, so there is no distance between them.',
  diameter:
    'Those three points sit in a straight line, so no circle passes through them. Spread them around the arc.',
  angle:
    'Two of those points landed in the same spot, so one arm has no direction. Click an arm, then the corner, then the other arm.',
};

/** Points closer together than this are the same point as far as a tool cares. */
const COINCIDENT = 1e-7;
const DOWN = new THREE.Vector3(0, -1, 0);
const noRaycast = () => {};

const isHelper = (node: THREE.Object3D) => Boolean(node.userData.caliperHelper);

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();

  private readonly canvas: HTMLCanvasElement;
  private readonly hooks: EngineHooks;
  private readonly rig: CameraRig;

  private readonly modelGroup = new THREE.Group();
  private readonly stage: Stage;
  private readonly annotations = new Annotations();
  private readonly section = new Section();
  private readonly explode = new Explode();

  private holder: THREE.Group | null = null;
  private pivot: THREE.Group | null = null;
  /** World units per file unit. Fixed at load so the plate never jumps. */
  private unitScale = 1;
  private parts: THREE.Object3D[] = [];
  private meshes: THREE.Mesh[] = [];
  private triangleCounts = new Map<number, number>();
  private authored = false;
  private restCache: RestingFace[] | null = null;

  private selectionMark!: Bracket;
  private hoverMark!: Bracket;
  private layMark!: THREE.Mesh;
  private selectedNode: THREE.Object3D | null = null;

  /* --- appearance -------------------------------------------------------- */
  private renderMode: RenderMode = 'shaded';
  private filament = '#00ae42';
  private paintAuthored = false;
  private overhangOn = false;
  private overhangDeg = OVERHANG_DEFAULT;
  private readonly wire: THREE.MeshBasicMaterial;
  private readonly solid: THREE.MeshStandardMaterial;
  private readonly overhang: OverhangMaterial;
  /** Shared by every outline in the overlay, so clearEdges owns disposing it. */
  private readonly edgeMaterial: THREE.LineBasicMaterial;
  private edgeLines: THREE.LineSegments[] = [];
  private edgesComplete = true;
  private theme: ThemeName = 'dark';

  /* --- plate ------------------------------------------------------------- */
  private gridWanted = true;
  private bed: [number, number, number] | null = null;
  private mmPerUnit = 1;
  private plate: PlateInfo = { cellMm: null, fits: null };

  /* --- section ----------------------------------------------------------- */
  private clip: ClipState | null = null;

  /* --- labels ------------------------------------------------------------ */
  private labelSink: ((anchors: LabelAnchor[]) => void) | null = null;
  private partSink: ((labels: PartLabel[]) => void) | null = null;
  private partLabelsOn = false;
  private partCentres: { id: number; name: string; centre: THREE.Vector3 }[] | null = null;

  /* --- measuring --------------------------------------------------------- */
  private tool: MeasureTool = 'off';
  private measurements: Measurement[] = [];
  private pending: THREE.Vector3[] = [];
  private snap: Snap | null = null;
  private measureSeq = 0;

  /* --- loop -------------------------------------------------------------- */
  private raf = 0;
  private needsRender = true;
  private rendered = 0;
  private lastSample = performance.now();
  private readonly clock = new THREE.Clock();
  private disposed = false;
  private contextLost = false;
  private paused = false;
  private quality = 1;
  private slowSamples = 0;
  private fastSamples = 0;
  private lastMotion = 0;
  private readonly maxPixelRatio = Math.min(window.devicePixelRatio, 2);

  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private pointerDown: { x: number; y: number } | null = null;
  private hoverQueued = false;

  constructor(canvas: HTMLCanvasElement, hooks: Partial<EngineHooks> = {}) {
    this.canvas = canvas;
    this.hooks = { ...NO_HOOKS, ...hooks };

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      // The section cap is drawn through the stencil buffer.
      stencil: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.maxPixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos PBR Neutral keeps a material's base colour where ACES would
    // wash it toward pastel: a part in Bambu green should read as that green.
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.localClippingEnabled = true;

    this.rig = new CameraRig(canvas);
    setActiveRenderer(this.renderer);

    this.stage = new Stage(this.scene, this.renderer);
    const skin = this.stage.skin;
    this.wire = wireMaterial(skin.wire);
    this.solid = filamentMaterial(this.filament);
    this.overhang = overhangMaterial(this.filament, this.overhangDeg, skin.over);
    this.edgeMaterial = new THREE.LineBasicMaterial({
      color: skin.edgeInk,
      transparent: true,
      opacity: skin.edgeOpacity,
    });

    this.scene.add(
      this.modelGroup,
      this.stage.group,
      this.section.group,
      this.annotations.group,
    );
    this.buildMarkers();
    this.bindPointer();
    this.bindContextLoss();

    this.animate = this.animate.bind(this);
    this.raf = requestAnimationFrame(this.animate);
  }

  /* ------------------------------------------------------------ setup ---- */

  private get camera() {
    return this.rig.camera;
  }

  private buildMarkers() {
    const skin = this.stage.skin;
    this.selectionMark = new Bracket(skin.select, 1);
    this.hoverMark = new Bracket(skin.select, 0.45);
    this.annotations.setColour(skin.mark);

    // The "lay on face" target: a disc lying on whatever face is under the
    // cursor, so it is obvious which way down the part is about to go.
    this.layMark = new THREE.Mesh(
      new THREE.CircleGeometry(1, 48),
      new THREE.MeshBasicMaterial({
        color: skin.select,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
      }),
    );
    this.layMark.visible = false;
    this.layMark.renderOrder = 5;
    this.layMark.raycast = noRaycast;

    this.scene.add(this.selectionMark.group, this.hoverMark.group, this.layMark);
  }

  private bindContextLoss() {
    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.contextLost = true;
      this.hooks.onContextChange(true);
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.contextLost = false;
      this.renderer.resetState();
      this.resize();
      this.invalidate();
      this.hooks.onContextChange(false);
    });
  }

  private bindPointer() {
    this.canvas.addEventListener('pointerdown', (event) => {
      this.pointerDown = { x: event.clientX, y: event.clientY };
    });

    this.canvas.addEventListener('pointerup', (event) => {
      if (!this.pointerDown) return;
      const moved = Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y);
      this.pointerDown = null;
      if (moved > 5) return; // an orbit, not a click
      if (this.tool === 'off') this.pick(event);
      else if (this.tool === 'lay') this.layAt(event);
      else this.placePoint(event);
    });

    this.canvas.addEventListener('pointermove', (event) => {
      if (this.hoverQueued) return;
      this.hoverQueued = true;
      requestAnimationFrame(() => {
        this.hoverQueued = false;
        if (this.tool === 'off') this.trackHover(event);
        else if (this.tool === 'lay') this.trackLay(event);
        else this.trackSnap(event);
      });
    });

    this.canvas.addEventListener('pointerleave', () => {
      if (this.snap) {
        this.snap = null;
        this.annotations.invalidate();
        this.invalidate();
      }
      if (this.layMark.visible) {
        this.layMark.visible = false;
        this.invalidate();
      }
      this.setHover(null);
    });
  }

  /* ------------------------------------------------------------- loop ---- */

  /** Ask for one more frame. Everything that changes the picture calls this. */
  invalidate() {
    this.needsRender = true;
  }

  /**
   * Held while a modal overlay covers the viewport. Drawing behind a dialog
   * costs a full frame each time and nobody can see it.
   */
  setPaused(paused: boolean) {
    this.paused = paused;
    if (!paused) this.invalidate();
  }

  private animate() {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    if (this.contextLost || this.paused) return;

    if (this.rig.update(this.clock.getDelta())) {
      this.needsRender = true;
      this.lastMotion = performance.now();
    }

    this.sample();
    if (!this.needsRender) return;
    this.needsRender = false;
    this.renderFrame();
    this.rendered++;
  }

  private renderFrame() {
    if (this.tool !== 'off' || this.measurements.length || this.pending.length) {
      this.annotations.update(this.camera, this.measurements, this.pending, this.snap);
    }
    this.renderer.render(this.scene, this.camera);
    this.publishLabels();
    this.publishPartLabels();
  }

  /**
   * Frame timing, and the quality governor that rides on it. A model that drops
   * below 30 fps gets rendered at a lower device scale rather than staying
   * beautiful and unusable; it climbs back the moment there is headroom.
   */
  private sample() {
    const now = performance.now();
    const elapsed = now - this.lastSample;
    if (elapsed < 500) return;

    const fps = Math.round((this.rendered * 1000) / elapsed);
    // Only judge performance while the camera is actually moving. A viewer
    // sitting still renders nothing and would otherwise read as 0 fps and get
    // its resolution cut for standing there quietly.
    const busy = this.rendered > 0 && now - this.lastMotion < 1200;

    if (busy && fps < 30 && this.quality > 0.55) {
      if (++this.slowSamples >= 2) {
        this.slowSamples = 0;
        this.setQuality(this.quality - 0.2);
      }
    } else if (busy && fps > 55 && this.quality < 1) {
      if (++this.fastSamples >= 4) {
        this.fastSamples = 0;
        this.setQuality(this.quality + 0.2);
      }
    } else {
      this.slowSamples = 0;
      this.fastSamples = 0;
    }

    this.hooks.onFrame({ fps: this.rendered ? fps : 0, quality: this.quality });
    this.rendered = 0;
    this.lastSample = now;
  }

  private setQuality(value: number) {
    this.quality = THREE.MathUtils.clamp(Number(value.toFixed(2)), 0.5, 1);
    this.renderer.setPixelRatio(this.maxPixelRatio * this.quality);
    this.resize();
  }

  /* ------------------------------------------------------------ model ---- */

  setModel(object: THREE.Object3D, hasAuthoredMaterials: boolean) {
    this.clearModel();

    const pivot = new THREE.Group();
    pivot.name = '__caliper_pivot';
    pivot.add(object);
    const holder = new THREE.Group();
    holder.name = '__caliper_holder';
    holder.add(pivot);
    this.holder = holder;
    this.pivot = pivot;
    this.authored = hasAuthoredMaterials;
    this.modelGroup.add(holder);

    // Scale once, from the file's own bounds, and never again: a reorient that
    // rescaled would make the plate's grid jump under the part.
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot, true);
    const size = box.getSize(new THREE.Vector3());
    this.unitScale = CANONICAL / (size.length() || 1);
    holder.scale.setScalar(this.unitScale);
    this.seat();

    this.annotations.setScaleHint(CANONICAL / 2);
    this.collectParts(object);

    const castShadows = this.stage.shadowsEnabled;
    for (const mesh of this.meshes) {
      // Honour the shadow toggle the person already set, rather than forcing
      // shadows back on with every file they open.
      mesh.castShadow = castShadows;
      mesh.receiveShadow = castShadows;
      if (!mesh.geometry.getAttribute('normal')) mesh.geometry.computeVertexNormals();
      mesh.userData.caliperBase = mesh.material;
    }
    this.paintFilament();

    this.section.attach(this.meshes);
    this.explode.prepare(pivot, this.parts);
    this.applyRenderMode();
    this.applyClip();
    this.syncPlate();
    this.frameAll(true);
  }

  /** Every drawable node in the file, in file order. Helpers are skipped. */
  private collectParts(object: THREE.Object3D) {
    this.parts = [];
    this.meshes = [];
    this.triangleCounts.clear();
    object.traverse((node) => {
      if (isHelper(node)) return;
      const mesh = node as THREE.Mesh;
      const points = node as THREE.Points;
      if (!mesh.isMesh && !points.isPoints) return;
      this.parts.push(node);
      const geometry = mesh.geometry as THREE.BufferGeometry;
      const position = geometry?.getAttribute('position');
      const index = geometry?.getIndex();
      const triangles = mesh.isMesh && position ? Math.round((index ? index.count : position.count) / 3) : 0;
      this.triangleCounts.set(node.id, triangles);
      if (mesh.isMesh) this.meshes.push(mesh);
    });
  }

  /**
   * Centres the model on the plate and stands it on it. Runs after every
   * reorientation, with the bounds measured precisely: an axis-aligned box of
   * a rotated box is larger than the part, and the part would float. The
   * explode slider re-seats at drag rate, so it asks for the quick bounds.
   */
  private seat(precise = true) {
    const holder = this.holder;
    const pivot = this.pivot;
    if (!holder || !pivot) return;
    holder.position.set(0, 0, 0);
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(pivot, precise);
    const centre = box.getCenter(new THREE.Vector3());
    holder.position.set(-centre.x, -box.min.y, -centre.z);
    holder.updateMatrixWorld(true);
  }

  clearModel() {
    this.explode.clear();
    this.section.detach();
    this.clearEdges();
    // Put each mesh's own material back first: the shared overrides outlive
    // the model and must not be disposed along with it.
    for (const mesh of this.meshes) {
      if (mesh.userData.caliperBase) mesh.material = mesh.userData.caliperBase;
    }
    for (const child of [...this.modelGroup.children]) {
      this.modelGroup.remove(child);
      disposeObject(child);
    }
    this.holder = null;
    this.pivot = null;
    this.parts = [];
    this.meshes = [];
    this.triangleCounts.clear();
    this.restCache = null;
    this.partCentres = null;
    this.unitScale = 1;
    this.selectionMark.hide();
    this.hoverMark.hide();
    this.layMark.visible = false;
    this.selectedNode = null;
    this.clearMeasurements();
    this.syncPlate();
    this.hooks.onSelect(null);
    this.hooks.onHover(null);
    this.invalidate();
  }

  /** The object the loader produced, without Caliper's framing wrappers. */
  get modelRoot(): THREE.Object3D | null {
    return this.pivot?.children[0] ?? null;
  }

  /** True when the outline pass had to stop short of drawing every edge. */
  get edgesTruncated() {
    return !this.edgesComplete;
  }

  get hoverEnabled() {
    return this.parts.length > 0 && this.parts.length <= HOVER_LIMIT;
  }

  /** The model's bounds in its current orientation, in the file's own units. */
  dimensions(): Dimensions {
    const holder = this.holder;
    const pivot = this.pivot;
    if (!holder || !pivot) return { x: 0, y: 0, z: 0, diagonal: 0, center: [0, 0, 0] };
    holder.updateMatrixWorld(true);
    const world = new THREE.Box3().setFromObject(pivot, true);
    // The holder is a uniform scale and a translation, so its inverse maps the
    // world box straight back to a box in file units.
    const inverse = holder.matrixWorld.clone().invert();
    const box = world.applyMatrix4(inverse);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    return { x: size.x, y: size.y, z: size.z, diagonal: size.length(), center: [centre.x, centre.y, centre.z] };
  }

  /* ---------------------------------------------------- printability ---- */

  /** The plate's down direction, expressed in the loaded object's own space. */
  private downInObject(): Vec3 {
    const root = this.modelRoot;
    const pivot = this.pivot;
    if (!root || !pivot) return [0, -1, 0];
    const down = DOWN.clone().applyQuaternion(pivot.quaternion.clone().invert());
    const toObject = new THREE.Matrix4().copy(root.matrix).invert();
    down.transformDirection(toObject);
    return [down.x, down.y, down.z];
  }

  /** Volume, area, closure and overhang. Null past the size limit. */
  analyse(): Printability | null {
    const root = this.modelRoot;
    if (!root) return null;
    const { source, total } = meshTriangles(root);
    if (total > ANALYSIS_LIMIT) return null;
    return analyse(source, {
      down: this.downInObject(),
      overhangDeg: this.overhangDeg,
      skipEdges: total > EDGE_CHECK_LIMIT,
    });
  }

  /** Just the overhang, which is all a reorientation or a new limit changes. */
  overhangArea(): number | null {
    const root = this.modelRoot;
    if (!root) return null;
    const { source, total } = meshTriangles(root);
    if (total > ANALYSIS_LIMIT) return null;
    return overhangArea(source, this.downInObject(), this.overhangDeg);
  }

  /* ------------------------------------------------------ orientation ---- */

  /** Resting faces in the pivot's frame, worked out once per model. */
  private restingFaces(): RestingFace[] {
    if (this.restCache) return this.restCache;
    const root = this.modelRoot;
    if (!root) return [];
    const { source, total } = meshTriangles(root, ANALYSIS_LIMIT);
    if (total > ANALYSIS_LIMIT * 2) return (this.restCache = []);
    const faces = restingFaces(source, 12);
    this.restCache = faces.map((face) => {
      const normal = new THREE.Vector3(...face.normal).transformDirection(root.matrix);
      return { area: face.area, normal: [normal.x, normal.y, normal.z] as Vec3 };
    });
    return this.restCache;
  }

  /** Turns the part so `normal` (in the pivot's own frame) points at the plate. */
  private layNormal(normal: THREE.Vector3) {
    const pivot = this.pivot;
    if (!pivot) return;
    this.explode.reset();
    pivot.quaternion.setFromUnitVectors(normal.clone().normalize(), DOWN);
    this.afterReorient();
  }

  private afterReorient() {
    this.seat();
    this.partCentres = null;
    // Points dropped on the old pose would hang in mid-air on the new one.
    this.clearMeasurements();
    if (this.selectedNode) this.selectionMark.show(this.selectedNode);
    this.applyClip();
    this.syncPlate();
    this.hooks.onTransform(this.dimensions());
    this.frameAll();
  }

  /** Bambu Studio's auto-orient, in its simplest honest form: the largest flat face goes down. */
  autoOrient(): boolean {
    const [best] = this.restingFaces();
    if (!best) return false;
    this.layNormal(new THREE.Vector3(...best.normal));
    return true;
  }

  resetOrientation() {
    const pivot = this.pivot;
    if (!pivot) return;
    this.explode.reset();
    pivot.quaternion.identity();
    this.afterReorient();
  }

  get oriented(): boolean {
    return Boolean(this.pivot && !this.pivot.quaternion.equals(new THREE.Quaternion()));
  }

  private faceUnder(event: PointerEvent): { point: THREE.Vector3; normal: THREE.Vector3 } | null {
    const hit = this.hit(event);
    if (!hit?.face) return null;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    return { point: hit.point.clone(), normal };
  }

  private trackLay(event: PointerEvent) {
    const face = this.faceUnder(event);
    if (!face) {
      if (this.layMark.visible) {
        this.layMark.visible = false;
        this.invalidate();
      }
      return;
    }
    this.layMark.visible = true;
    this.layMark.scale.setScalar(CANONICAL * 0.045);
    this.layMark.position.copy(face.point).addScaledVector(face.normal, CANONICAL * 0.002);
    this.layMark.lookAt(face.point.clone().add(face.normal));
    this.invalidate();
  }

  private layAt(event: PointerEvent) {
    const face = this.faceUnder(event);
    const pivot = this.pivot;
    if (!face || !pivot) return;
    // From world back into the pivot's own frame: undo the current rotation.
    const local = face.normal.clone().applyQuaternion(pivot.quaternion.clone().invert());
    // Snap to the hull face it belongs to, so a click on a faceted surface
    // still lands square; otherwise trust the face that was clicked.
    const snapped = nearestRestingFace(this.restingFaces(), [local.x, local.y, local.z]);
    this.layMark.visible = false;
    this.layNormal(snapped ? new THREE.Vector3(...snapped.normal) : local);
  }

  /* ------------------------------------------------------- appearance ---- */

  setRenderMode(mode: RenderMode) {
    this.renderMode = mode;
    this.applyRenderMode();
  }

  /**
   * Render modes swap the material on the model's own meshes. The obvious route
   * — scene.overrideMaterial — also repaints the plate, the grid and the
   * selection marker, which turns "show me the wireframe" into "show me
   * everything as wireframe" and loses the stage entirely.
   */
  private applyRenderMode() {
    this.clearEdges();
    if (this.renderMode === 'edges') this.buildEdges();
    this.applySurfaces();
  }

  /** The one material every mesh should wear right now, or null for its own. */
  private surfaceOverride(): THREE.Material | null {
    if (this.renderMode === 'wireframe') return this.wire;
    if (this.overhangOn) return this.overhang;
    if (this.authored && this.paintAuthored) return this.solid;
    return null;
  }

  private applySurfaces() {
    const override = this.surfaceOverride();
    for (const mesh of this.meshes) {
      mesh.material = override ?? (mesh.userData.caliperBase as THREE.Material | THREE.Material[]);
    }
    this.syncClipping();
    this.invalidate();
  }

  /**
   * Formats with no materials of their own wear the filament colour directly on
   * the material their loader made, so a texture-less STL looks printed.
   */
  private paintFilament() {
    if (this.authored) return;
    for (const mesh of this.meshes) {
      const base = mesh.userData.caliperBase as THREE.Material | THREE.Material[];
      for (const material of Array.isArray(base) ? base : [base]) {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard.isMeshStandardMaterial || standard.vertexColors) continue;
        standard.color.set(this.filament);
        standard.metalness = 0.05;
        standard.roughness = 0.55;
      }
    }
  }

  /** The filament colour, and whether it should cover a file's own colours too. */
  setFilament(colour: string, paintAuthored: boolean) {
    this.filament = colour;
    this.paintAuthored = paintAuthored;
    this.solid.color.set(colour);
    this.overhang.color.set(colour);
    this.section.setCapColour(capColour(colour, this.stage.skin.cap));
    this.paintFilament();
    this.applySurfaces();
  }

  /** Bambu Studio's "show overhang", with the limit in degrees from vertical. */
  setOverhang(enabled: boolean, degrees = this.overhangDeg) {
    this.overhangOn = enabled;
    this.overhangDeg = degrees;
    this.overhang.setThreshold(degrees);
    this.applySurfaces();
  }

  private buildEdges() {
    let budget = EDGE_BUDGET;
    this.edgesComplete = true;
    for (const mesh of this.meshes) {
      const index = mesh.geometry.getIndex();
      const position = mesh.geometry.getAttribute('position');
      if (!position) continue;
      budget -= (index ? index.count : position.count) / 3;
      if (budget <= 0) {
        this.edgesComplete = false;
        break;
      }
      // A child of the mesh, so it follows every explode and reorientation.
      const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 32), this.edgeMaterial);
      lines.userData.caliperHelper = true;
      lines.raycast = noRaycast;
      mesh.add(lines);
      this.edgeLines.push(lines);
    }
  }

  private clearEdges() {
    for (const lines of this.edgeLines) {
      lines.parent?.remove(lines);
      lines.geometry.dispose();
    }
    this.edgeLines = [];
    this.edgesComplete = true;
  }

  setGridVisible(visible: boolean) {
    this.gridWanted = visible;
    this.stage.setGridVisible(visible);
    this.invalidate();
  }

  setShadowsEnabled(enabled: boolean) {
    this.renderer.shadowMap.enabled = enabled;
    this.stage.setShadowsEnabled(enabled);
    for (const mesh of this.meshes) {
      mesh.castShadow = enabled;
      mesh.receiveShadow = enabled;
    }
    this.renderer.shadowMap.needsUpdate = true;
    // Shadow maps are part of the program key, so materials must recompile.
    for (const mesh of this.meshes) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((m) => (m.needsUpdate = true));
    }
    this.invalidate();
  }

  setTheme(theme: ThemeName) {
    this.theme = theme;
    this.stage.setTheme(theme);
    const skin = this.stage.skin;

    this.selectionMark.setColour(skin.select);
    this.hoverMark.setColour(skin.select);
    (this.layMark.material as THREE.MeshBasicMaterial).color.setHex(skin.select);
    this.annotations.setColour(skin.mark);
    this.wire.color.setHex(skin.wire);
    this.overhang.setOverhangColour(skin.over);
    this.edgeMaterial.color.setHex(skin.edgeInk);
    this.edgeMaterial.opacity = skin.edgeOpacity;
    this.section.setCapColour(capColour(this.filament, skin.cap));
    this.invalidate();
  }

  get themeName() {
    return this.theme;
  }

  /* ------------------------------------------------------------ plate ---- */

  /**
   * Chooses the plate: a printer's bed at true size (millimetres), or `null`
   * for a plate sized to the model. `mmPerUnit` says how big one of the file's
   * units is, which is the only way a bed in millimetres can be laid under a
   * file whose numbers mean metres.
   */
  setPlate(bed: [number, number, number] | null, mmPerUnit: number): PlateInfo {
    this.bed = bed;
    this.mmPerUnit = mmPerUnit > 0 ? mmPerUnit : 1;
    this.syncPlate();
    return this.plate;
  }

  get plateInfo(): PlateInfo {
    return this.plate;
  }

  private syncPlate() {
    if (!this.holder) {
      this.stage.setPlate({ width: CANONICAL * 3, depth: CANONICAL * 3, cell: 1, height: null, fits: true });
      this.stage.setGridVisible(this.gridWanted);
      this.plate = { cellMm: null, fits: null };
      this.invalidate();
      return;
    }

    const worldPerMm = this.unitScale / this.mmPerUnit;
    let spec: PlateSpec;
    let fits: boolean | null = null;
    let cellMm: number;

    if (this.bed) {
      const d = this.dimensions();
      fits = fitOnBed([d.x * this.mmPerUnit, d.y * this.mmPerUnit, d.z * this.mmPerUnit], this.bed).fits;
      cellMm = 10;
      spec = {
        width: this.bed[0] * worldPerMm,
        depth: this.bed[1] * worldPerMm,
        height: this.bed[2] * worldPerMm,
        cell: cellMm * worldPerMm,
        fits,
      };
    } else {
      const size = CANONICAL * 3;
      cellMm = niceStep(size / worldPerMm, 24);
      spec = { width: size, depth: size, height: null, cell: cellMm * worldPerMm, fits: true };
    }

    this.stage.setPlate(spec);
    this.stage.setGridVisible(this.gridWanted);
    this.plate = { cellMm, fits };
    this.invalidate();
  }

  /* ---------------------------------------------------------- section ---- */

  /** One cutting plane through the model, or `null` to put it back together. */
  setClip(state: ClipState | null) {
    this.clip = state;
    this.applyClip();
  }

  private applyClip() {
    const pivot = this.pivot;
    const box = pivot ? new THREE.Box3().setFromObject(pivot) : new THREE.Box3();
    this.section.set(this.clip, box);
    this.syncClipping();
    this.invalidate();
  }

  /** Pushes the current planes onto every material the model can be wearing. */
  private syncClipping() {
    const planes = this.section.planes;
    const value = planes.length ? planes : null;
    const touch = (material: THREE.Material) => {
      material.clippingPlanes = value;
      material.clipShadows = true;
    };
    for (const mesh of this.meshes) {
      const base = mesh.userData.caliperBase as THREE.Material | THREE.Material[];
      (Array.isArray(base) ? base : [base]).forEach(touch);
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(touch);
    }
    for (const part of this.parts) {
      const points = part as THREE.Points;
      if (points.isPoints) (Array.isArray(points.material) ? points.material : [points.material]).forEach(touch);
    }
    [this.wire, this.solid, this.overhang, this.edgeMaterial].forEach(touch);
  }

  /** True when a world point is on the side of the plane that was cut away. */
  private clipped(point: THREE.Vector3): boolean {
    return this.section.enabled && this.section.plane.distanceToPoint(point) < 0;
  }

  /* ---------------------------------------------------------- explode ---- */

  get canExplode() {
    return this.explode.available;
  }

  setExplode(ratio: number) {
    this.explode.apply(ratio);
    // Parts below the centre move down; lift the whole assembly so the lowest
    // one still stands on the plate instead of sinking through it.
    this.seat(this.explode.value === 1);
    this.partCentres = null;
    this.annotations.invalidate();
    if (this.selectedNode) this.selectionMark.show(this.selectedNode);
    this.applyClip();
    this.invalidate();
  }

  /* ------------------------------------------------------------ parts ---- */

  partList(): PartInfo[] {
    return this.parts.map((node, i) => ({
      id: node.id,
      name: node.name || `Part ${i + 1}`,
      triangles: this.triangleCounts.get(node.id) ?? 0,
      visible: node.visible,
    }));
  }

  private afterVisibility() {
    if (this.selectedNode && !this.shown(this.selectedNode)) this.select(null);
    this.hoverMark.hide();
    this.partCentres = null;
    this.hooks.onParts(this.partList());
    this.invalidate();
  }

  setPartVisible(id: number, visible: boolean) {
    const node = this.parts.find((part) => part.id === id);
    if (!node) return;
    node.visible = visible;
    this.afterVisibility();
  }

  /** Shows only one part, or every part again with `null`. */
  isolate(id: number | null) {
    for (const part of this.parts) part.visible = id === null || part.id === id;
    this.afterVisibility();
  }

  /* ----------------------------------------------------------- labels ---- */

  setLabelSink(sink: ((anchors: LabelAnchor[]) => void) | null) {
    this.labelSink = sink;
  }

  setPartLabelSink(sink: ((labels: PartLabel[]) => void) | null) {
    this.partSink = sink;
  }

  /** Bambu Studio's "show labels": part names floating over the parts. */
  setPartLabels(enabled: boolean) {
    this.partLabelsOn = enabled;
    if (!enabled) this.partSink?.([]);
    this.invalidate();
  }

  private publishPartLabels() {
    if (!this.partSink || !this.partLabelsOn) return;
    if (!this.partCentres) {
      // The largest visible parts get names; a hundred tags is a screen of text.
      const visible = this.parts
        .map((node, i) => ({ node, i }))
        .filter(({ node }) => this.shown(node))
        .sort((a, b) => (this.triangleCounts.get(b.node.id) ?? 0) - (this.triangleCounts.get(a.node.id) ?? 0))
        .slice(0, LABEL_LIMIT);
      this.partCentres = visible.map(({ node, i }) => ({
        id: node.id,
        name: node.name || `Part ${i + 1}`,
        centre: new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()),
      }));
    }

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const at = new THREE.Vector3();
    this.partSink(
      this.partCentres.map(({ id, name, centre }) => {
        at.copy(centre).project(this.camera);
        return {
          id,
          name,
          x: (at.x * 0.5 + 0.5) * width,
          y: (-at.y * 0.5 + 0.5) * height,
          behind: at.z > 1 || this.clipped(centre),
        };
      }),
    );
  }

  /* ----------------------------------------------------------- camera ---- */

  setProjection(mode: Projection) {
    this.rig.setProjection(mode);
    this.annotations.invalidate();
    this.invalidate();
  }

  get projection(): Projection {
    return this.rig.projection;
  }

  /** Optional controls for embedding: the landing page turns zoom off. */
  configureControls(options: { zoom?: boolean; autoRotate?: number }) {
    const controls = this.rig.controls;
    if (options.zoom !== undefined) controls.enableZoom = options.zoom;
    if (options.autoRotate !== undefined) {
      controls.autoRotate = options.autoRotate !== 0;
      controls.autoRotateSpeed = options.autoRotate;
    }
    this.invalidate();
  }

  private boundsOf(target?: THREE.Object3D): THREE.Box3 {
    const source = target ?? (this.modelGroup.children.length ? this.modelGroup : this.stage.group);
    return new THREE.Box3().setFromObject(source);
  }

  frameAll(instant = false) {
    this.rig.frame(this.boundsOf(), instant ? new THREE.Vector3(...VIEW_DIRECTIONS.iso) : undefined);
    this.annotations.invalidate();
    this.invalidate();
  }

  /** Zoom to the selected part — the move a person reaches for constantly. */
  frameSelection(id: number) {
    const node = this.scene.getObjectById(id);
    if (node) this.rig.frame(this.boundsOf(node));
    this.invalidate();
  }

  setView(preset: ViewPreset) {
    const direction = new THREE.Vector3(...VIEW_DIRECTIONS[preset]);
    // Bambu Studio's 0 shows the whole plate; everywhere else frames the part.
    const box = preset === 'default' && this.bed ? this.stage.plateBox : this.boundsOf();
    this.rig.frame(box, direction);
    this.annotations.invalidate();
    this.invalidate();
  }

  /**
   * The camera's world rotation. The orientation gizmo needs it to project the
   * world axes into its own little viewport, which is the only way that widget
   * can tell you which way you are actually facing.
   */
  viewQuaternion(target = new THREE.Quaternion()): THREE.Quaternion {
    return this.camera.getWorldQuaternion(target);
  }

  /* -------------------------------------------------------- selection ---- */

  /** Visible all the way up — a part inside a hidden part is hidden too. */
  private shown(node: THREE.Object3D): boolean {
    for (let n: THREE.Object3D | null = node; n && n !== this.modelGroup; n = n.parent) {
      if (!n.visible) return false;
    }
    return true;
  }

  private rayFrom(event: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return { rect, cursor: { x: event.clientX - rect.left, y: event.clientY - rect.top } };
  }

  private nearestHit(): THREE.Intersection | null {
    const hits = this.raycaster.intersectObjects(this.modelGroup.children, true);
    return hits.find((candidate) => this.shown(candidate.object) && !this.clipped(candidate.point)) ?? null;
  }

  private hit(event: PointerEvent): THREE.Intersection | null {
    this.rayFrom(event);
    return this.nearestHit();
  }

  private pick(event: PointerEvent) {
    const hit = this.hit(event);
    this.select(hit ? hit.object : null);
  }

  private trackHover(event: PointerEvent) {
    if (!this.hoverEnabled) return;
    const hit = this.hit(event);
    this.setHover(hit ? hit.object : null);
  }

  private setHover(node: THREE.Object3D | null) {
    if (!node) {
      if (this.hoverMark.visible) {
        this.hoverMark.hide();
        this.hooks.onHover(null);
        this.invalidate();
      }
      return;
    }
    // Hovering the part you already have selected adds nothing but noise.
    if (node === this.selectedNode) {
      this.hoverMark.hide();
      this.hooks.onHover(null);
      return;
    }
    this.hoverMark.show(node);
    this.hooks.onHover(node.name || node.type);
    this.invalidate();
  }

  select(target: THREE.Object3D | number | null) {
    const node = typeof target === 'number' ? (this.scene.getObjectById(target) ?? null) : target;

    this.selectedNode = node;
    if (!node) {
      this.selectionMark.hide();
      this.hooks.onSelect(null);
      this.invalidate();
      return;
    }

    this.selectionMark.show(node);
    this.invalidate();

    const mesh = node as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const position = geometry?.getAttribute?.('position');
    const index = geometry?.getIndex?.();

    this.hooks.onSelect({
      id: node.id,
      name: node.name || node.type,
      type: node.type,
      triangles: position ? Math.round((index ? index.count : position.count) / 3) : 0,
      vertices: position?.count ?? 0,
    });
  }

  /* ------------------------------------------------------- measuring ---- */

  setMeasureTool(tool: MeasureTool) {
    this.tool = tool;
    this.pending = [];
    this.snap = null;
    this.layMark.visible = false;
    if (tool !== 'off') this.setHover(null);
    this.annotations.invalidate();
    this.hooks.onMeasure(this.measurements, 0);
    this.invalidate();
  }

  get measureTool() {
    return this.tool;
  }

  private trackSnap(event: PointerEvent) {
    const { cursor, rect } = this.rayFrom(event);
    const hit = this.nearestHit();
    this.snap = hit ? snapToFeature(hit, this.camera, cursor, rect.width, rect.height) : null;
    this.annotations.invalidate();
    this.invalidate();
  }

  private placePoint(event: PointerEvent) {
    this.trackSnap(event);
    if (!this.snap || this.tool === 'off' || this.tool === 'lay') return;

    this.pending.push(this.snap.point.clone());
    const tool = this.tool;
    if (this.pending.length < POINTS_NEEDED[tool]) {
      this.hooks.onMeasure(this.measurements, this.pending.length);
      this.annotations.invalidate();
      this.invalidate();
      return;
    }

    const measurement = this.buildMeasurement(tool, this.pending, this.snap.kind);
    this.pending = [];
    if (measurement) this.measurements = [...this.measurements, measurement];
    else this.hooks.onMeasureRejected(REJECTION[tool]);
    this.hooks.onMeasure(this.measurements, 0);
    this.annotations.invalidate();
    this.invalidate();
  }

  /**
   * World space is the canonical 8-unit stage; the file's own numbers are what
   * a person came here for. Both are kept — one to draw with, one to read. The
   * holder is a scale and a translation, so its local space is file units in
   * the part's current orientation.
   */
  private toModel(world: THREE.Vector3): THREE.Vector3 {
    if (!this.holder) return world.clone();
    return this.holder.worldToLocal(world.clone());
  }

  private buildMeasurement(
    tool: MeasuringTool,
    world: THREE.Vector3[],
    lastKind: MeasurePoint['kind'] = 'surface',
  ): Measurement | null {
    const model = world.map((point) => this.toModel(point));
    const points: MeasurePoint[] = world.map((point, i) => ({
      world: [point.x, point.y, point.z],
      model: [model[i].x, model[i].y, model[i].z],
      kind: lastKind,
    }));

    const id = ++this.measureSeq;
    if (tool === 'distance') {
      const delta = model[1].clone().sub(model[0]);
      if (delta.lengthSq() < COINCIDENT) return null;
      return {
        id,
        tool,
        points,
        value: delta.length(),
        delta: [Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z)],
      };
    }

    if (tool === 'angle') {
      const degrees = angleAt(model[0], model[1], model[2]);
      if (degrees === null) return null;
      return { id, tool, points, value: degrees };
    }

    const circle = circleThrough(model[0], model[1], model[2]);
    if (!circle) return null;
    return { id, tool, points, value: circle.radius * 2 };
  }

  /**
   * Places a measurement from points in the file's own units, without clicks.
   * The landing page uses it to show a real dimension on its demo part.
   */
  addMeasurement(tool: MeasuringTool, modelPoints: [number, number, number][]): Measurement | null {
    if (!this.holder || modelPoints.length !== POINTS_NEEDED[tool]) return null;
    const world = modelPoints.map((p) => this.holder!.localToWorld(new THREE.Vector3(...p)));
    const measurement = this.buildMeasurement(tool, world, 'vertex');
    if (!measurement) return null;
    this.measurements = [...this.measurements, measurement];
    this.hooks.onMeasure(this.measurements, this.pending.length);
    this.annotations.invalidate();
    this.invalidate();
    return measurement;
  }

  undoMeasurePoint() {
    if (this.pending.length) this.pending.pop();
    else this.measurements = this.measurements.slice(0, -1);
    this.hooks.onMeasure(this.measurements, this.pending.length);
    this.annotations.invalidate();
    this.invalidate();
  }

  removeMeasurement(id: number) {
    this.measurements = this.measurements.filter((m) => m.id !== id);
    this.hooks.onMeasure(this.measurements, this.pending.length);
    this.annotations.invalidate();
    this.invalidate();
  }

  clearMeasurements() {
    this.measurements = [];
    this.pending = [];
    this.snap = null;
    this.annotations.clear();
    this.hooks.onMeasure([], 0);
    this.invalidate();
  }

  /** Projects each measurement's tag position into CSS pixels for the overlay. */
  private publishLabels() {
    if (!this.labelSink) return;
    if (!this.measurements.length) {
      this.labelSink([]);
      return;
    }

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    const anchor = new THREE.Vector3();

    const anchors = this.measurements.map((measurement) => {
      const points = measurement.points.map((p) => new THREE.Vector3(...p.world));
      if (measurement.tool === 'distance') {
        anchor.copy(points[0]).add(points[1]).multiplyScalar(0.5);
      } else if (measurement.tool === 'angle') {
        // Out along the bisector, just past the arc.
        const [a, vertex, b] = points;
        const u = a.clone().sub(vertex);
        const v = b.clone().sub(vertex);
        const reach = Math.min(u.length(), v.length()) * 0.55;
        const bisector = u.normalize().add(v.normalize());
        if (bisector.lengthSq() < 1e-12) bisector.copy(u);
        anchor.copy(vertex).addScaledVector(bisector.normalize(), reach);
      } else {
        anchor.copy(circleThrough(points[0], points[1], points[2])?.centre ?? points[0]);
      }

      anchor.project(this.camera);
      return {
        id: measurement.id,
        x: (anchor.x * 0.5 + 0.5) * width,
        y: (-anchor.y * 0.5 + 0.5) * height,
        behind: anchor.z > 1,
      };
    });

    this.labelSink(anchors);
  }

  /* ------------------------------------------------------------ output --- */

  /**
   * Renders one frame at a higher device scale and reads it straight back. The
   * canvas colour is painted in for the capture so the PNG matches the viewport
   * rather than arriving with a transparent hole where the backdrop was.
   */
  screenshot(scale = 2): string {
    const { width, height } = this.renderer.getSize(new THREE.Vector2());
    const ratio = this.renderer.getPixelRatio();
    const background = this.scene.background;
    const canvasColour =
      getComputedStyle(this.canvas).getPropertyValue('--canvas').trim() ||
      getComputedStyle(document.documentElement).getPropertyValue('--canvas').trim() ||
      '#54545a';

    this.scene.background = new THREE.Color(canvasColour);
    this.renderer.setPixelRatio(Math.min(this.maxPixelRatio * scale, 4));
    this.renderer.setSize(width, height, false);
    this.renderFrame();

    const url = this.canvas.toDataURL('image/png');

    this.scene.background = background;
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(width, height, false);
    this.invalidate();
    return url;
  }

  /* ------------------------------------------------------------- loop ---- */

  resize() {
    const width = this.canvas.clientWidth || 1;
    const height = this.canvas.clientHeight || 1;
    this.renderer.setSize(width, height, false);
    this.rig.setAspect(width / height);

    const buffer = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.annotations.setResolution(buffer.x, buffer.y);
    this.annotations.invalidate();
    this.invalidate();
  }

  dispose() {
    this.disposed = true;
    setActiveRenderer(null);
    cancelAnimationFrame(this.raf);
    this.labelSink = null;
    this.partSink = null;
    this.clearModel();
    this.rig.dispose();
    this.annotations.dispose();
    this.section.dispose();
    this.stage.dispose();
    this.selectionMark.dispose();
    this.hoverMark.dispose();
    this.layMark.geometry.dispose();
    (this.layMark.material as THREE.Material).dispose();
    [this.wire, this.solid, this.overhang, this.edgeMaterial].forEach((m) => m.dispose());
    this.renderer.dispose();
  }
}

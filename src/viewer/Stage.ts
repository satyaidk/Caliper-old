import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** Every model is scaled to this diagonal so lighting and shadows behave. */
export const CANONICAL = 8;

export type ThemeName = 'dark' | 'light';

/**
 * The stage palette, taken from Bambu Studio's own renderer so the plate reads
 * the way a Bambu user expects it to: a mid-grey plate a step lighter than the
 * canvas in the dark theme, a step darker in the light one, with fine grid
 * lines and brighter major lines. The canvas colour itself is CSS (`--canvas`
 * in styles/tokens.css) because the WebGL canvas is transparent over it.
 *
 * `mark` is what measurements are drawn in and `select` is what the selection
 * bracket is drawn in. They differ on purpose: green is the interface's
 * "active" colour, and a measurement has to stay readable on a green model.
 */
const SKIN = {
  dark: {
    plate: 0x626269,
    edge: 0x878b88,
    grid: 0x6e6e76,
    gridMajor: 0x878b88,
    volume: 0x9a9aa2,
    over: 0xff5a4f,
    shadow: 0.34,
    mark: 0xff7a1a,
    select: 0x2fc463,
    edgeInk: 0x16161a,
    edgeOpacity: 0.55,
    wire: 0xc9ced6,
    cap: 0x8d929a,
  },
  light: {
    plate: 0xd1d1d1,
    edge: 0xa6a9aa,
    grid: 0xe3e3e3,
    gridMajor: 0xf4f4f4,
    volume: 0x878b88,
    over: 0xd01b1b,
    shadow: 0.2,
    mark: 0xe25e00,
    select: 0x00ae42,
    edgeInk: 0x262e30,
    edgeOpacity: 0.42,
    wire: 0x4c5458,
    cap: 0x7a7f86,
  },
} as const;

export type Skin = (typeof SKIN)[ThemeName];

/** The plate as the Engine asks for it, in world units. */
export interface PlateSpec {
  width: number;
  depth: number;
  /** Grid spacing. Every fifth line is drawn as a major line. */
  cell: number;
  /** Build height, drawn as a wire box. `null` for the model-sized plate. */
  height: number | null;
  /** False when the model does not fit the build volume: the box turns red. */
  fits: boolean;
}

const DEFAULT_PLATE: PlateSpec = {
  width: CANONICAL * 3,
  depth: CANONICAL * 3,
  cell: 1,
  height: null,
  fits: true,
};

/** Grids denser than this stop being a ruler and become a texture. */
const MAX_LINES = 600;

function roundedRect(width: number, depth: number, radius: number): THREE.Shape {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.min(radius, w / 2, d / 2);
  const shape = new THREE.Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  shape.closePath();
  return shape;
}

function lines(points: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return geometry;
}

/**
 * Everything on stage that is not the model: the plate it stands on, the build
 * volume above it, and the light that falls on it. The Engine owns the model
 * and the camera; this owns the room they are in.
 *
 * The plate is sized in world units by the Engine, which knows the model's
 * scale. With a printer chosen that makes the plate a real ruler: grid cells
 * are a round number of millimetres and the plate is the printer's bed.
 */
export class Stage {
  readonly group = new THREE.Group();

  private readonly plate: THREE.Mesh;
  private readonly plateEdge: THREE.LineLoop;
  private readonly grid: THREE.LineSegments;
  private readonly gridMajor: THREE.LineSegments;
  private readonly volume: THREE.LineSegments;
  private readonly ground: THREE.Mesh;

  private readonly key: THREE.DirectionalLight;
  private readonly fill: THREE.DirectionalLight;
  private readonly rim: THREE.DirectionalLight;

  private readonly scene: THREE.Scene;
  private theme: ThemeName = 'dark';
  private shadowsOn = true;
  private spec: PlateSpec = DEFAULT_PLATE;
  private gridOn = true;

  constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
    this.scene = scene;
    const skin = SKIN[this.theme];

    // Unlit, so the plate stays an even field instead of catching the key
    // light's hotspot and reading as a fifth surface in the model.
    this.plate = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: skin.plate }));
    this.plate.rotation.x = -Math.PI / 2;
    this.plate.position.y = -0.006;
    this.plate.renderOrder = -2;

    this.plateEdge = new THREE.LineLoop(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: skin.edge }));
    this.plateEdge.rotation.x = -Math.PI / 2;
    this.plateEdge.position.y = -0.004;

    this.grid = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: skin.grid, transparent: true, opacity: 0.9 }),
    );
    this.gridMajor = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: skin.gridMajor, transparent: true, opacity: 0.9 }),
    );
    this.grid.position.y = this.gridMajor.position.y = -0.002;

    this.volume = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: skin.volume, transparent: true, opacity: 0.45 }),
    );

    // The shadow catcher takes the plate's own shape, so nothing casts onto the
    // canvas past the plate edge.
    this.ground = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShadowMaterial({ opacity: skin.shadow }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.003;
    this.ground.receiveShadow = true;

    this.key = new THREE.DirectionalLight(0xffffff, 1.35);
    this.key.position.set(6, 11, 7);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.02;
    const shadowCam = this.key.shadow.camera;
    shadowCam.near = 0.5;
    shadowCam.far = 60;
    shadowCam.left = shadowCam.bottom = -12;
    shadowCam.right = shadowCam.top = 12;

    this.fill = new THREE.DirectionalLight(0xe6ebf2, 0.3);
    this.fill.position.set(-7, 4, -5);
    this.rim = new THREE.DirectionalLight(0xffffff, 0.35);
    this.rim.position.set(-3, 6, -9);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environmentIntensity = 0.5;

    this.group.add(
      this.plate,
      this.plateEdge,
      this.grid,
      this.gridMajor,
      this.volume,
      this.ground,
      this.key,
      this.fill,
      this.rim,
      new THREE.AmbientLight(0xffffff, 0.12),
    );

    this.setPlate(DEFAULT_PLATE);
  }

  get skin(): Skin {
    return SKIN[this.theme];
  }

  /** Rebuilds the plate, grid and build volume to a new size. */
  setPlate(spec: PlateSpec) {
    this.spec = spec;
    const { width, depth, height } = spec;
    const outline = roundedRect(width, depth, Math.min(width, depth) * 0.03);

    this.plate.geometry.dispose();
    this.plate.geometry = new THREE.ShapeGeometry(outline);
    this.ground.geometry.dispose();
    this.ground.geometry = new THREE.ShapeGeometry(outline);
    this.plateEdge.geometry.dispose();
    this.plateEdge.geometry = new THREE.BufferGeometry().setFromPoints(outline.getPoints(12));

    // Lines run out from the centre so the major lines pass through the origin
    // the model is centred on, the way a print bed is marked.
    let cell = spec.cell > 0 ? spec.cell : 1;
    while (Math.max(width, depth) / cell > MAX_LINES) cell *= 5;
    const fine: number[] = [];
    const major: number[] = [];
    const inset = Math.min(width, depth) * 0.01;
    const w = width / 2 - inset;
    const d = depth / 2 - inset;
    for (let i = 0; i * cell <= w; i++) {
      for (const x of i === 0 ? [0] : [i * cell, -i * cell]) {
        (i % 5 === 0 ? major : fine).push(x, 0, -d, x, 0, d);
      }
    }
    for (let i = 0; i * cell <= d; i++) {
      for (const z of i === 0 ? [0] : [i * cell, -i * cell]) {
        (i % 5 === 0 ? major : fine).push(-w, 0, z, w, 0, z);
      }
    }
    this.grid.geometry.dispose();
    this.grid.geometry = lines(fine);
    this.gridMajor.geometry.dispose();
    this.gridMajor.geometry = lines(major);

    this.volume.geometry.dispose();
    if (height) {
      const x = width / 2;
      const z = depth / 2;
      const h = height;
      const top = [-x, h, -z, x, h, -z, x, h, -z, x, h, z, x, h, z, -x, h, z, -x, h, z, -x, h, -z];
      const posts = [-x, 0, -z, -x, h, -z, x, 0, -z, x, h, -z, x, 0, z, x, h, z, -x, 0, z, -x, h, z];
      this.volume.geometry = lines([...top, ...posts]);
    } else {
      this.volume.geometry = new THREE.BufferGeometry();
    }
    this.paint();
    this.syncVisibility();
  }

  private paint() {
    const skin = SKIN[this.theme];
    (this.plate.material as THREE.MeshBasicMaterial).color.setHex(skin.plate);
    (this.plateEdge.material as THREE.LineBasicMaterial).color.setHex(this.spec.fits ? skin.edge : skin.over);
    (this.grid.material as THREE.LineBasicMaterial).color.setHex(skin.grid);
    (this.gridMajor.material as THREE.LineBasicMaterial).color.setHex(skin.gridMajor);
    const volume = this.volume.material as THREE.LineBasicMaterial;
    volume.color.setHex(this.spec.fits ? skin.volume : skin.over);
    volume.opacity = this.spec.fits ? 0.45 : 0.85;
    (this.ground.material as THREE.ShadowMaterial).opacity = skin.shadow;
  }

  private syncVisibility() {
    for (const part of [this.plate, this.plateEdge, this.grid, this.gridMajor]) part.visible = this.gridOn;
    this.volume.visible = this.gridOn && this.spec.height !== null;
  }

  setGridVisible(visible: boolean) {
    this.gridOn = visible;
    this.syncVisibility();
  }

  setShadowsEnabled(enabled: boolean) {
    this.shadowsOn = enabled;
    this.ground.visible = enabled;
    this.key.castShadow = enabled;
  }

  get shadowsEnabled() {
    return this.shadowsOn;
  }

  /** The plate's extent, for framing the "default" view on a printer bed. */
  get plateBox(): THREE.Box3 {
    const { width, depth, height } = this.spec;
    return new THREE.Box3(
      new THREE.Vector3(-width / 2, 0, -depth / 2),
      new THREE.Vector3(width / 2, height ?? 0, depth / 2),
    );
  }

  setTheme(theme: ThemeName) {
    this.theme = theme;
    this.paint();
  }

  dispose() {
    this.group.traverse((node) => {
      const mesh = node as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const material = mesh.material;
      const list = Array.isArray(material) ? material : material ? [material] : [];
      list.forEach((m) => m.dispose());
    });
    this.scene.environment?.dispose();
  }
}

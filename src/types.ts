import type * as THREE from 'three';

/** How a format reaches the screen. Drives the badge colour and the copy. */
export type Pipeline = 'mesh' | 'cad' | 'bim';

export interface FormatSpec {
  /** Lower-case extension without the dot. */
  ext: string;
  label: string;
  pipeline: Pipeline;
  /** Extra files the loader will pick up if they are dropped alongside. */
  companions?: string[];
  /**
   * The unit the format's numbers are in when the spec pins one down. glTF is
   * metres by definition; most mesh formats carry no unit at all, and those are
   * read as millimetres because that is what a slicer assumes.
   */
  unit?: SourceUnit;
}

export type RenderMode = 'shaded' | 'wireframe' | 'edges';

/**
 * Camera presets, numbered the way Bambu Studio numbers them: 0 default,
 * 1 top, 2 bottom, 3 front, 4 rear, 5 left, 6 right, 7 isometric.
 */
export type ViewPreset = 'default' | 'top' | 'bottom' | 'front' | 'rear' | 'left' | 'right' | 'iso';
export type Projection = 'perspective' | 'orthographic';

/** Units a reading is displayed in. */
export type UnitSystem = 'mm' | 'cm' | 'm' | 'in';
/** Units the file's own numbers are in. Converted to millimetres internally. */
export type SourceUnit = 'mm' | 'cm' | 'm' | 'in';

/** The three workspaces in the top bar, after Bambu Studio's tabs. */
export type Workspace = 'home' | 'prepare' | 'preview';

export interface SceneStats {
  objects: number;
  meshes: number;
  triangles: number;
  vertices: number;
  materials: number;
  textures: number;
}

/** Bounds in the file's own units, measured in the model's current orientation. */
export interface Dimensions {
  x: number;
  y: number;
  z: number;
  diagonal: number;
  center: [number, number, number];
}

export interface ModelInfo {
  name: string;
  ext: string;
  pipeline: Pipeline;
  bytes: number;
  /** Wall-clock parse + tessellation time, ms. */
  parseMs: number;
  stats: SceneStats;
  dimensions: Dimensions;
  /** True when the file brought its own materials, so filament colour is optional. */
  authored: boolean;
}

/**
 * Printability figures, all in the file's own units (the store converts).
 * `null` means "not computed", which is what happens on very large models.
 */
export interface Printability {
  volume: number | null;
  area: number | null;
  /** Edges used by exactly one triangle. Zero means the surface is closed. */
  openEdges: number | null;
  /** Area of downward-facing surface steeper than the overhang threshold. */
  overhangArea: number | null;
}

/** One drawable part, as the object list shows it. */
export interface PartInfo {
  id: number;
  name: string;
  triangles: number;
  visible: boolean;
}

export interface LoadResult {
  object: THREE.Object3D;
  /** Loaders that carry their own colours ask us not to override materials. */
  hasAuthoredMaterials: boolean;
}

export interface LoadContext {
  /** Every dropped file, keyed by lower-case name and by relative path. */
  files: Map<string, File>;
  /** Blob URL for each entry in `files`, same keys. */
  urls: Map<string, string>;
  onProgress: (fraction: number | null, note?: string) => void;
}

export type Toast = {
  id: number;
  tone: 'info' | 'success' | 'error';
  title: string;
  text?: string;
  /** One follow-up a person is likely to want, offered in place. */
  action?: { label: string; run: () => void };
};

/* --- clipping ------------------------------------------------------------- */

export type Axis = 'x' | 'y' | 'z';

/**
 * A single cutting plane through the model. `at` runs 0 → 1 across the model's
 * bounds along `axis`; everything past the plane is cut away and the cut face
 * is capped solid, so a section reads as a section and not as a hollow shell.
 */
export interface ClipState {
  axis: Axis;
  at: number;
  /** Keep the far side instead of the near side. */
  flip: boolean;
}

/* --- measurement ---------------------------------------------------------- */

/**
 * What the next click does. `off` hands the pointer back to selection, which is
 * the only mode where orbiting a model does not risk dropping a point. `lay`
 * is Bambu Studio's "lay on face": the clicked face goes down onto the plate.
 */
export type MeasureTool = 'off' | 'distance' | 'diameter' | 'angle' | 'lay';
export type MeasuringTool = Exclude<MeasureTool, 'off' | 'lay'>;

/** Where a picked point landed. Drives the marker glyph and the snap readout. */
export type SnapKind = 'vertex' | 'midpoint' | 'centre' | 'surface';

export interface MeasurePoint {
  /** Position in world space — what the annotation is drawn from. */
  world: [number, number, number];
  /** The same position in the file's own units — what the readout shows. */
  model: [number, number, number];
  kind: SnapKind;
}

export interface Measurement {
  id: number;
  tool: MeasuringTool;
  points: MeasurePoint[];
  /** Distance, the diameter of the fitted circle, or an angle in degrees. */
  value: number;
  /** How the span splits across the axes. Distance only. */
  delta?: [number, number, number];
}

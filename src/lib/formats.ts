import type { FormatSpec, Pipeline, SourceUnit } from '@/types';

/**
 * Every format Caliper opens, grouped by the pipeline that turns it into
 * triangles. The grouping is not cosmetic: mesh formats already contain
 * triangles, CAD formats hold B-rep surfaces that must be tessellated by a
 * geometry kernel, and BIM formats carry building elements with their own
 * property sets. Load time and fidelity differ accordingly.
 */
export const FORMATS: FormatSpec[] = [
  // --- already tessellated ------------------------------------------------
  { ext: 'stl', label: 'Stereolithography', pipeline: 'mesh' },
  { ext: 'obj', label: 'Wavefront', pipeline: 'mesh', companions: ['mtl', 'png', 'jpg'] },
  { ext: 'ply', label: 'Polygon File Format', pipeline: 'mesh' },
  { ext: 'off', label: 'Object File Format', pipeline: 'mesh' },
  { ext: 'gltf', label: 'glTF', pipeline: 'mesh', companions: ['bin', 'png', 'jpg', 'ktx2'], unit: 'm' },
  { ext: 'glb', label: 'glTF binary', pipeline: 'mesh', unit: 'm' },
  { ext: 'fbx', label: 'Filmbox', pipeline: 'mesh' },
  { ext: 'dae', label: 'Collada', pipeline: 'mesh' },
  { ext: '3ds', label: '3D Studio', pipeline: 'mesh' },
  { ext: '3mf', label: '3D Manufacturing', pipeline: 'mesh' },
  { ext: 'amf', label: 'Additive Manufacturing', pipeline: 'mesh' },
  { ext: 'wrl', label: 'VRML', pipeline: 'mesh' },

  // --- B-rep, tessellated on open ----------------------------------------
  { ext: 'step', label: 'STEP AP203/214', pipeline: 'cad' },
  { ext: 'stp', label: 'STEP', pipeline: 'cad' },
  { ext: 'iges', label: 'IGES', pipeline: 'cad' },
  { ext: 'igs', label: 'IGES', pipeline: 'cad' },
  { ext: 'brep', label: 'OpenCascade B-rep', pipeline: 'cad' },
  { ext: 'brp', label: 'OpenCascade B-rep', pipeline: 'cad' },
  { ext: 'fcstd', label: 'FreeCAD document', pipeline: 'cad' },
  { ext: '3dm', label: 'Rhinoceros', pipeline: 'cad' },

  // --- building models ----------------------------------------------------
  { ext: 'ifc', label: 'Industry Foundation Classes', pipeline: 'bim', unit: 'm' },
  { ext: 'bim', label: 'dotbim', pipeline: 'bim', unit: 'm' },
];

const BY_EXT = new Map(FORMATS.map((f) => [f.ext, f]));

/** Extensions that are payload for another file rather than a model on their own. */
export const COMPANION_EXTS = new Set([
  'mtl',
  'bin',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'ktx2',
  'basis',
  'tga',
  'bmp',
  'gif',
  'hdr',
]);

export const PIPELINE_COPY: Record<Pipeline, { title: string; note: string }> = {
  mesh: {
    title: 'Mesh',
    note: 'Triangles are read straight out of the file.',
  },
  cad: {
    title: 'CAD B-rep',
    note: 'Surfaces are tessellated on open by an OpenCascade kernel.',
  },
  bim: {
    title: 'BIM',
    note: 'Building elements arrive with their own geometry and grouping.',
  },
};

/**
 * The same list, grouped for the format matrix. Derived rather than written out
 * a second time: a hand-kept showcase drifts from FORMATS the first time an
 * extension is added, and then the page advertises a number it cannot back up.
 */
export const BY_PIPELINE: Record<Pipeline, FormatSpec[]> = {
  mesh: FORMATS.filter((f) => f.pipeline === 'mesh'),
  cad: FORMATS.filter((f) => f.pipeline === 'cad'),
  bim: FORMATS.filter((f) => f.pipeline === 'bim'),
};

export function extOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot < 0 ? '' : filename.slice(dot + 1).toLowerCase();
}

export function baseOf(filename: string): string {
  const slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  return slash < 0 ? filename : filename.slice(slash + 1);
}

export function specFor(filename: string): FormatSpec | undefined {
  return BY_EXT.get(extOf(filename));
}

/**
 * The unit a file's numbers are read in until a person says otherwise. glTF is
 * metres by specification, web-ifc reports IFC geometry in metres, and dotbim
 * files are authored in metres by convention. Everything else is read as
 * millimetres, which is what a slicer assumes of an STL. The details panel
 * offers the other units for the files that guess wrong.
 */
export function defaultUnitFor(filename: string): SourceUnit {
  return specFor(filename)?.unit ?? 'mm';
}

export function isSupported(filename: string): boolean {
  return BY_EXT.has(extOf(filename));
}

/** `accept` attribute for the file input. */
export const ACCEPT = FORMATS.map((f) => `.${f.ext}`)
  .concat(['.glb', '.mtl', '.bin'])
  .filter((v, i, a) => a.indexOf(v) === i)
  .join(',');

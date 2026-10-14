import type { SourceUnit } from '@/types';

/**
 * Build plates, and the one question a slicer answers before any other: does
 * this part fit?
 *
 * Bambu Studio's sidebar opens with the printer, because the plate under the
 * model is the frame every other number is read against. Caliper borrows that.
 * With a printer chosen, the plate is drawn at its real size and the model at
 * its real size on top of it, so "too big" is visible before it is a number.
 *
 * Sizes are the manufacturers' published build volumes in millimetres, as
 * width × depth × height. Width runs along the model's X, depth along its Z and
 * height along its Y, because the viewer is Y-up and printers are Z-up.
 */

export interface PrinterBed {
  id: string;
  label: string;
  /** Build volume in mm: width (X), depth, height. `null` sizes the plate to the model. */
  size: [number, number, number] | null;
}

export const BEDS: PrinterBed[] = [
  { id: 'auto', label: 'Sized to the model', size: null },
  { id: 'bambu-256', label: 'Bambu Lab X1, P1 and A1 — 256 mm', size: [256, 256, 256] },
  { id: 'bambu-180', label: 'Bambu Lab A1 mini — 180 mm', size: [180, 180, 180] },
  { id: 'prusa-mk4', label: 'Prusa MK4 — 250 × 210 mm', size: [250, 210, 220] },
  { id: 'ender-3', label: 'Creality Ender-3 — 220 mm', size: [220, 220, 250] },
];

export function bedById(id: string): PrinterBed {
  return BEDS.find((bed) => bed.id === id) ?? BEDS[0];
}

/** How many millimetres one of the file's units is worth. */
export const MM_PER: Record<SourceUnit, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
};

export interface FitReport {
  fits: boolean;
  /** True when the part only fits after turning 90° on the plate. */
  turned: boolean;
  /** How far past the build volume the part reaches, per printer axis, in mm. */
  over: { width: number; depth: number; height: number };
}

/**
 * Checks a part's bounds against a build volume. Both arguments are in mm; the
 * part is `[x, y, z]` with Y up. A quarter turn about the vertical axis is free
 * on a real plate, so a part that only fits sideways still fits.
 */
export function fitOnBed(part: [number, number, number], bed: [number, number, number]): FitReport {
  const [x, y, z] = part;
  const [width, depth, height] = bed;
  const overHeight = Math.max(0, y - height);

  const straight = { width: Math.max(0, x - width), depth: Math.max(0, z - depth) };
  const turned = { width: Math.max(0, z - width), depth: Math.max(0, x - depth) };
  const straightFits = straight.width === 0 && straight.depth === 0;
  const turnedFits = turned.width === 0 && turned.depth === 0;

  // Report whichever orientation misses by less, so the readout names the
  // smallest change that would make it fit.
  const useTurned = !straightFits && (turnedFits || turned.width + turned.depth < straight.width + straight.depth);
  const footprint = useTurned ? turned : straight;

  return {
    fits: (straightFits || turnedFits) && overHeight === 0,
    turned: useTurned && turnedFits,
    over: { ...footprint, height: overHeight },
  };
}

/**
 * A grid spacing that keeps cells countable: the 1-2-5 sequence a ruler uses,
 * picked so a span is divided into roughly `cells` steps.
 */
export function niceStep(span: number, cells = 24): number {
  if (!(span > 0)) return 1;
  const raw = span / cells;
  const power = 10 ** Math.floor(Math.log10(raw));
  for (const factor of [1, 2, 5, 10]) {
    if (raw <= factor * power) return factor * power;
  }
  return 10 * power;
}

/* --- layers ------------------------------------------------------------------
   Preview cuts the part at a layer boundary. The cut is stored as a fraction of
   the part's height, because that is what the clipping plane takes; these turn
   it into the layer number a slicer would print, and back. */

/** How many layers a part of `heightMm` prints in. The last one may be partial. */
export function layerCount(heightMm: number, layerHeight: number): number {
  if (!(heightMm > 0) || !(layerHeight > 0)) return 1;
  return Math.max(1, Math.ceil(heightMm / layerHeight - 1e-9));
}

/** The layer a cut at `fraction` of the height falls in, 1-based. */
export function layerAtFraction(fraction: number, heightMm: number, layerHeight: number): number {
  const total = layerCount(heightMm, layerHeight);
  if (!(heightMm > 0) || !(layerHeight > 0)) return total;
  const layer = Math.ceil((fraction * heightMm) / layerHeight - 1e-6);
  return Math.min(total, Math.max(1, layer));
}

/** The fraction of the height at the top of layer `layer`. */
export function fractionAtLayer(layer: number, heightMm: number, layerHeight: number): number {
  if (!(heightMm > 0)) return 1;
  return Math.min(1, Math.max(0, (layer * layerHeight) / heightMm));
}

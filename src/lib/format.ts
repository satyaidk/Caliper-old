import type { UnitSystem } from '@/types';

const UNIT_FACTOR: Record<UnitSystem, number> = {
  mm: 1,
  cm: 0.1,
  m: 0.001,
  in: 1 / 25.4,
};

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}

export function count(n: number): string {
  return n.toLocaleString('en-US');
}

export function compact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
  return `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)}M`;
}

/**
 * Source units are unknown for most formats, so the number is treated as
 * millimetres and converted from there. The status strip says as much.
 */
export function dim(value: number, unit: UnitSystem): string {
  const v = value * UNIT_FACTOR[unit];
  if (v === 0) return `0 ${unit}`;
  // Nudge off the boundary first: 25.4 mm converts to 0.99999… inches, and
  // without this it would print with four decimals instead of two.
  const abs = Math.abs(v) * (1 + Number.EPSILON * 8);
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
  return `${v.toFixed(digits)} ${unit}`;
}

export function ms(value: number): string {
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(2)} s`;
}

export function shortName(name: string, max = 34): string {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot) : '';
  return `${name.slice(0, max - ext.length - 1)}…${ext}`;
}

/**
 * A volume from cubic millimetres, in the unit family the display uses:
 * cubic inches for inches, cubic centimetres otherwise — the figure a filament
 * spool is sold against — and cubic millimetres for very small parts.
 */
export function volume(mm3: number, unit: UnitSystem): string {
  if (unit === 'in') return `${(mm3 / 16387.064).toFixed(2)} in³`;
  if (mm3 < 1000) return `${mm3.toFixed(1)} mm³`;
  const cm3 = mm3 / 1000;
  return `${cm3 >= 1000 ? Math.round(cm3).toLocaleString('en-US') : cm3.toFixed(cm3 >= 100 ? 1 : 2)} cm³`;
}

/** An area from square millimetres, in the same unit family as `volume`. */
export function area(mm2: number, unit: UnitSystem): string {
  if (unit === 'in') return `${(mm2 / 645.16).toFixed(2)} in²`;
  if (mm2 < 100) return `${mm2.toFixed(1)} mm²`;
  const cm2 = mm2 / 100;
  return `${cm2 >= 1000 ? Math.round(cm2).toLocaleString('en-US') : cm2.toFixed(cm2 >= 100 ? 1 : 2)} cm²`;
}

export function grams(g: number): string {
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g >= 100 ? Math.round(g) : g.toFixed(1)} g`;
}

/** An angle in degrees, to a tenth: finer than any printed part holds. */
export function degrees(value: number): string {
  return `${value.toFixed(1)}°`;
}

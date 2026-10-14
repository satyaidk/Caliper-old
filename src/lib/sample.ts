import * as THREE from 'three';

/**
 * A sample part, generated rather than downloaded, so the viewer has something
 * to show with no network and no file: an 18-tooth spur gear with a bore and
 * four lightening holes, lying flat the way it would print.
 *
 * The numbers are chosen to be checkable with the measuring tools. Module 2.5
 * puts the tooth tips on a 50 mm circle; the bore is 8 mm; the gear is 8 mm
 * thick. Measure them and the readouts should say exactly that.
 */

export const GEAR = {
  teeth: 18,
  module: 2.5,
  thickness: 8,
  bore: 8,
  holes: 4,
  holeDiameter: 9,
  holeCircle: 24,
} as const;

/** Tip, pitch and root radii, from the module and the tooth count. */
export function gearRadii() {
  const pitch = (GEAR.module * GEAR.teeth) / 2;
  return { tip: pitch + GEAR.module, pitch, root: pitch - 1.25 * GEAR.module };
}

/**
 * Angles, as fractions of one tooth's pitch, where each tooth's outline turns.
 * A trapezoid tooth: narrower at the tip than at the root, which reads as a
 * gear at any zoom without an involute's worth of vertices.
 */
const TOOTH = { riseStart: 0, tipStart: 0.2, tipEnd: 0.4, riseEnd: 0.6 } as const;

/** Angle of the middle of tooth `k`'s tip, in radians. */
export function tipAngle(k: number): number {
  const pitch = (Math.PI * 2) / GEAR.teeth;
  return (k + (TOOTH.tipStart + TOOTH.tipEnd) / 2) * pitch;
}

function circle(radius: number, cx = 0, cy = 0, steps = 48): THREE.Path {
  const path = new THREE.Path();
  // Holes wind the opposite way to the outline.
  for (let i = 0; i <= steps; i++) {
    const a = (-i / steps) * Math.PI * 2;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  return path;
}

export function gearGeometry(): THREE.BufferGeometry {
  const { tip, root } = gearRadii();
  const pitch = (Math.PI * 2) / GEAR.teeth;
  const shape = new THREE.Shape();

  for (let k = 0; k < GEAR.teeth; k++) {
    const base = k * pitch;
    const corners: [number, number][] = [
      [root, base + TOOTH.riseStart * pitch],
      [tip, base + TOOTH.tipStart * pitch],
      [tip, base + TOOTH.tipEnd * pitch],
      [root, base + TOOTH.riseEnd * pitch],
    ];
    corners.forEach(([r, a], i) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (k === 0 && i === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
    // The root arc across to the next tooth, stopping one step short: the next
    // tooth's first corner closes it, and a repeated point upsets triangulation.
    const arcFrom = base + TOOTH.riseEnd * pitch;
    for (let s = 1; s < 4; s++) {
      const a = arcFrom + ((pitch - TOOTH.riseEnd * pitch) * s) / 4;
      shape.lineTo(Math.cos(a) * root, Math.sin(a) * root);
    }
  }
  shape.closePath();

  shape.holes.push(circle(GEAR.bore / 2));
  for (let i = 0; i < GEAR.holes; i++) {
    const a = (i / GEAR.holes) * Math.PI * 2 + Math.PI / 4;
    const r = GEAR.holeCircle / 2;
    shape.holes.push(circle(GEAR.holeDiameter / 2, Math.cos(a) * r, Math.sin(a) * r, 36));
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: GEAR.thickness,
    bevelEnabled: false,
    curveSegments: 1,
  });
  // Extruded along +Z; lay it flat so the axis is vertical, as it would print.
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Reference points in the gear's own millimetres, ready for the Engine's
 * addMeasurement: three tooth tips a third of a turn apart, which a circle
 * fit turns into the 50 mm tip diameter; the bore, at mid-thickness; and the
 * two ends of one tooth tip's edge, which is the gear's thickness.
 */
export function gearReferencePoints() {
  const { tip } = gearRadii();
  const h = GEAR.thickness;
  // rotateX(-90°) maps the shape's (x, y) to (x, -z), extrusion to +y.
  const onCircle = (radius: number, a: number, y: number): [number, number, number] => [
    Math.cos(a) * radius,
    y,
    -Math.sin(a) * radius,
  ];
  const third = GEAR.teeth / 3;
  // Tooth 15 sits toward +X +Z, the corner the isometric view looks at.
  const front = tipAngle(15);
  return {
    tips: [0, third, third * 2].map((k) => onCircle(tip, tipAngle(k), h)),
    bore: [0.3, 2.4, 4.4].map((a) => onCircle(GEAR.bore / 2, a, h / 2)),
    thickness: [onCircle(tip, front, 0), onCircle(tip, front, h)],
  };
}

/** The gear as a binary STL file, so the app opens it the way it opens any other. */
export async function gearFile(): Promise<File> {
  const { STLExporter } = await import('three/examples/jsm/exporters/STLExporter.js');
  const mesh = new THREE.Mesh(gearGeometry());
  mesh.name = 'Spur gear';
  const data = new STLExporter().parse(mesh, { binary: true }) as DataView;
  mesh.geometry.dispose();
  return new File([data.buffer as ArrayBuffer], 'sample-gear.stl', { type: 'model/stl' });
}

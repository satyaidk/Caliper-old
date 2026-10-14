import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useViewer } from '@/store/useViewer';
import type { ViewPreset } from '@/types';

/**
 * The orientation gizmo.
 *
 * A grid of nine buttons labelled TOP / FRT / LFT tells you what you can press.
 * It does not tell you where you are, which is the question you actually have
 * while orbiting. This projects the world axes through the live camera rotation
 * instead, so the widget is a readout first and a control second — the axis
 * pointing at you is the one you are looking down, and the triad's colours mean
 * the same thing here as they do in the size rows and the status bar.
 */

const RADIUS = 28;
const CENTRE = 40;

interface Arm {
  preset: ViewPreset;
  axis: 'x' | 'y' | 'z';
  vector: THREE.Vector3;
  label: string;
  title: string;
  /** The far end of each pair is an open ring, so the pair reads as one axis. */
  positive: boolean;
}

const ARMS: Arm[] = [
  { preset: 'right', axis: 'x', vector: new THREE.Vector3(1, 0, 0), label: 'X', title: 'Look from the right', positive: true },
  { preset: 'left', axis: 'x', vector: new THREE.Vector3(-1, 0, 0), label: '', title: 'Look from the left', positive: false },
  { preset: 'top', axis: 'y', vector: new THREE.Vector3(0, 1, 0), label: 'Y', title: 'Look from the top', positive: true },
  { preset: 'bottom', axis: 'y', vector: new THREE.Vector3(0, -1, 0), label: '', title: 'Look from below', positive: false },
  { preset: 'front', axis: 'z', vector: new THREE.Vector3(0, 0, 1), label: 'Z', title: 'Look at the front', positive: true },
  { preset: 'rear', axis: 'z', vector: new THREE.Vector3(0, 0, -1), label: '', title: 'Look at the back', positive: false },
];

const AXES = ['x', 'y', 'z'] as const;

export function Gizmo() {
  const engine = useViewer((s) => s.engine);
  const setView = useViewer((s) => s.setView);
  const armRefs = useRef<(SVGGElement | null)[]>([]);
  const lineRefs = useRef<(SVGLineElement | null)[]>([]);
  const stackRef = useRef<SVGGElement>(null);

  useEffect(() => {
    if (!engine) return;
    const quaternion = new THREE.Quaternion();
    const inverse = new THREE.Quaternion();
    const projected = new THREE.Vector3();
    let raf = 0;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const stack = stackRef.current;
      if (!stack) return;

      engine.viewQuaternion(quaternion);
      inverse.copy(quaternion).invert();

      const depths: { index: number; z: number }[] = [];

      ARMS.forEach((arm, index) => {
        const node = armRefs.current[index];
        if (!node) return;

        projected.copy(arm.vector).applyQuaternion(inverse);
        const x = CENTRE + projected.x * RADIUS;
        const y = CENTRE - projected.y * RADIUS;

        node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
        // z runs from -1 (behind the model) to 1 (pointing at the viewer).
        node.style.opacity = String(0.4 + (projected.z + 1) * 0.3);
        depths.push({ index, z: projected.z });

        // The positive arm of each pair also owns that axis's spoke.
        if (arm.positive) {
          const line = lineRefs.current[AXES.indexOf(arm.axis)];
          if (line) {
            line.setAttribute('x1', (CENTRE - projected.x * RADIUS).toFixed(2));
            line.setAttribute('y1', (CENTRE + projected.y * RADIUS).toFixed(2));
            line.setAttribute('x2', x.toFixed(2));
            line.setAttribute('y2', y.toFixed(2));
          }
        }
      });

      // SVG paints in document order, so the arm nearest the viewer has to be
      // last in the DOM or it ends up buried under the one behind the model.
      depths.sort((a, b) => a.z - b.z);
      for (const { index } of depths) {
        const node = armRefs.current[index];
        if (node) stack.appendChild(node);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    <div className="gizmo" role="group" aria-label="Camera orientation">
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle className="gizmo-dial" cx={CENTRE} cy={CENTRE} r={RADIUS + 8} />
        {AXES.map((axis, index) => (
          <line
            key={axis}
            ref={(node) => {
              lineRefs.current[index] = node;
            }}
            className="gizmo-spoke"
            data-axis={axis}
            x1={CENTRE}
            y1={CENTRE}
            x2={CENTRE}
            y2={CENTRE}
          />
        ))}
        <g ref={stackRef}>
          {ARMS.map((arm, index) => (
            <g
              key={arm.preset}
              ref={(node) => {
                armRefs.current[index] = node;
              }}
              className="gizmo-arm"
              data-axis={arm.axis}
              data-positive={arm.positive}
              onClick={() => setView(arm.preset)}
              role="button"
              tabIndex={0}
              aria-label={arm.title}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setView(arm.preset);
                }
              }}
            >
              <title>{arm.title}</title>
              <circle className="gizmo-cap" r="8" />
              {arm.label && (
                <text className="gizmo-label" dy="3.2">
                  {arm.label}
                </text>
              )}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

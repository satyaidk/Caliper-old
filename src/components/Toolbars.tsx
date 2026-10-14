import type { ReactNode } from 'react';
import { useViewer, useMm } from '@/store/useViewer';
import { dim } from '@/lib/format';
import { EXPLODE_MAX } from '@/viewer/Explode';
import { fractionAtLayer, layerAtFraction, layerCount } from '@/lib/printers';
import type { Axis, MeasureTool, RenderMode } from '@/types';
import {
  IconAngle,
  IconAutoOrient,
  IconClose,
  IconDiameter,
  IconDistance,
  IconEdges,
  IconExplode,
  IconFit,
  IconLabels,
  IconLayFace,
  IconOpen,
  IconOrthographic,
  IconOverhang,
  IconPerspective,
  IconPlate,
  IconReset,
  IconSection,
  IconShaded,
  IconShadow,
  IconUndo,
  IconWire,
} from './Icons';
import { Segmented, ToolButton } from './ui';

/* ---------------------------------------------------------- canvas toolbar */

const MEASURES: { tool: MeasureTool; label: string; keys: string; icon: ReactNode }[] = [
  { tool: 'distance', label: 'Measure a distance', keys: 'U', icon: <IconDistance /> },
  { tool: 'diameter', label: 'Measure a diameter', keys: 'D', icon: <IconDiameter /> },
  { tool: 'angle', label: 'Measure an angle', keys: 'A', icon: <IconAngle /> },
];

/**
 * Bambu Studio's main toolbar, floating at the top of the canvas: the things
 * you do *to* the part. Orientation first, then measuring, then the two ways of
 * looking inside it.
 */
export function CanvasToolbar({ onOpen }: { onOpen: () => void }) {
  const model = useViewer((s) => s.model);
  const tool = useViewer((s) => s.measureTool);
  const setTool = useViewer((s) => s.setMeasureTool);
  const autoOrient = useViewer((s) => s.autoOrient);
  const section = useViewer((s) => s.section);
  const setSection = useViewer((s) => s.setSection);
  const assembly = useViewer((s) => s.assembly);
  const setAssembly = useViewer((s) => s.setAssembly);
  const none = !model;

  return (
    <div className="ctoolbar" role="toolbar" aria-label="Part tools">
      <ToolButton label="Open a model" keys="Ctrl O" onClick={onOpen}>
        <IconOpen />
      </ToolButton>
      <span className="ctool-sep" />
      <ToolButton label="Auto orient: largest flat face down" keys="R" disabled={none} onClick={autoOrient}>
        <IconAutoOrient />
      </ToolButton>
      <ToolButton
        label="Lay on face"
        keys="F"
        disabled={none}
        active={tool === 'lay'}
        onClick={() => setTool('lay')}
      >
        <IconLayFace />
      </ToolButton>
      <span className="ctool-sep" />
      {MEASURES.map((m) => (
        <ToolButton
          key={m.tool}
          label={m.label}
          keys={m.keys}
          disabled={none}
          active={tool === m.tool}
          onClick={() => setTool(m.tool)}
        >
          {m.icon}
        </ToolButton>
      ))}
      <span className="ctool-sep" />
      <ToolButton
        label="Section view"
        keys="X"
        disabled={none}
        active={section.on}
        onClick={() => setSection({ on: !section.on })}
      >
        <IconSection />
      </ToolButton>
      <ToolButton
        label="Assembly view"
        keys="Y"
        disabled={none}
        active={assembly}
        onClick={() => setAssembly(!assembly)}
      >
        <IconExplode />
      </ToolButton>
    </div>
  );
}

/* ---------------------------------------------------------------- view bar */

const MODES: { mode: RenderMode; label: string; keys: string; icon: ReactNode }[] = [
  { mode: 'shaded', label: 'Shaded', keys: 'Q', icon: <IconShaded /> },
  { mode: 'wireframe', label: 'Wireframe', keys: 'W', icon: <IconWire /> },
  { mode: 'edges', label: 'Shaded with edges', keys: 'E', icon: <IconEdges /> },
];

/**
 * How the part is drawn, as opposed to what is done to it. Kept apart from the
 * main toolbar the way Bambu keeps its view options apart from its gizmos.
 */
export function ViewBar() {
  const display = useViewer((s) => s.display);
  const setDisplay = useViewer((s) => s.setDisplay);
  const frameAll = useViewer((s) => s.frameAll);
  const workspace = useViewer((s) => s.workspace);
  const ortho = display.projection === 'orthographic';

  return (
    <div className="viewbar" role="toolbar" aria-label="View options">
      {MODES.map((m) => (
        <ToolButton
          key={m.mode}
          variant="bar"
          tip="above"
          label={m.label}
          keys={m.keys}
          active={display.renderMode === m.mode}
          onClick={() => setDisplay('renderMode', m.mode)}
        >
          {m.icon}
        </ToolButton>
      ))}
      <span className="ctool-sep" />
      <ToolButton
        variant="bar"
        tip="above"
        label={ortho ? 'Orthographic: switch to perspective' : 'Perspective: switch to orthographic'}
        keys="K"
        active={ortho}
        onClick={() => setDisplay('projection', ortho ? 'perspective' : 'orthographic')}
      >
        {ortho ? <IconOrthographic /> : <IconPerspective />}
      </ToolButton>
      <ToolButton
        variant="bar"
        tip="above"
        label={display.grid ? 'Hide the plate' : 'Show the plate'}
        keys="G"
        active={display.grid}
        onClick={() => setDisplay('grid', !display.grid)}
      >
        <IconPlate />
      </ToolButton>
      <ToolButton
        variant="bar"
        tip="above"
        label={display.shadows ? 'Turn shadows off' : 'Turn shadows on'}
        keys="S"
        active={display.shadows}
        onClick={() => setDisplay('shadows', !display.shadows)}
      >
        <IconShadow />
      </ToolButton>
      <ToolButton
        variant="bar"
        tip="above"
        label={display.labels ? 'Hide part labels' : 'Show part labels'}
        keys="L"
        active={display.labels}
        onClick={() => setDisplay('labels', !display.labels)}
      >
        <IconLabels />
      </ToolButton>
      {workspace !== 'preview' && (
        <ToolButton
          variant="bar"
          tip="above"
          label={display.overhang ? 'Hide overhangs' : 'Show overhangs'}
          keys="O"
          active={display.overhang}
          onClick={() => setDisplay('overhang', !display.overhang)}
        >
          <IconOverhang />
        </ToolButton>
      )}
      <span className="ctool-sep" />
      <ToolButton variant="bar" tip="above" label="Fit the part to the view" keys="Z" onClick={frameAll}>
        <IconFit />
      </ToolButton>
    </div>
  );
}

/* ------------------------------------------------------------- tool panels */

/** What a half-finished measurement is still waiting for. */
const STEPS: Record<string, string[]> = {
  distance: ['Click the first point', 'Click the second point'],
  diameter: ['Click a point on the edge of the hole', 'Click a second point on it', 'Click a third point on it'],
  angle: ['Click a point on the first arm', 'Click the corner', 'Click a point on the second arm'],
};

const TOOL_NAME: Record<string, string> = {
  distance: 'Distance',
  diameter: 'Diameter',
  angle: 'Angle',
};

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <section className="fpanel" aria-label={title}>
      <header className="fpanel-head">
        <h2 className="fpanel-title">{title}</h2>
        <button type="button" className="icon-btn" onClick={onClose} aria-label={`Close ${title.toLowerCase()}`}>
          <IconClose size={12} />
        </button>
      </header>
      {children}
    </section>
  );
}

function MeasurePanel() {
  const tool = useViewer((s) => s.measureTool);
  const pending = useViewer((s) => s.pendingPoints);
  const setTool = useViewer((s) => s.setMeasureTool);
  const undo = useViewer((s) => s.undoMeasure);
  if (tool === 'off' || tool === 'lay') return null;
  const steps = STEPS[tool];

  return (
    <Panel title={TOOL_NAME[tool]} onClose={() => setTool('off')}>
      <div className="fpanel-step">
        <span className="step-dots" aria-hidden>
          {steps.map((_, i) => (
            <i key={i} data-done={i < pending} data-now={i === pending} />
          ))}
        </span>
        <span>{steps[pending] ?? 'Placing…'}</span>
      </div>
      <p className="fpanel-note">Points snap to the nearest corner, edge midpoint or face centre.</p>
      {pending > 0 && (
        <button type="button" className="btn" data-variant="ghost" onClick={undo}>
          <IconUndo />
          Undo point
        </button>
      )}
    </Panel>
  );
}

function LayPanel() {
  const tool = useViewer((s) => s.measureTool);
  const setTool = useViewer((s) => s.setMeasureTool);
  const oriented = useViewer((s) => s.oriented);
  const reset = useViewer((s) => s.resetOrientation);
  if (tool !== 'lay') return null;

  return (
    <Panel title="Lay on face" onClose={() => setTool('off')}>
      <p className="fpanel-note">Click any flat face and the part turns so that face rests on the plate.</p>
      {oriented && (
        <button type="button" className="btn" data-variant="ghost" onClick={reset}>
          <IconReset size={14} />
          Back to the file’s orientation
        </button>
      )}
    </Panel>
  );
}

function SectionPanel() {
  const section = useViewer((s) => s.section);
  const setSection = useViewer((s) => s.setSection);
  const model = useViewer((s) => s.model);
  const unit = useViewer((s) => s.unit);
  const workspace = useViewer((s) => s.workspace);
  const mm = useMm();
  // Preview's layer cut replaces the section; the panel would control nothing.
  if (!section.on || !model || workspace !== 'prepare') return null;
  const span = model.dimensions[section.axis] * mm;

  return (
    <Panel title="Section view" onClose={() => setSection({ on: false })}>
      <div className="control-row">
        <span className="control-label">Cut across</span>
        <Segmented<Axis>
          label="Cut across"
          size="sm"
          value={section.axis}
          onChange={(axis) => setSection({ axis })}
          options={[
            { value: 'x', label: 'X' },
            { value: 'y', label: 'Y' },
            { value: 'z', label: 'Z' },
          ]}
        />
      </div>
      <label className="control">
        <span className="control-label">
          Position <b className="num">{dim(section.at * span, unit)}</b>
        </span>
        <input
          className="slider"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={section.at}
          onChange={(event) => setSection({ at: Number(event.target.value) })}
        />
      </label>
      <button type="button" className="btn" data-variant="ghost" onClick={() => setSection({ flip: !section.flip })}>
        Keep the other side
      </button>
    </Panel>
  );
}

function AssemblyPanel() {
  const assembly = useViewer((s) => s.assembly);
  const setAssembly = useViewer((s) => s.setAssembly);
  const explode = useViewer((s) => s.explode);
  const setExplode = useViewer((s) => s.setExplode);
  if (!assembly) return null;

  return (
    <Panel title="Assembly view" onClose={() => setAssembly(false)}>
      <label className="control">
        <span className="control-label">
          Explosion ratio <b className="num">{explode.toFixed(2)}</b>
        </span>
        <input
          className="slider"
          type="range"
          min={1}
          max={EXPLODE_MAX}
          step={0.01}
          value={explode}
          onChange={(event) => setExplode(Number(event.target.value))}
        />
      </label>
      <p className="fpanel-note">Parts move straight out from the centre of the assembly.</p>
    </Panel>
  );
}

/** Floating panels for whichever tools are out, stacked at the canvas's top left. */
export function ToolPanels() {
  return (
    <div className="fpanels">
      <MeasurePanel />
      <LayPanel />
      <SectionPanel />
      <AssemblyPanel />
    </div>
  );
}

/* ------------------------------------------------------------ layer slider */

/**
 * Bambu Studio's Preview slider, standing at the right of the canvas: drag it
 * down and the part is cut away from the top, layer by layer, so the inside of
 * every layer can be read.
 */
export function LayerSlider() {
  const layerAt = useViewer((s) => s.layerAt);
  const setLayerAt = useViewer((s) => s.setLayerAt);
  const layerHeight = useViewer((s) => s.layerHeight);
  const model = useViewer((s) => s.model);
  const mm = useMm();
  if (!model) return null;

  const height = model.dimensions.y * mm;
  const total = layerCount(height, layerHeight);
  const layer = layerAtFraction(layerAt, height, layerHeight);
  const goTo = (next: number) =>
    setLayerAt(fractionAtLayer(Math.min(total, Math.max(1, next)), height, layerHeight));

  return (
    <div className="layers" aria-label="Layer slider">
      <div className="layers-read">
        <b className="num">{layer.toLocaleString()}</b>
        <span className="num">of {total.toLocaleString()}</span>
        <span className="num">{Math.min(layer * layerHeight, height).toFixed(2)} mm</span>
      </div>
      <button type="button" className="layers-step" onClick={() => goTo(layer + 1)} aria-label="Up one layer">
        +
      </button>
      <input
        className="layers-range"
        type="range"
        min={1}
        max={total}
        step={1}
        value={layer}
        aria-label={`Layer ${layer} of ${total}`}
        onChange={(event) => goTo(Number(event.target.value))}
      />
      <button type="button" className="layers-step" onClick={() => goTo(layer - 1)} aria-label="Down one layer">
        −
      </button>
    </div>
  );
}

/** The Preview legend: what the colours on the model mean. */
export function PreviewLegend() {
  const overhangDeg = useViewer((s) => s.overhangDeg);
  const filament = useViewer((s) => s.filament);
  return (
    <div className="legend" aria-label="Legend">
      <div className="legend-row">
        <i style={{ background: filament }} />
        Printed surface
      </div>
      <div className="legend-row">
        <i data-tone="over" />
        Overhang past {overhangDeg}°
      </div>
      <div className="legend-row">
        <i data-tone="cap" />
        Cut face at the current layer
      </div>
    </div>
  );
}

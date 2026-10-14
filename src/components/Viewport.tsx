import { useEffect, useRef, useState } from 'react';
import { Engine, type PartLabel } from '@/viewer/Engine';
import { useViewer, useMm } from '@/store/useViewer';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { FORMATS } from '@/lib/formats';
import { spreadLabels } from '@/lib/labels';
import { Gizmo } from './Gizmo';
import { CanvasToolbar, LayerSlider, PreviewLegend, ToolPanels, ViewBar } from './Toolbars';
import { readout } from './Sidebar';
import { IconClose } from './Icons';

/**
 * Measurement tags. Positions come straight from the engine on every rendered
 * frame and are written to the node's transform by hand — routing sixty
 * position updates a second through React state would re-render the sidebar
 * and the status bar along with them.
 */
function MeasureLabels() {
  const engine = useViewer((s) => s.engine);
  const measurements = useViewer((s) => s.measurements);
  const unit = useViewer((s) => s.unit);
  const remove = useViewer((s) => s.removeMeasurement);
  const mm = useMm();
  const nodes = useRef(new Map<number, HTMLElement>());

  useEffect(() => {
    if (!engine) return;
    engine.setLabelSink((anchors) => {
      const visible = spreadLabels(anchors.filter((a) => !a.behind));
      for (const anchor of [...visible, ...anchors.filter((a) => a.behind)]) {
        const node = nodes.current.get(anchor.id);
        if (!node) continue;
        node.style.transform = `translate(-50%, -50%) translate(${anchor.x}px, ${anchor.y}px)`;
        node.style.visibility = anchor.behind ? 'hidden' : 'visible';
      }
    });
    return () => engine.setLabelSink(null);
  }, [engine]);

  if (!measurements.length) return null;

  return (
    <div className="tags">
      {measurements.map((measurement) => (
        <div
          key={measurement.id}
          className="tag"
          ref={(node) => {
            if (node) nodes.current.set(measurement.id, node);
            else nodes.current.delete(measurement.id);
          }}
        >
          <span className="tag-value num">{readout(measurement, unit, mm)}</span>
          <button
            type="button"
            className="tag-drop"
            onClick={() => remove(measurement.id)}
            aria-label="Delete this measurement"
            tabIndex={-1}
          >
            <IconClose size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Part names over the parts, Bambu Studio's "show labels". The list changes
 * only when the camera does, so it can go through React state at frame rate
 * without dragging anything else along: nothing else subscribes to it.
 */
function PartLabels() {
  const engine = useViewer((s) => s.engine);
  const on = useViewer((s) => s.display.labels);
  const [labels, setLabels] = useState<PartLabel[]>([]);

  useEffect(() => {
    if (!engine) return;
    engine.setPartLabelSink((next) => {
      setLabels((prev) => {
        if (
          prev.length === next.length &&
          prev.every((p, i) => p.id === next[i].id && Math.abs(p.x - next[i].x) < 0.5 && Math.abs(p.y - next[i].y) < 0.5)
        ) {
          return prev;
        }
        return next;
      });
    });
    return () => engine.setPartLabelSink(null);
  }, [engine]);

  if (!on || !labels.length) return null;
  return (
    <div className="plabels" aria-hidden>
      {labels.map((label) =>
        label.behind ? null : (
          <span
            key={label.id}
            className="plabel"
            style={{ transform: `translate(-50%, -50%) translate(${label.x}px, ${label.y}px)` }}
          >
            {label.name}
          </span>
        ),
      )}
    </div>
  );
}

/** What is under the cursor or selected, when no tool is out. */
function Readout() {
  const tool = useViewer((s) => s.measureTool);
  const hover = useViewer((s) => s.hover);
  const selection = useViewer((s) => s.selection);
  if (tool !== 'off') return null;
  const shown = hover ?? selection?.name;
  if (!shown) return null;

  return (
    <div className="tape" data-tone={hover ? 'hover' : 'held'}>
      <span className="tape-k">{hover ? 'Under the cursor' : 'Selected'}</span>
      <span className="tape-v">{shown}</span>
    </div>
  );
}

function Progress() {
  const status = useViewer((s) => s.status);
  const progress = useViewer((s) => s.progress);
  const note = useViewer((s) => s.progressNote);
  if (status !== 'loading') return null;

  return (
    <>
      <div className="loadbar">
        <div
          className="loadbar-fill"
          data-indeterminate={progress === null}
          style={{ width: progress === null ? undefined : `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="loadcard" role="status">
        <span className="spinner" />
        <span>{note || 'Working'}</span>
        {progress !== null && <span className="num">{Math.round(progress * 100)}%</span>}
      </div>
    </>
  );
}

/**
 * The browser can take the GPU context away at any time — a driver reset, a
 * laptop waking up, too many live canvases in other tabs. Saying so beats
 * leaving a black rectangle and letting the person guess.
 */
function ContextLost() {
  const lost = useViewer((s) => s.contextLost);
  if (!lost) return null;

  return (
    <div className="veil" role="alert">
      <div className="veil-card">
        <strong>The graphics context was interrupted</strong>
        <span>The browser reset the GPU connection. Rendering resumes on its own; reload the page if it does not.</span>
      </div>
    </div>
  );
}

const NAMED = ['STL', '3MF', 'STEP', 'OBJ', 'glTF'];

/** With no model open, the plate is still there; this says what to do with it. */
function EmptyPlate({ onOpen }: { onOpen: () => void }) {
  const openSample = useViewer((s) => s.openSample);
  return (
    <div className="empty-plate">
      <p className="empty-title">Drop a model on the plate</p>
      <p className="empty-sub">
        {NAMED.join(', ')} and {FORMATS.length - NAMED.length} more. The file stays on this device.
      </p>
      <div className="row-actions">
        <button type="button" className="btn" data-variant="primary" onClick={onOpen}>
          Choose a file
        </button>
        <button type="button" className="btn" data-variant="ghost" onClick={() => void openSample()}>
          Open the sample gear
        </button>
      </div>
    </div>
  );
}

export function Viewport({ dragging, onOpen }: { dragging: boolean; onOpen: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const attach = useViewer((s) => s.attach);
  const detach = useViewer((s) => s.detach);
  const status = useViewer((s) => s.status);
  const workspace = useViewer((s) => s.workspace);
  const tool = useViewer((s) => s.measureTool);
  const compact = useIsCompact();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;

    const store = useViewer.getState();
    const engine = new Engine(canvas, {
      onFrame: store.setFrame,
      onHover: store.setHover,
      onMeasure: store.setMeasurements,
      onMeasureRejected: (reason) => store.toast({ tone: 'info', title: 'Nothing to measure there', text: reason }),
      onSelect: store.setSelection,
      onParts: store.setParts,
      onTransform: () => useViewer.getState().onTransform(),
      onContextChange: (lost) => {
        store.setContextLost(lost);
        store.toast(
          lost
            ? { tone: 'error', title: 'The graphics context was interrupted', text: 'The browser reset the GPU connection.' }
            : { tone: 'success', title: 'Rendering resumed' },
        );
      },
    });
    engine.resize();
    attach(engine);

    const observer = new ResizeObserver(() => engine.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      detach();
      engine.dispose();
    };
  }, [attach, detach]);

  const empty = status === 'idle';
  const preview = workspace === 'preview';

  return (
    <div className="stage" ref={hostRef} data-tool={tool} data-workspace={workspace}>
      <canvas ref={canvasRef} aria-label="3D view of the model" />

      {!empty && <MeasureLabels />}
      {!empty && <PartLabels />}

      {!preview && <CanvasToolbar onOpen={onOpen} />}
      {preview && <PreviewLegend />}
      {!empty && <ToolPanels />}
      {!empty && (
        <div className="stage-corner">
          <Gizmo />
        </div>
      )}
      {!empty && !compact && <Readout />}
      {preview && <LayerSlider />}
      <ViewBar />

      {empty && <EmptyPlate onOpen={onOpen} />}

      <Progress />
      <ContextLost />

      {dragging && (
        <div className="veil">
          <div className="veil-card" data-tone="drop">
            <strong>Drop to open</strong>
            <span>Folders work too: textures and materials come along.</span>
          </div>
        </div>
      )}
    </div>
  );
}

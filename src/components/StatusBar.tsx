import { useViewer, useMm } from '@/store/useViewer';
import { count, dim } from '@/lib/format';
import { bedById } from '@/lib/printers';

const MODE_LABEL: Record<string, string> = {
  shaded: 'Shaded',
  wireframe: 'Wireframe',
  edges: 'Shaded with edges',
};

/**
 * Steady facts about the file along the bottom edge, out of the way of the
 * model: its size on each axis, its triangle count, how it is drawn, and
 * whether it fits the chosen printer. Anything that changes as the cursor moves
 * lives in the canvas instead, so the two never say the same thing twice.
 */
export function StatusBar() {
  const model = useViewer((s) => s.model);
  const unit = useViewer((s) => s.unit);
  const mode = useViewer((s) => s.display.renderMode);
  const projection = useViewer((s) => s.display.projection);
  const frame = useViewer((s) => s.frame);
  const plate = useViewer((s) => s.plate);
  const bedId = useViewer((s) => s.bedId);
  const mm = useMm();

  if (!model) {
    return (
      <footer className="statusbar area-status">
        <span className="status-item">Ready. Drop a file anywhere to begin.</span>
      </footer>
    );
  }

  const bed = bedById(bedId);

  return (
    <footer className="statusbar area-status">
      <span className="status-item" data-axis="x">
        <b>W</b>
        <span className="num">{dim(model.dimensions.x * mm, unit)}</span>
      </span>
      <span className="status-item" data-axis="y">
        <b>H</b>
        <span className="num">{dim(model.dimensions.y * mm, unit)}</span>
      </span>
      <span className="status-item" data-axis="z">
        <b>D</b>
        <span className="num">{dim(model.dimensions.z * mm, unit)}</span>
      </span>
      <span className="status-sep" />
      <span className="status-item num">{count(model.stats.triangles)} triangles</span>
      <span className="status-sep" />
      <span className="status-item">
        {MODE_LABEL[mode] ?? mode}, {projection}
      </span>
      {plate.cellMm !== null && (
        <>
          <span className="status-sep" />
          <span className="status-item num">Grid {Number(plate.cellMm.toPrecision(3))} mm</span>
        </>
      )}

      <span className="status-spacer" />

      {frame.quality < 1 && (
        <span className="status-item" data-tone="warn" title="Rendering below full resolution to hold the frame rate">
          {Math.round(frame.quality * 100)}% render scale
        </span>
      )}
      {plate.fits !== null && (
        <span className="status-item" data-tone={plate.fits ? 'ok' : 'bad'}>
          {plate.fits ? `Fits the ${bed.label.split(' — ')[0]}` : `Too big for the ${bed.label.split(' — ')[0]}`}
        </span>
      )}
    </footer>
  );
}

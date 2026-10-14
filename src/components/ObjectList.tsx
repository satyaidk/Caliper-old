import { useMemo, useState } from 'react';
import { useViewer } from '@/store/useViewer';
import { compact } from '@/lib/format';
import { IconEye, IconEyeOff, IconIsolate, IconSearch } from './Icons';

/** Rows are a fixed height so the list can draw only the ones on screen. */
const ROW = 30;
const VISIBLE_ROWS = 10;
const OVERSCAN = 6;

/**
 * Bambu Studio's object list: every part in the file, with a switch to hide it
 * and a way to look at it alone.
 *
 * An IFC building can carry ten thousand parts, so the list is windowed — only
 * the rows inside the scroll viewport exist in the DOM — and filterable by
 * name, which is how anyone finds one part in ten thousand anyway.
 */
export function ObjectList() {
  const parts = useViewer((s) => s.parts);
  const selection = useViewer((s) => s.selection);
  const setVisible = useViewer((s) => s.setPartVisible);
  const isolate = useViewer((s) => s.isolatePart);
  const selectPart = useViewer((s) => s.selectPart);
  const frameSelection = useViewer((s) => s.frameSelection);
  const [query, setQuery] = useState('');
  const [scroll, setScroll] = useState(0);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? parts.filter((p) => p.name.toLowerCase().includes(needle)) : parts;
  }, [parts, query]);

  const hidden = parts.filter((p) => !p.visible).length;
  const isolated = hidden > 0 && hidden === parts.length - 1;
  const start = Math.max(0, Math.floor(scroll / ROW) - OVERSCAN);
  const end = Math.min(shown.length, start + VISIBLE_ROWS + OVERSCAN * 2);
  const height = Math.min(shown.length, VISIBLE_ROWS) * ROW;

  return (
    <div className="objects">
      {parts.length > 8 && (
        <label className="search">
          <IconSearch />
          <input
            type="search"
            placeholder={`Filter ${parts.length.toLocaleString()} parts`}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setScroll(0);
            }}
          />
        </label>
      )}

      {shown.length === 0 ? (
        <p className="hint">No part name contains “{query}”.</p>
      ) : (
        <div
          className="objects-scroll"
          style={{ height }}
          onScroll={(event) => setScroll(event.currentTarget.scrollTop)}
          role="list"
          aria-label="Parts"
        >
          <div style={{ height: shown.length * ROW, position: 'relative' }}>
            {shown.slice(start, end).map((part, i) => (
              <div
                key={part.id}
                role="listitem"
                className="obj-row"
                data-selected={selection?.id === part.id}
                data-hidden={!part.visible}
                style={{ top: (start + i) * ROW, height: ROW }}
              >
                <button
                  type="button"
                  className="obj-eye"
                  onClick={() => setVisible(part.id, !part.visible)}
                  aria-label={part.visible ? `Hide ${part.name}` : `Show ${part.name}`}
                  title={part.visible ? 'Hide' : 'Show'}
                >
                  {part.visible ? <IconEye size={15} /> : <IconEyeOff size={15} />}
                </button>
                <button
                  type="button"
                  className="obj-name"
                  onClick={() => selectPart(part.id)}
                  onDoubleClick={() => {
                    selectPart(part.id);
                    frameSelection();
                  }}
                  title={`${part.name} — double-click to zoom to it`}
                >
                  {part.name}
                </button>
                <span className="obj-tris num" title={`${part.triangles.toLocaleString()} triangles`}>
                  {compact(part.triangles)}
                </span>
                <button
                  type="button"
                  className="obj-solo"
                  onClick={() => isolate(isolated && part.visible ? null : part.id)}
                  aria-label={`Show only ${part.name}`}
                  title={isolated && part.visible ? 'Show every part' : 'Show only this part'}
                >
                  <IconIsolate size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {hidden > 0 && (
        <div className="row-actions">
          <span className="hint num">
            {hidden.toLocaleString()} of {parts.length.toLocaleString()} hidden
          </span>
          <button type="button" className="btn" data-variant="ghost" onClick={() => isolate(null)}>
            Show all
          </button>
        </div>
      )}
    </div>
  );
}

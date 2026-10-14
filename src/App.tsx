import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useViewer } from '@/store/useViewer';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useHotkeys } from '@/hooks/useHotkeys';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { ACCEPT, baseOf } from '@/lib/formats';
import { TopBar } from '@/components/TopBar';
import { Sidebar } from '@/components/Sidebar';
import { Viewport } from '@/components/Viewport';
import { Home } from '@/components/Home';
import { StatusBar } from '@/components/StatusBar';
import { Toasts } from '@/components/Toasts';
import { Shortcuts } from '@/components/Shortcuts';

/**
 * A model can be handed to the page by URL — `?model=https://…/part.step` —
 * which is what makes a link to a specific part shareable at all. Only http(s)
 * is honoured: anything else is a scheme the fetch has no business following.
 */
function modelFromUrl(): { url: string; name: string } | null {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('model');
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.href);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const name = params.get('name') || baseOf(decodeURIComponent(url.pathname)) || 'model';
    return { url: url.href, name };
  } catch {
    return null;
  }
}

/**
 * The app shell, laid out the way Bambu Studio lays out its window: the top
 * bar across the full width, the sidebar on the left, the canvas taking the
 * rest, and a status line underneath. Home covers the sidebar and canvas
 * rather than replacing them, so the Engine and its GPU context survive a trip
 * to the start page.
 */
export default function App() {
  const inputRef = useRef<HTMLInputElement>(null);
  const open = useViewer((s) => s.open);
  const engine = useViewer((s) => s.engine);
  const model = useViewer((s) => s.model);
  const toast = useViewer((s) => s.toast);
  const openFromUrl = useViewer((s) => s.openFromUrl);
  const openSample = useViewer((s) => s.openSample);
  const workspace = useViewer((s) => s.workspace);
  const sidebarOpen = useViewer((s) => s.sidebarOpen);
  const sheetOpen = useViewer((s) => s.sheetOpen);
  const toggleSheet = useViewer((s) => s.toggleSheet);
  const theme = useViewer((s) => s.theme);
  const compact = useIsCompact();

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  const screenshot = useCallback(() => {
    if (!engine || !model) return;
    const link = document.createElement('a');
    link.href = engine.screenshot(2);
    link.download = `${model.name.replace(/\.[^.]+$/, '')}.png`;
    link.click();
    toast({ tone: 'success', title: 'Saved the view as PNG' });
  }, [engine, model, toast]);

  const dragging = useFileDrop((files) => void open(files));
  useHotkeys(useMemo(() => ({ open: openPicker, screenshot }), [openPicker, screenshot]));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Drawing a canvas nobody can see costs a frame each time.
  useEffect(() => {
    engine?.setPaused(workspace === 'home');
  }, [engine, workspace]);

  // Waits for the engine, because a model has nowhere to go without one.
  // `?sample` is what the installed app's "Open the sample gear" shortcut
  // and the website's demo links point at.
  const requested = useRef(false);
  useEffect(() => {
    if (!engine || requested.current) return;
    const params = new URLSearchParams(window.location.search);
    const target = modelFromUrl();
    if (!target && !params.has('sample')) return;
    requested.current = true;
    const loaded = target ? openFromUrl(target.url, target.name) : openSample();
    // `&tab=preview` opens straight into the layer view.
    void loaded.then(() => {
      const store = useViewer.getState();
      if (params.get('tab') === 'preview' && store.model) store.setWorkspace('preview');
    });
  }, [engine, openFromUrl, openSample]);

  // Installed as an app, Caliper registers for model files. This is the half
  // that makes double-clicking an STL in the file manager actually land here.
  useEffect(() => {
    if (!engine || !('launchQueue' in window)) return;
    const queue = window.launchQueue as LaunchQueue;
    queue.setConsumer(async (params) => {
      if (!params.files?.length) return;
      const files = await Promise.all(params.files.map((handle) => handle.getFile()));
      if (files.length) void open(files);
    });
  }, [engine, open]);

  // Opening the same file twice in a row should still reload it.
  const onPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length) void open(files);
    event.target.value = '';
  };

  const home = workspace === 'home';

  return (
    <div className="app" data-sidebar={sidebarOpen && !compact ? 'open' : 'closed'} data-workspace={workspace}>
      <TopBar onOpen={openPicker} onScreenshot={screenshot} />

      {!compact && sidebarOpen && (
        <div className="area-side" hidden={home}>
          <Sidebar />
        </div>
      )}

      <main className="area-work">
        <Viewport dragging={dragging} onOpen={openPicker} />
      </main>

      {home && (
        <div className="area-home">
          <Home onOpen={openPicker} />
        </div>
      )}

      {!compact && <StatusBar />}

      {compact && sheetOpen && !home && (
        <>
          <div className="sheet-scrim" onClick={() => toggleSheet(false)} />
          <div className="sheet" role="dialog" aria-label="Model settings">
            <button type="button" className="sheet-grab" onClick={() => toggleSheet(false)} aria-label="Close the settings" />
            <Sidebar />
          </div>
        </>
      )}

      <Toasts />
      <Shortcuts />

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT}
        onChange={onPick}
        className="sr-only"
        aria-hidden
        tabIndex={-1}
      />
    </div>
  );
}

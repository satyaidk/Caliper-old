import { useEffect, useRef, useState } from 'react';
import { useViewer } from '@/store/useViewer';
import { bytes, shortName } from '@/lib/format';
import { useIsCompact } from '@/hooks/useMediaQuery';
import { useInstall } from '@/hooks/useInstall';
import type { Workspace } from '@/types';
import {
  IconCamera,
  IconCaliper,
  IconChevron,
  IconDownload,
  IconHome,
  IconKeyboard,
  IconMoon,
  IconPrepare,
  IconPreview,
  IconSidebar,
  IconSun,
} from './Icons';
import { Kbd } from './ui';

const TABS: { id: Workspace; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'Home', icon: <IconHome size={16} /> },
  { id: 'prepare', label: 'Prepare', icon: <IconPrepare size={16} /> },
  { id: 'preview', label: 'Preview', icon: <IconPreview size={16} /> },
];

interface Props {
  onOpen: () => void;
  onScreenshot: () => void;
}

/**
 * The File menu. Everything in it is also a key or a button elsewhere; the menu
 * is where a person looks first, so it lists them all with their keys.
 */
function FileMenu({ onOpen, onScreenshot }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const model = useViewer((s) => s.model);
  const openSample = useViewer((s) => s.openSample);
  const close = useViewer((s) => s.close);
  const setShortcutsOpen = useViewer((s) => s.setShortcutsOpen);
  const { canInstall, install } = useInstall();

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <div className="menu" ref={root}>
      <button
        type="button"
        className="topbar-btn menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        File
        <IconChevron size={12} />
      </button>
      {open && (
        <div className="menu-list" role="menu">
          <button type="button" role="menuitem" className="menu-item" onClick={run(onOpen)}>
            <span>Open a model…</span>
            <Kbd>Ctrl O</Kbd>
          </button>
          <button type="button" role="menuitem" className="menu-item" onClick={run(() => void openSample())}>
            <span>Open the sample gear</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            disabled={!model}
            onClick={run(onScreenshot)}
          >
            <span>Save the view as PNG</span>
            <Kbd>Ctrl S</Kbd>
          </button>
          <button type="button" role="menuitem" className="menu-item" disabled={!model} onClick={run(close)}>
            <span>Close the model</span>
          </button>
          <div className="menu-sep" role="separator" />
          <button type="button" role="menuitem" className="menu-item" onClick={run(() => setShortcutsOpen(true))}>
            <span>Keyboard shortcuts</span>
            <Kbd>?</Kbd>
          </button>
          {canInstall && (
            <button type="button" role="menuitem" className="menu-item" onClick={run(() => void install())}>
              <span>Install Caliper as an app</span>
            </button>
          )}
          <a className="menu-item" role="menuitem" href="/">
            <span>About Caliper</span>
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * Bambu Studio's top bar: the dark slate strip with the menu at the left and
 * the workspace tabs beside it. In an installed app with window controls
 * overlay, this strip *is* the title bar, so its empty space drags the window.
 */
export function TopBar({ onOpen, onScreenshot }: Props) {
  const model = useViewer((s) => s.model);
  const workspace = useViewer((s) => s.workspace);
  const setWorkspace = useViewer((s) => s.setWorkspace);
  const theme = useViewer((s) => s.theme);
  const setTheme = useViewer((s) => s.setTheme);
  const toggleSidebar = useViewer((s) => s.toggleSidebar);
  const toggleSheet = useViewer((s) => s.toggleSheet);
  const sidebarOpen = useViewer((s) => s.sidebarOpen);
  const setShortcutsOpen = useViewer((s) => s.setShortcutsOpen);
  const compact = useIsCompact();
  const { canInstall, install } = useInstall();

  return (
    <header className="topbar area-top">
      <a className="topbar-brand" href="/" title="About Caliper">
        <IconCaliper />
        {!compact && <span className="topbar-word">Caliper</span>}
      </a>

      <FileMenu onOpen={onOpen} onScreenshot={onScreenshot} />

      <nav className="tabs" role="tablist" aria-label="Workspace">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            className="tab"
            aria-selected={workspace === tab.id}
            disabled={tab.id === 'preview' && !model}
            onClick={() => setWorkspace(tab.id)}
          >
            {tab.icon}
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <div className="topbar-file">
        {model && (
          <>
            <span className="badge-fmt" data-kind={model.pipeline}>
              {model.ext}
            </span>
            <span className="topbar-name" title={model.name}>
              {shortName(model.name, compact ? 16 : 40)}
            </span>
            {!compact && <span className="topbar-meta num">{bytes(model.bytes)}</span>}
          </>
        )}
      </div>

      <div className="topbar-actions">
        {canInstall && !compact && (
          <button type="button" className="topbar-btn topbar-install" onClick={() => void install()}>
            <IconDownload size={15} />
            Install app
          </button>
        )}
        <button
          type="button"
          className="topbar-btn topbar-icon"
          onClick={onScreenshot}
          disabled={!model}
          title="Save the view as PNG (Ctrl S)"
        >
          <IconCamera size={17} />
          <span className="sr-only">Save the view as PNG</span>
        </button>
        {!compact && (
          <button
            type="button"
            className="topbar-btn topbar-icon"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
          >
            <IconKeyboard size={17} />
            <span className="sr-only">Keyboard shortcuts</span>
          </button>
        )}
        <button
          type="button"
          className="topbar-btn topbar-icon"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          title={theme === 'dark' ? 'Switch to the light theme (Ctrl J)' : 'Switch to the dark theme (Ctrl J)'}
        >
          {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
          <span className="sr-only">Switch theme</span>
        </button>
        <button
          type="button"
          className="topbar-btn topbar-icon"
          aria-pressed={compact ? undefined : sidebarOpen}
          onClick={() => (compact ? toggleSheet(true) : toggleSidebar())}
          title="Sidebar (Ctrl B)"
        >
          <IconSidebar size={17} />
          <span className="sr-only">Show or hide the sidebar</span>
        </button>
      </div>
    </header>
  );
}

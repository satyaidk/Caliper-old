import { create } from 'zustand';
import type { Engine, FrameInfo, PlateInfo, SelectionInfo } from '@/viewer/Engine';
import { computeStats } from '@/viewer/analyze';
import { buildContext, loadModel, pickPrimary } from '@/viewer/loaders';
import { OVERHANG_DEFAULT } from '@/viewer/printability';
import { defaultUnitFor, extOf, specFor } from '@/lib/formats';
import { MM_PER, bedById } from '@/lib/printers';
import type {
  Axis,
  ClipState,
  Measurement,
  MeasureTool,
  ModelInfo,
  PartInfo,
  Printability,
  Projection,
  RenderMode,
  SourceUnit,
  Toast,
  UnitSystem,
  ViewPreset,
  Workspace,
} from '@/types';

/**
 * The single source of truth for anything the interface shows.
 *
 * The Engine owns the scene; this owns the decisions. Every button calls an
 * action here, the action tells the Engine what to do, and the Engine reports
 * back through the hooks wired up in Viewport.tsx. Components never touch the
 * Engine directly, so there is exactly one path from a click to a pixel.
 */

export type Status = 'idle' | 'loading' | 'ready';
export type Theme = 'dark' | 'light';

const PREFS_KEY = 'caliper.prefs.v2';
const THEME_KEY = 'caliper.theme';

export interface Display {
  renderMode: RenderMode;
  grid: boolean;
  shadows: boolean;
  projection: Projection;
  labels: boolean;
  overhang: boolean;
}

const DEFAULT_DISPLAY: Display = {
  renderMode: 'shaded',
  grid: true,
  shadows: true,
  projection: 'perspective',
  labels: false,
  overhang: false,
};

/**
 * The colours offered in the Filament section. Green comes first and is the
 * default: it is the colour a part wears in Bambu Studio out of the box, and
 * it stands clear of the canvas in both themes, where a light grey part
 * disappears into the light theme's grey plate.
 */
export const FILAMENTS: { name: string; hex: string }[] = [
  { name: 'Green', hex: '#00ae42' },
  { name: 'Light grey', hex: '#c8ccd2' },
  { name: 'White', hex: '#f1f1ec' },
  { name: 'Charcoal', hex: '#3b3e44' },
  { name: 'Orange', hex: '#ff6a13' },
  { name: 'Red', hex: '#c8312a' },
  { name: 'Yellow', hex: '#f2cf3c' },
  { name: 'Blue', hex: '#1663c7' },
  { name: 'Cyan', hex: '#1fa3c9' },
  { name: 'Purple', hex: '#6d4bc4' },
  { name: 'Pink', hex: '#ef80b0' },
  { name: 'Brown', hex: '#8a5a3c' },
];

/** Layer heights Bambu Studio's process presets ship with, in millimetres. */
export const LAYER_HEIGHTS = [0.08, 0.12, 0.16, 0.2, 0.24, 0.28];

/* --- preferences -----------------------------------------------------------
   Storage is unavailable in some privacy modes, and a remembered toggle is not
   worth a crash. Only the settings that describe *how you like to look at
   models* persist — anything tied to the file in front of you starts clean. */

interface Prefs {
  display: Display;
  unit: UnitSystem;
  sidebarOpen: boolean;
  bedId: string;
  filament: string;
  paintAuthored: boolean;
  overhangDeg: number;
  layerHeight: number;
}

function readPrefs(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
  } catch {
    return {};
  }
}

function writePrefs(prefs: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function rememberTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* ignore */
  }
}

/**
 * A remembered choice wins; otherwise follow the OS. The HTML entry stamps the
 * same value on <html> before first paint, so this only has to agree with it.
 */
function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* fall through to the OS preference */
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const saved = readPrefs();

export interface SectionState extends ClipState {
  on: boolean;
}

interface ViewerState {
  engine: Engine | null;
  status: Status;
  progress: number | null;
  progressNote: string;
  contextLost: boolean;

  workspace: Workspace;
  model: ModelInfo | null;
  parts: PartInfo[];
  report: Printability | null;
  reportPending: boolean;
  selection: SelectionInfo | null;
  hover: string | null;
  frame: FrameInfo;

  display: Display;
  unit: UnitSystem;
  sourceUnit: SourceUnit;
  theme: Theme;
  bedId: string;
  plate: PlateInfo;
  filament: string;
  paintAuthored: boolean;
  overhangDeg: number;

  section: SectionState;
  layerAt: number;
  layerHeight: number;
  explode: number;
  /** Bambu Studio's assembly view: the explode slider is out. */
  assembly: boolean;
  oriented: boolean;

  measureTool: MeasureTool;
  measurements: Measurement[];
  pendingPoints: number;

  sidebarOpen: boolean;
  sheetOpen: boolean;
  shortcutsOpen: boolean;
  toasts: Toast[];

  attach(engine: Engine): void;
  detach(): void;
  open(files: File[]): Promise<void>;
  openFromUrl(url: string, filename: string): Promise<void>;
  openSample(): Promise<void>;
  close(): void;

  setWorkspace(workspace: Workspace): void;
  setDisplay<K extends keyof Display>(key: K, value: Display[K]): void;
  setUnit(unit: UnitSystem): void;
  setSourceUnit(unit: SourceUnit): void;
  setTheme(theme: Theme): void;
  setBed(id: string): void;
  setFilament(hex: string, paintAuthored?: boolean): void;
  setOverhangDeg(degrees: number): void;

  setSection(patch: Partial<SectionState>): void;
  setLayerAt(at: number): void;
  setLayerHeight(height: number): void;
  setExplode(ratio: number): void;
  setAssembly(on: boolean): void;
  autoOrient(): void;
  resetOrientation(): void;

  setPartVisible(id: number, visible: boolean): void;
  isolatePart(id: number | null): void;
  selectPart(id: number): void;

  toggleSidebar(force?: boolean): void;
  toggleSheet(force?: boolean): void;
  setShortcutsOpen(open: boolean): void;

  setView(preset: ViewPreset): void;
  frameAll(): void;
  frameSelection(): void;
  clearSelection(): void;

  setMeasureTool(tool: MeasureTool): void;
  removeMeasurement(id: number): void;
  clearMeasurements(): void;
  undoMeasure(): void;

  setFrame(info: FrameInfo): void;
  setSelection(info: SelectionInfo | null): void;
  setHover(name: string | null): void;
  setMeasurements(list: Measurement[], pending: number): void;
  setContextLost(lost: boolean): void;
  setParts(parts: PartInfo[]): void;
  onTransform(): void;

  toast(t: Omit<Toast, 'id'>): void;
  dismiss(id: number): void;
}

let toastSeq = 0;
let analysisTimer = 0;
let overhangTimer = 0;

export const useViewer = create<ViewerState>((set, get) => {
  const persist = () => {
    const { display, unit, sidebarOpen, bedId, filament, paintAuthored, overhangDeg, layerHeight } = get();
    writePrefs({ display, unit, sidebarOpen, bedId, filament, paintAuthored, overhangDeg, layerHeight });
  };

  /** The plate under the model, at the right size for the file's units. */
  const syncPlate = () => {
    const { engine, bedId, sourceUnit } = get();
    if (!engine) return;
    set({ plate: engine.setPlate(bedById(bedId).size, MM_PER[sourceUnit]) });
  };

  /**
   * Preview is a height slice with overhangs shown; Prepare shows whatever
   * section and overhang setting the person chose. Both are derived here, so
   * switching tab never leaves the other tab's cut in place.
   */
  const syncView = () => {
    const { engine, workspace, section, layerAt, display, overhangDeg } = get();
    if (!engine) return;
    const preview = workspace === 'preview';
    const clip: ClipState | null = preview
      ? { axis: 'y', at: layerAt, flip: false }
      : section.on
        ? { axis: section.axis, at: section.at, flip: section.flip }
        : null;
    engine.setClip(clip);
    engine.setOverhang(preview || display.overhang, overhangDeg);
  };

  /** Printability is a full pass over the triangles, so it runs off the click. */
  const scheduleAnalysis = () => {
    window.clearTimeout(analysisTimer);
    set({ reportPending: true });
    analysisTimer = window.setTimeout(() => {
      const engine = get().engine;
      set({ report: engine?.analyse() ?? null, reportPending: false });
    }, 60);
  };

  const scheduleOverhang = () => {
    window.clearTimeout(overhangTimer);
    overhangTimer = window.setTimeout(() => {
      const { engine, report } = get();
      if (!engine || !report) return;
      set({ report: { ...report, overhangArea: engine.overhangArea() } });
    }, 120);
  };

  return {
    engine: null,
    status: 'idle',
    progress: null,
    progressNote: '',
    contextLost: false,

    workspace: 'home',
    model: null,
    parts: [],
    report: null,
    reportPending: false,
    selection: null,
    hover: null,
    frame: { fps: 0, quality: 1 },

    display: { ...DEFAULT_DISPLAY, ...(saved.display ?? {}) },
    unit: saved.unit ?? 'mm',
    sourceUnit: 'mm',
    theme: initialTheme(),
    bedId: saved.bedId ?? 'auto',
    plate: { cellMm: null, fits: null },
    filament: saved.filament ?? FILAMENTS[0].hex,
    paintAuthored: saved.paintAuthored ?? false,
    overhangDeg: saved.overhangDeg ?? OVERHANG_DEFAULT,

    section: { on: false, axis: 'z', at: 0.5, flip: false },
    layerAt: 1,
    layerHeight: saved.layerHeight ?? 0.2,
    explode: 1,
    assembly: false,
    oriented: false,

    measureTool: 'off',
    measurements: [],
    pendingPoints: 0,

    sidebarOpen: saved.sidebarOpen ?? true,
    sheetOpen: false,
    shortcutsOpen: false,
    toasts: [],

    attach(engine) {
      set({ engine });
      const { display, theme, filament, paintAuthored } = get();
      engine.setGridVisible(display.grid);
      engine.setShadowsEnabled(display.shadows);
      engine.setRenderMode(display.renderMode);
      engine.setProjection(display.projection);
      engine.setPartLabels(display.labels);
      engine.setTheme(theme);
      engine.setFilament(filament, paintAuthored);
      syncPlate();
      syncView();
    },

    detach() {
      set({ engine: null });
    },

    async open(files) {
      const engine = get().engine;
      if (!engine) return;

      const primary = pickPrimary(files);
      if (!primary) {
        get().toast({
          tone: 'error',
          title: 'Nothing to open',
          text: 'None of those files are in a format Caliper reads. Drop a mesh, CAD or BIM file.',
        });
        return;
      }

      const spec = specFor(primary.name)!;
      set({ status: 'loading', progress: null, progressNote: 'Reading file', selection: null });

      const ctx = buildContext(files, (fraction, note) =>
        set((s) => ({ progress: fraction, progressNote: note ?? s.progressNote })),
      );

      const started = performance.now();
      try {
        const { object, hasAuthoredMaterials } = await loadModel(primary, ctx);
        const stats = computeStats(object);
        if (!stats.meshes && !stats.vertices) {
          throw new Error('The file opened but contains no drawable geometry.');
        }

        const sourceUnit = defaultUnitFor(primary.name);
        set({ sourceUnit });
        engine.setModel(object, hasAuthoredMaterials);
        engine.setMeasureTool('off');
        const dimensions = engine.dimensions();

        set({
          status: 'ready',
          workspace: get().workspace === 'preview' ? 'preview' : 'prepare',
          progress: null,
          progressNote: '',
          selection: null,
          hover: null,
          measureTool: 'off',
          measurements: [],
          pendingPoints: 0,
          section: { ...get().section, on: false },
          layerAt: 1,
          explode: 1,
          assembly: false,
          oriented: false,
          parts: engine.partList(),
          report: null,
          model: {
            name: primary.name,
            ext: extOf(primary.name),
            pipeline: spec.pipeline,
            bytes: primary.size,
            parseMs: performance.now() - started,
            stats,
            dimensions,
            authored: hasAuthoredMaterials,
          },
        });
        syncPlate();
        syncView();
        scheduleAnalysis();

        get().toast({
          tone: 'success',
          title: `Opened ${primary.name}`,
          text: `${stats.triangles.toLocaleString()} triangles in ${Math.round(performance.now() - started)} ms`,
        });

        // Bambu Studio asks the same question when a part imports tiny: a file
        // drawn in metres reads as a speck when its numbers are taken as mm.
        const longest = Math.max(dimensions.x, dimensions.y, dimensions.z);
        if (sourceUnit === 'mm' && longest > 0 && longest < 1) {
          get().toast({
            tone: 'info',
            title: 'This part is under 1 mm across',
            text: 'Files drawn in metres read this small when their numbers are taken as millimetres.',
            action: { label: 'Read it as metres', run: () => get().setSourceUnit('m') },
          });
        }
      } catch (error) {
        set({ status: get().model ? 'ready' : 'idle', progress: null, progressNote: '' });
        get().toast({
          tone: 'error',
          title: `Could not open ${primary.name}`,
          text: error instanceof Error ? error.message : 'The file could not be read.',
        });
      } finally {
        // Blob URLs stay alive briefly so async texture fetches can finish.
        setTimeout(ctx.revoke, 12_000);
      }
    },

    async openFromUrl(url, filename) {
      set({ status: 'loading', progressNote: `Fetching ${filename}`, progress: null });
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`The server replied ${response.status}.`);
        const blob = await response.blob();
        await get().open([new File([blob], filename, { type: blob.type })]);
      } catch (error) {
        set({ status: get().model ? 'ready' : 'idle', progress: null, progressNote: '' });
        get().toast({
          tone: 'error',
          title: 'Download failed',
          text: error instanceof Error ? error.message : 'The file could not be fetched.',
        });
      }
    },

    async openSample() {
      const { gearFile } = await import('@/lib/sample');
      await get().open([await gearFile()]);
    },

    close() {
      get().engine?.clearModel();
      window.clearTimeout(analysisTimer);
      set({
        status: 'idle',
        workspace: 'home',
        model: null,
        parts: [],
        report: null,
        reportPending: false,
        selection: null,
        hover: null,
        measureTool: 'off',
        measurements: [],
        pendingPoints: 0,
        explode: 1,
        assembly: false,
        oriented: false,
      });
      syncPlate();
      syncView();
    },

    setWorkspace(workspace) {
      const { engine, measureTool } = get();
      // Preview is for looking at layers; tools that click on the part stay in Prepare.
      if (workspace !== 'prepare' && measureTool !== 'off') {
        engine?.setMeasureTool('off');
        set({ measureTool: 'off', pendingPoints: 0 });
      }
      set({ workspace });
      syncView();
    },

    setDisplay(key, value) {
      const engine = get().engine;
      const display = { ...get().display, [key]: value };
      set({ display });
      persist();
      if (!engine) return;

      switch (key) {
        case 'renderMode':
          engine.setRenderMode(display.renderMode);
          if (display.renderMode === 'edges' && engine.edgesTruncated) {
            get().toast({
              tone: 'info',
              title: 'Outlines stop partway',
              text: 'This model has more edges than can be drawn at speed. Shaded shows all of it.',
            });
          }
          break;
        case 'grid':
          engine.setGridVisible(display.grid);
          break;
        case 'shadows':
          engine.setShadowsEnabled(display.shadows);
          break;
        case 'projection':
          engine.setProjection(display.projection);
          break;
        case 'labels':
          engine.setPartLabels(display.labels);
          break;
        case 'overhang':
          syncView();
          break;
      }
    },

    setUnit(unit) {
      set({ unit });
      persist();
    },

    setSourceUnit(sourceUnit) {
      set({ sourceUnit });
      syncPlate();
    },

    setTheme(theme) {
      document.documentElement.dataset.theme = theme;
      rememberTheme(theme);
      get().engine?.setTheme(theme);
      set({ theme });
    },

    setBed(bedId) {
      set({ bedId });
      persist();
      syncPlate();
    },

    setFilament(hex, paintAuthored = get().paintAuthored) {
      set({ filament: hex, paintAuthored });
      persist();
      get().engine?.setFilament(hex, paintAuthored);
    },

    setOverhangDeg(overhangDeg) {
      set({ overhangDeg });
      persist();
      syncView();
      scheduleOverhang();
    },

    setSection(patch) {
      set((s) => ({ section: { ...s.section, ...patch } }));
      syncView();
    },

    setLayerAt(layerAt) {
      set({ layerAt });
      syncView();
    },

    setLayerHeight(layerHeight) {
      set({ layerHeight });
      persist();
    },

    setExplode(ratio) {
      get().engine?.setExplode(ratio);
      set({ explode: ratio });
    },

    setAssembly(assembly) {
      const engine = get().engine;
      if (assembly && !engine?.canExplode) {
        get().toast({
          tone: 'info',
          title: 'Nothing to pull apart',
          text: 'This file is a single part. The assembly view needs two or more.',
        });
        return;
      }
      if (!assembly) engine?.setExplode(1);
      set({ assembly, explode: assembly ? get().explode : 1 });
    },

    autoOrient() {
      const engine = get().engine;
      if (!engine || !get().model) return;
      if (!engine.autoOrient()) {
        get().toast({
          tone: 'info',
          title: 'No flat face to stand on',
          text: 'This part has no flat face on its outside, so it stays the way it is.',
        });
      }
    },

    resetOrientation() {
      get().engine?.resetOrientation();
    },

    setPartVisible(id, visible) {
      get().engine?.setPartVisible(id, visible);
    },

    isolatePart(id) {
      get().engine?.isolate(id);
    },

    selectPart(id) {
      get().engine?.select(id);
    },

    toggleSidebar(force) {
      set((s) => ({ sidebarOpen: force ?? !s.sidebarOpen }));
      persist();
    },

    toggleSheet(force) {
      set((s) => ({ sheetOpen: force ?? !s.sheetOpen }));
    },

    setShortcutsOpen(shortcutsOpen) {
      set({ shortcutsOpen });
      get().engine?.setPaused(shortcutsOpen);
    },

    setView(preset) {
      get().engine?.setView(preset);
    },

    frameAll() {
      get().engine?.frameAll();
    },

    frameSelection() {
      const { engine, selection } = get();
      if (engine && selection) engine.frameSelection(selection.id);
    },

    clearSelection() {
      get().engine?.select(null);
    },

    setMeasureTool(tool) {
      const { engine, measureTool, model, workspace } = get();
      if (!model) return;
      // Pressing the tool you are already holding puts it down.
      const next = tool === measureTool ? 'off' : tool;
      engine?.setMeasureTool(next);
      set({ measureTool: next, pendingPoints: 0 });
      if (next !== 'off' && workspace !== 'prepare') get().setWorkspace('prepare');
    },

    removeMeasurement(id) {
      get().engine?.removeMeasurement(id);
    },

    clearMeasurements() {
      get().engine?.clearMeasurements();
    },

    undoMeasure() {
      get().engine?.undoMeasurePoint();
    },

    setFrame(frame) {
      set({ frame });
    },

    setSelection(selection) {
      set({ selection });
    },

    setHover(hover) {
      if (get().hover !== hover) set({ hover });
    },

    setMeasurements(measurements, pendingPoints) {
      set({ measurements, pendingPoints });
    },

    setContextLost(contextLost) {
      set({ contextLost });
    },

    setParts(parts) {
      set({ parts });
    },

    onTransform() {
      const { engine, model } = get();
      if (!engine || !model) return;
      set({
        model: { ...model, dimensions: engine.dimensions() },
        explode: 1,
        oriented: engine.oriented,
        plate: engine.plateInfo,
      });
      syncView();
      scheduleOverhang();
    },

    toast(t) {
      const id = ++toastSeq;
      set((s) => ({ toasts: [...s.toasts, { ...t, id }].slice(-3) }));
      const life = t.action ? 12000 : t.tone === 'error' ? 9000 : 4200;
      window.setTimeout(() => get().dismiss(id), life);
    },

    dismiss(id) {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    },
  };
});

/** File units → millimetres, for the current file. */
export function useMm() {
  const sourceUnit = useViewer((s) => s.sourceUnit);
  return MM_PER[sourceUnit];
}

export type { Axis };

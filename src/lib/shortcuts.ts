import type { useViewer } from '@/store/useViewer';
import type { ViewPreset } from '@/types';

/**
 * The whole keyboard, in one table.
 *
 * The hotkey hook runs these and the shortcuts dialog lists them, from this
 * same array, so a key cannot be added in one place and forgotten in the
 * other. The letters follow Bambu Studio where it has an equivalent — the
 * number row for views, Z to fit, R to orient, F to lay on a face, U to
 * measure, Y for the assembly view — so muscle memory carries across.
 */

type Store = ReturnType<typeof useViewer.getState>;

export interface Actions {
  open: () => void;
  screenshot: () => void;
}

export interface Binding {
  /** What the dialog prints. */
  keys: string;
  /** `KeyboardEvent.key`, lower-cased. */
  key: string;
  /** Needs Ctrl (or ⌘ on a Mac). */
  mod?: boolean;
  group: 'Camera' | 'Tools' | 'Display' | 'App';
  label: string;
  run: (store: Store, actions: Actions) => void;
}

const view = (key: string, preset: ViewPreset, label: string): Binding => ({
  keys: key,
  key,
  group: 'Camera',
  label,
  run: (s) => s.setView(preset),
});

export const BINDINGS: Binding[] = [
  view('0', 'default', 'Default view'),
  view('1', 'top', 'Top'),
  view('2', 'bottom', 'Bottom'),
  view('3', 'front', 'Front'),
  view('4', 'rear', 'Rear'),
  view('5', 'left', 'Left'),
  view('6', 'right', 'Right'),
  view('7', 'iso', 'Isometric'),
  { keys: 'Z', key: 'z', group: 'Camera', label: 'Fit the part to the view', run: (s) => s.frameAll() },
  {
    keys: 'K',
    key: 'k',
    group: 'Camera',
    label: 'Perspective or orthographic',
    run: (s) => s.setDisplay('projection', s.display.projection === 'perspective' ? 'orthographic' : 'perspective'),
  },

  { keys: 'R', key: 'r', group: 'Tools', label: 'Auto orient', run: (s) => s.autoOrient() },
  { keys: 'F', key: 'f', group: 'Tools', label: 'Lay on face', run: (s) => s.setMeasureTool('lay') },
  { keys: 'U', key: 'u', group: 'Tools', label: 'Measure a distance', run: (s) => s.setMeasureTool('distance') },
  { keys: 'D', key: 'd', group: 'Tools', label: 'Measure a diameter', run: (s) => s.setMeasureTool('diameter') },
  { keys: 'A', key: 'a', group: 'Tools', label: 'Measure an angle', run: (s) => s.setMeasureTool('angle') },
  {
    keys: 'X',
    key: 'x',
    group: 'Tools',
    label: 'Section view',
    run: (s) => s.model && s.setSection({ on: !s.section.on }),
  },
  { keys: 'Y', key: 'y', group: 'Tools', label: 'Assembly view', run: (s) => s.model && s.setAssembly(!s.assembly) },
  { keys: 'Backspace', key: 'backspace', group: 'Tools', label: 'Undo the last point', run: (s) => s.undoMeasure() },
  {
    keys: 'Esc',
    key: 'escape',
    group: 'Tools',
    label: 'Put the tool away, then clear the selection',
    // One key, two jobs, in the order a person expects them.
    run: (s) => {
      if (s.measureTool !== 'off') s.setMeasureTool('off');
      else if (s.selection) s.clearSelection();
    },
  },

  { keys: 'Q', key: 'q', group: 'Display', label: 'Shaded', run: (s) => s.setDisplay('renderMode', 'shaded') },
  { keys: 'W', key: 'w', group: 'Display', label: 'Wireframe', run: (s) => s.setDisplay('renderMode', 'wireframe') },
  { keys: 'E', key: 'e', group: 'Display', label: 'Shaded with edges', run: (s) => s.setDisplay('renderMode', 'edges') },
  { keys: 'G', key: 'g', group: 'Display', label: 'Plate', run: (s) => s.setDisplay('grid', !s.display.grid) },
  { keys: 'S', key: 's', group: 'Display', label: 'Shadows', run: (s) => s.setDisplay('shadows', !s.display.shadows) },
  { keys: 'L', key: 'l', group: 'Display', label: 'Part labels', run: (s) => s.setDisplay('labels', !s.display.labels) },
  { keys: 'O', key: 'o', group: 'Display', label: 'Overhangs', run: (s) => s.setDisplay('overhang', !s.display.overhang) },

  { keys: 'Ctrl O', key: 'o', mod: true, group: 'App', label: 'Open a model', run: (_, a) => a.open() },
  { keys: 'Ctrl S', key: 's', mod: true, group: 'App', label: 'Save the view as PNG', run: (_, a) => a.screenshot() },
  { keys: 'Ctrl B', key: 'b', mod: true, group: 'App', label: 'Sidebar', run: (s) => s.toggleSidebar() },
  {
    keys: 'Ctrl J',
    key: 'j',
    mod: true,
    group: 'App',
    label: 'Light or dark theme',
    run: (s) => s.setTheme(s.theme === 'dark' ? 'light' : 'dark'),
  },
  { keys: '?', key: '?', group: 'App', label: 'This list', run: (s) => s.setShortcutsOpen(true) },
];

export const GROUPS: Binding['group'][] = ['Camera', 'Tools', 'Display', 'App'];

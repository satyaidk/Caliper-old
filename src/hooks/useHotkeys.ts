import { useEffect } from 'react';
import { useViewer } from '@/store/useViewer';
import { BINDINGS, type Actions } from '@/lib/shortcuts';

const EDITABLE = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/**
 * Runs the key table in lib/shortcuts.ts. Every key there is also a button
 * you can see, and the buttons name the same keys in their tooltips.
 */
export function useHotkeys(actions: Actions) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (EDITABLE.has(target.tagName) || target.isContentEditable)) return;

      const store = useViewer.getState();
      // A dialog owns the keyboard while it is open; it closes itself on Esc.
      if (store.shortcutsOpen) return;

      const key = event.key.toLowerCase();
      const mod = event.metaKey || event.ctrlKey;
      // Space and Enter already belong to whatever control has focus.
      if ((key === ' ' || key === 'enter') && target?.tagName === 'BUTTON') return;
      if (event.altKey) return;

      const binding = BINDINGS.find((b) => b.key === key && Boolean(b.mod) === mod);
      if (!binding) return;
      event.preventDefault();
      binding.run(store, actions);
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [actions]);
}

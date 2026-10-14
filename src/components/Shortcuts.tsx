import { useEffect, useRef } from 'react';
import { useViewer } from '@/store/useViewer';
import { BINDINGS, GROUPS } from '@/lib/shortcuts';
import { IconClose } from './Icons';

/** Bambu Studio's keyboard shortcuts list (Shift + ?), from the same table the keys run on. */
export function Shortcuts() {
  const open = useViewer((s) => s.shortcutsOpen);
  const setOpen = useViewer((s) => s.setShortcutsOpen);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="dialog"
      aria-labelledby="shortcuts-title"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <header className="dialog-head">
        <h2 id="shortcuts-title">Keyboard shortcuts</h2>
        <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close">
          <IconClose />
        </button>
      </header>
      <div className="dialog-body shortcuts">
        {GROUPS.map((group) => (
          <section key={group}>
            <h3>{group}</h3>
            <dl>
              {BINDINGS.filter((b) => b.group === group).map((binding) => (
                <div key={binding.keys} className="shortcut">
                  <dt>{binding.label}</dt>
                  <dd>
                    <kbd className="kbd">{binding.keys}</kbd>
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
      <p className="dialog-foot">On a Mac, Ctrl is ⌘.</p>
    </dialog>
  );
}

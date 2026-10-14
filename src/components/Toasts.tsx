import { useViewer } from '@/store/useViewer';
import { IconClose } from './Icons';

export function Toasts() {
  const toasts = useViewer((s) => s.toasts);
  const dismiss = useViewer((s) => s.dismiss);
  if (!toasts.length) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className="toast" key={toast.id} data-tone={toast.tone}>
          <div className="toast-body">
            <p className="toast-title">{toast.title}</p>
            {toast.text && <p className="toast-text">{toast.text}</p>}
            {toast.action && (
              <button
                type="button"
                className="toast-action"
                onClick={() => {
                  toast.action?.run();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
          <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
            <IconClose />
          </button>
        </div>
      ))}
    </div>
  );
}

import { useId, useState, type ReactNode } from 'react';
import { IconChevron } from './Icons';

/**
 * The handful of controls every panel is built from. They mirror Bambu
 * Studio's widgets — square icon buttons with a tooltip that names the key,
 * segmented pickers, a pill switch, collapsible sidebar sections — so the whole
 * app is assembled from the same few parts and reads as one tool.
 */

interface ToolButtonProps {
  label: string;
  keys?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
  /** Where the tooltip opens. Toolbars at the top of the canvas open below. */
  tip?: 'below' | 'above' | 'right';
  variant?: 'canvas' | 'bar';
}

export function ToolButton({
  label,
  keys,
  active,
  disabled,
  onClick,
  children,
  tip = 'below',
  variant = 'canvas',
}: ToolButtonProps) {
  return (
    <button
      type="button"
      className="tool"
      data-variant={variant}
      aria-pressed={active ?? undefined}
      aria-label={label}
      aria-keyshortcuts={keys}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
      <span className="tip" data-at={tip} role="presentation">
        {label}
        {keys && <kbd className="kbd">{keys}</kbd>}
      </span>
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; title?: string }[];
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

/** A row of mutually exclusive choices, like Bambu's Global / Objects switch. */
export function Segmented<T extends string>({ label, value, options, onChange, size = 'md' }: SegmentedProps<T>) {
  return (
    <div className="seg" role="radiogroup" aria-label={label} data-size={size}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          className="seg-btn"
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="switch"
      onClick={() => onChange(!checked)}
    >
      <span className="switch-track" aria-hidden>
        <span className="switch-thumb" />
      </span>
      <span className="switch-label">{label}</span>
    </button>
  );
}

interface SideSectionProps {
  icon: ReactNode;
  title: string;
  /** Right-aligned extra in the header: a count, a reset button. */
  aside?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * A sidebar section with a header bar that folds it away, as Bambu Studio's
 * Printer / Filament / Process blocks do. Open state lives here, not in the
 * store: which sections are folded is not worth remembering across files.
 */
export function SideSection({ icon, title, aside, defaultOpen = true, children }: SideSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  return (
    <section className="side-section" data-open={open}>
      <div className="side-head">
        <button
          type="button"
          className="side-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="side-icon">{icon}</span>
          <span className="side-title">{title}</span>
          <span className="side-chevron">
            <IconChevron />
          </span>
        </button>
        {aside && <div className="side-aside">{aside}</div>}
      </div>
      {open && (
        <div className="side-body" id={bodyId}>
          {children}
        </div>
      )}
    </section>
  );
}

/** A label and a value on one line, the value right-aligned in tabular figures. */
export function Field({ label, value, tone }: { label: ReactNode; value: ReactNode; tone?: 'ok' | 'warn' | 'bad' }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value num" data-tone={tone}>
        {value}
      </span>
    </div>
  );
}

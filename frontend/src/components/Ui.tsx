// Shared buttons, fields, banners, dialogs, and icons matching the Haven redesign design system.
import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

export const Arrow = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="M4 10h11M11 6l4 4-4 4" />
  </svg>
);

export const Spark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c.4 5.7 4.3 9.6 10 10-5.7.4-9.6 4.3-10 10-.4-5.7-4.3-9.6-10-10 5.7-.4 9.6-4.3 10-10Z" />
  </svg>
);

export const Leaf = () => (
  <svg viewBox="0 0 42 42" aria-hidden="true">
    <path d="M34 7C18 8 8 17 8 31c8 1 22-3 26-24Z" />
    <path d="M8 34c5-8 11-13 20-18" />
  </svg>
);

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "glass" | "ghost" | "danger";
  withArrow?: boolean;
};

export function Button({
  variant = "primary",
  className = "",
  withArrow = false,
  children,
  ...props
}: BtnProps) {
  return (
    <button className={`button ${variant} ${className}`} {...props}>
      <span>{children}</span>
      {withArrow && <Arrow />}
    </button>
  );
}

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error ? (
        <p className="help" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function ErrorSummary({
  title,
  items,
}: {
  title: string;
  items: { href: string; text: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [items]);
  if (!items.length) return null;
  return (
    <div
      className="error-summary panel"
      role="alert"
      tabIndex={-1}
      ref={ref}
      aria-labelledby="error-title"
      style={{
        border: "1px solid var(--wine)",
        background: "var(--blush)",
        padding: "16px 20px",
        borderRadius: "16px",
        marginBottom: "20px",
      }}
    >
      <h3 id="error-title" style={{ color: "var(--wine)", margin: "0 0 8px" }}>
        {title}
      </h3>
      <ul style={{ margin: 0, paddingLeft: "20px" }}>
        {items.map((item) => (
          <li key={item.href}>
            <a href={item.href} style={{ color: "var(--wine)", textDecoration: "underline" }}>
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  className = "",
  open = true,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  open?: boolean;
}) {
  const headingId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previously = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusable = root?.querySelector<HTMLElement>("button, [href], input, select, textarea");
    focusable?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab" || !root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>("button, [href], input, select, textarea")].filter(
        (el) => !el.hasAttribute("disabled"),
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previously?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        className={`dialog-panel ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        ref={ref}
      >
        <div className="dialog-header">
          <h2 id={headingId}>{title}</h2>
          <button
            type="button"
            className="dialog-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Status({ value }: { value: string }) {
  const clean = value.replace("_", " ");
  return <span className={`band-pill ${value}`}>{clean}</span>;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "10px",
        color: "var(--muted)",
        padding: "16px",
      }}
      role="status"
    >
      <span
        className="spin"
        style={{
          display: "inline-block",
          width: "18px",
          height: "18px",
          border: "2px solid var(--line)",
          borderTopColor: "var(--wine)",
          borderRadius: "50%",
        }}
      />
      <span>{label}…</span>
    </div>
  );
}

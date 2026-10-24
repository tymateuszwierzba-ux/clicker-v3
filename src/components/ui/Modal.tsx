"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const previous = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && ref.current) {
        const nodes = ref.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (!nodes.length) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const timer = window.setTimeout(() => {
      const firstInput = ref.current?.querySelector<HTMLElement>("input, textarea, select, button");
      firstInput?.focus();
    }, 40);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const width = size === "sm" ? "440px" : size === "lg" ? "820px" : "560px";

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        previous.current = document.activeElement as HTMLButtonElement;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={title} ref={ref} style={{ width: `min(${width}, 100%)` }}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
          <div>
            <h2 className="text-lg leading-tight">{title}</h2>
            {subtitle ? <p className="mt-1 text-xs muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-xs" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--line)] px-5 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  busy,
  destructive,
  children,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-sm" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={destructive ? "btn btn-sm btn-danger" : "btn btn-sm btn-gold"} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm muted">{body}</div>
      {children}
    </Modal>
  );
}

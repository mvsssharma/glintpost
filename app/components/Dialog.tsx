"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

type DialogProps = {
  /** Controls the native modal state. */
  open: boolean;
  /** Fired when the dialog closes (Escape, backdrop, or programmatic). */
  onClose: () => void;
  /** Optional standard header rendered inside the padded body. */
  title?: ReactNode;
  children: ReactNode;
  /** Override the default 560px max width. */
  width?: number;
  /** Extra class(es) on the <dialog> element. */
  className?: string;
  /**
   * Render children directly instead of wrapping them in the standard
   * `.dialog-body` (+ optional `.dialog-title`). Use for dialogs that supply
   * their own internal layout.
   */
  bare?: boolean;
};

/**
 * Shared modal built on the native <dialog> element. Centralizes the
 * showModal()/close() lifecycle, Escape/backdrop dismissal, and the global
 * `.dialog` styling (centered via `dialog { margin: auto }` in globals.css).
 */
export function Dialog({
  open,
  onClose,
  title,
  children,
  width,
  className,
  bare = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    else if (!open && dlg.open) dlg.close();
  }, [open]);

  const style = width
    ? ({ "--dialog-width": `${width}px` } as CSSProperties)
    : undefined;

  return (
    <dialog
      ref={ref}
      className={className ? `dialog ${className}` : "dialog"}
      style={style}
      onClose={onClose}
      // Click on the backdrop (event target is the <dialog> itself, since the
      // body fills the box) dismisses the modal.
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {bare ? (
        children
      ) : (
        <div className="dialog-body">
          {title != null && <div className="dialog-title">{title}</div>}
          {children}
        </div>
      )}
    </dialog>
  );
}

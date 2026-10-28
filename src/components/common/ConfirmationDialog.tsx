import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isolateModalBackground } from "./modalIsolation";
import { getExperience } from "../../app/experience";

interface Props {
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  destructive?: boolean;
}

/** Keeps consequential local actions in the page, with a deliberate safe default. */
export function ConfirmationDialog({ title, children, cancelLabel, confirmLabel, onCancel, onConfirm, destructive = false }: Props) {
  const titleId = useId();
  const detailId = useId();
  const scrim = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const opener = document.activeElement;
    cancel.current?.focus({ preventScroll: true });
    const restoreBackground = isolateModalBackground(scrim.current);
    return () => {
      restoreBackground();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(<div ref={scrim} className={`confirmation-scrim confirmation-${getExperience() ?? "classic"}`}>
    <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={detailId} onKeyDown={(event) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
      if (event.key === "Tab") {
        event.preventDefault();
        (document.activeElement === cancel.current ? confirm.current : cancel.current)?.focus();
      }
    }}>
      <h2 id={titleId}>{title}</h2>
      <div id={detailId} className="confirmation-detail">{children}</div>
      <div className="confirmation-actions">
        <button ref={cancel} type="button" onClick={onCancel}>{cancelLabel}</button>
        <button ref={confirm} className={destructive ? "confirmation-destructive" : ""} type="button" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </section>
  </div>, document.body);
}

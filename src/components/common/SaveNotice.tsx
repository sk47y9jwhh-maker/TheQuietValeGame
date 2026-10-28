import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckCircle2, HardDrive, TriangleAlert } from "lucide-react";
import type { StorageResult } from "../../app/browserStorage";

interface SaveNoticeProps {
  result: StorageResult;
  loadProtected: boolean;
  simulated?: boolean;
  onRetry: () => void;
  onHeightChange: (height: number) => void;
}

export function SaveNotice({ result, loadProtected, simulated, onRetry, onHeightChange }: SaveNoticeProps) {
  const [hadFailure, setHadFailure] = useState(false);
  const region = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const visible = !result.ok || hadFailure;
  useEffect(() => {
    if (!result.ok) {
      setHadFailure(true);
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body && !region.current?.contains(active)) returnFocus.current = active;
    }
  }, [result.ok]);
  useLayoutEffect(() => {
    const node = region.current;
    if (!node) { onHeightChange(0); return; }
    const measure = () => onHeightChange(Math.ceil(node.getBoundingClientRect().height));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, result.ok, onHeightChange]);
  if (!visible) return null;

  function continuePlaying() {
    const previous = returnFocus.current;
    const target = previous?.isConnected && !previous.closest("details:not([open]), [hidden], [inert]") && previous.getClientRects().length
      ? previous
      : Array.from(document.querySelectorAll<HTMLElement>("main button:not([disabled]), main select:not([disabled]), main a"))
        .find((element) => !element.closest("[hidden], [inert]") && element.getClientRects().length);
    if (target) target.focus({ preventScroll: true });
    else {
      const heading = document.querySelector<HTMLElement>("main h1, main h2");
      if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    }
    setHadFailure(false);
  }

  return (
    <section ref={region} className={`save-notice ${result.ok ? "save-recovered" : "save-failed"}`} role={result.ok ? "status" : "alert"} aria-label="Local save status">
      {result.ok ? <CheckCircle2 size={23} aria-hidden="true" /> : <TriangleAlert size={23} aria-hidden="true" />}
      <div>
        <strong>{result.ok ? "Your confirmed progress is saved." : loadProtected ? "Stored progress could not be loaded." : "Your latest changes are not saved."}</strong>
        <p>{result.ok
          ? "Saved in this browser on this device. Unconfirmed choices stay in this tab."
          : loadProtected
            ? "Existing saved data has been kept unchanged. You can play in this tab, but this session will not be saved. Reload to try loading the stored progress again."
            : `${result.problem === "full" ? "This browser’s save space is full." : "This browser could not save the changes."} Keep this tab open and try saving again.`}</p>
        {simulated && <small>Comparison simulation · Turn off in the demo controls to resume saving.</small>}
      </div>
      {!loadProtected && <button type="button" onClick={result.ok ? continuePlaying : onRetry}>
        {!result.ok && <HardDrive size={17} aria-hidden="true" />}{result.ok ? "Continue playing" : "Retry save"}
      </button>}
    </section>
  );
}

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

interface ModalDialogProps {
  open: boolean;
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  size?: "default" | "wide";
}

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("hidden") && !element.getAttribute("aria-hidden")
  );
}

export function ModalDialog({
  open,
  title,
  description,
  children,
  onClose,
  initialFocusRef,
  size = "default"
}: ModalDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusInitialElement = () => {
      if (initialFocusRef?.current) {
        initialFocusRef.current.focus();
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const [firstFocusable] = getFocusableElements(panel);
      (firstFocusable ?? panel).focus();
    };

    focusInitialElement();
    const timeoutId = window.setTimeout(focusInitialElement, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const focusableElements = getFocusableElements(panel);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [initialFocusRef, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 py-4 backdrop-blur-sm sm:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`grid max-h-[min(92vh,960px)] w-full min-w-0 gap-5 overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(34,26,21,0.96)_0%,rgba(22,18,15,0.98)_100%)] px-5 py-5 shadow-[0_28px_120px_rgba(0,0,0,0.46)] backdrop-blur-xl ${
          size === "wide" ? "max-w-5xl" : "max-w-2xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="m-0 text-2xl font-semibold tracking-tight text-ink-50">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="m-0 mt-1 text-sm text-ink-200">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-ink-50 transition-colors hover:border-white/20 hover:bg-white/10"
            onClick={onClose}
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>
  );
}

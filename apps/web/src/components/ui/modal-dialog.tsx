import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

interface ModalDialogProps {
  open: boolean;
  title: string;
  header?: ReactNode;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => boolean | void;
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
  header,
  description,
  children,
  onClose,
  onEscapeKeyDown,
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

        if (onEscapeKeyDown?.(event) === false) {
          return;
        }

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
  }, [initialFocusRef, onClose, onEscapeKeyDown, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/72 px-4 py-4 backdrop-blur-sm sm:px-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`grid max-h-[96vh] w-full min-w-0 gap-4 overflow-hidden rounded-[22px] border border-white/8 bg-canvas-900 px-4 py-4 shadow-[0_30px_120px_rgba(0,0,0,0.44)] sm:px-5 sm:py-5 ${
          size === "wide" ? "max-w-6xl" : "max-w-2xl"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {header ? (
              <>
                <h2 id={titleId} className="sr-only">
                  {title}
                </h2>
                {header}
              </>
            ) : (
              <h2 id={titleId} className="m-0 text-[1.65rem] font-semibold tracking-[-0.03em] text-ink-50">
                {title}
              </h2>
            )}
            {description ? (
              <p id={descriptionId} className="m-0 mt-1 text-sm text-ink-300">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06]"
            onClick={onClose}
            aria-label="Close dialog"
          >
            Close
          </button>
        </div>
        <div
          className="min-h-0 overflow-x-hidden overflow-y-auto pr-2"
          style={{ scrollbarGutter: "stable" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

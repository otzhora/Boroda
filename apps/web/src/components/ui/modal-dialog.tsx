import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";

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
  variant?: "default" | "flat";
  showHeader?: boolean;
  showCloseButton?: boolean;
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
  size = "default",
  variant = "default",
  showHeader = true,
  showCloseButton = true
}: ModalDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onEscapeKeyDownRef = useRef(onEscapeKeyDown);
  const [hasBodyOverflow, setHasBodyOverflow] = useState(false);
  const headerLayoutClass =
    size === "wide" && showCloseButton
      ? "grid items-start gap-3 sm:grid-cols-[minmax(0,1fr)_auto] xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,20rem)] xl:gap-8"
      : showCloseButton
        ? "flex items-start justify-between gap-3"
        : "grid gap-3";
  const bodyClassName =
    size === "wide" && hasBodyOverflow
      ? "min-h-0 overflow-x-hidden overflow-y-auto pr-2"
      : "min-h-0 overflow-x-hidden overflow-y-auto";
  const panelClassName =
    variant === "flat"
      ? `grid max-h-[96vh] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-[16px] border border-white/10 bg-canvas-900 shadow-[0_24px_72px_rgba(0,0,0,0.32)] ${
          size === "wide" ? "max-w-[94rem]" : "max-w-3xl"
        }`
      : `grid max-h-[96vh] w-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-5 overflow-hidden rounded-[22px] border border-white/8 bg-canvas-900 px-4 py-4 shadow-[0_30px_120px_rgba(0,0,0,0.44)] sm:px-6 sm:py-6 ${
          size === "wide" ? "max-w-[94rem]" : "max-w-2xl"
        }`;
  const titleClassName =
    variant === "flat"
      ? "m-0 text-[1.4rem] font-semibold tracking-[-0.025em] text-ink-50"
      : "m-0 text-[1.65rem] font-semibold tracking-[-0.03em] text-ink-50";
  const closeButtonClassName =
    variant === "flat"
      ? "inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.05] xl:justify-self-start"
      : "inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06] xl:justify-self-start";

  useEffect(() => {
    onCloseRef.current = onClose;
    onEscapeKeyDownRef.current = onEscapeKeyDown;
  }, [onClose, onEscapeKeyDown]);

  useEffect(() => {
    if (!open) {
      setHasBodyOverflow(false);
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

        if (onEscapeKeyDownRef.current?.(event) === false) {
          return;
        }

        onCloseRef.current();
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
  }, [initialFocusRef, open]);

  useEffect(() => {
    if (!open || size !== "wide") {
      setHasBodyOverflow(false);
      return;
    }

    const body = bodyRef.current;
    if (!body) {
      return;
    }

    let frameId = 0;

    const updateOverflow = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
        const nextHasOverflow = body.scrollHeight > body.clientHeight + 1;
        setHasBodyOverflow((current) => (current === nextHasOverflow ? current : nextHasOverflow));
      });
    };

    updateOverflow();

    const handleResize = () => {
      updateOverflow();
    };

    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => {
        updateOverflow();
      });
      resizeObserver.observe(body);

      const content = body.firstElementChild;
      if (content) {
        resizeObserver.observe(content);
      }
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, [open, size, children]);

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
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
      >
        {showHeader ? (
          <div className="w-full">
            <div className={headerLayoutClass}>
              <div className="min-w-0">
                {header ? (
                  <>
                    <h2 id={titleId} className="sr-only">
                      {title}
                    </h2>
                    {header}
                  </>
                ) : (
                  <h2 id={titleId} className={titleClassName}>
                    {title}
                  </h2>
                )}
                {description ? (
                  <p id={descriptionId} className="m-0 mt-1 text-sm text-ink-300">
                    {description}
                  </p>
                ) : null}
              </div>
              {showCloseButton ? (
                <button
                  type="button"
                  className={closeButtonClassName}
                  onClick={onClose}
                  aria-label="Close dialog"
                >
                  Close
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="sr-only">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
        )}
        <div ref={bodyRef} className={bodyClassName}>
          <div className="min-h-0 w-full">{children}</div>
        </div>
      </div>
    </div>
  );
}

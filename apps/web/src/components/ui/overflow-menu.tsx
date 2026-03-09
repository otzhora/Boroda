import { useEffect, useRef, useState, type ReactNode } from "react";

interface OverflowMenuProps {
  buttonLabel: string;
  children: ReactNode;
  align?: "left" | "right";
  buttonText?: string;
  buttonContent?: ReactNode;
  buttonClassName?: string;
  menuClassName?: string;
}

export function OverflowMenu({
  buttonLabel,
  children,
  align = "right",
  buttonText,
  buttonContent,
  buttonClassName,
  menuClassName
}: OverflowMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={
          buttonClassName ??
          "inline-flex min-h-10 min-w-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-2.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900"
        }
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={buttonLabel}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        {buttonContent ? (
          buttonContent
        ) : buttonText ? (
          <span>{buttonText}</span>
        ) : (
          <>
            <span className="sr-only">{buttonLabel}</span>
            <span aria-hidden="true" className="grid gap-1">
              <span className="block h-0.5 w-4 rounded-full bg-current" />
              <span className="block h-0.5 w-4 rounded-full bg-current" />
              <span className="block h-0.5 w-4 rounded-full bg-current" />
            </span>
          </>
        )}
      </button>

      {isOpen ? (
        <div
          className={`${menuClassName ?? "absolute top-[calc(100%+0.5rem)] z-30 grid min-w-[220px] gap-3 rounded-[10px] border border-white/8 bg-canvas-925 p-3 shadow-[0_8px_24px_rgba(0,0,0,0.24)]"} ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

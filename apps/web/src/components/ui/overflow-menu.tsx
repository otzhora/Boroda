import { useEffect, useRef, useState, type ReactNode } from "react";

interface OverflowMenuProps {
  buttonLabel: string;
  children: ReactNode;
  align?: "left" | "right";
}

export function OverflowMenu({
  buttonLabel,
  children,
  align = "right"
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
        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-white/[0.06]"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={buttonLabel}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        <span className="sr-only">{buttonLabel}</span>
        <span aria-hidden="true" className="grid gap-1">
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
          <span className="block h-0.5 w-4 rounded-full bg-current" />
        </span>
      </button>

      {isOpen ? (
        <div
          className={`absolute top-[calc(100%+0.5rem)] z-30 grid min-w-[220px] gap-1 rounded-[16px] border border-white/8 bg-canvas-900 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.34)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
          onClickCapture={() => {
            setIsOpen(false);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

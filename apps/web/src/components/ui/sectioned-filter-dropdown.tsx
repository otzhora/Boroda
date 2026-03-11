import { useEffect, useId, useRef, useState, type ReactNode } from "react";

interface FilterSection {
  id: string;
  label: string;
}

interface SectionedFilterDropdownProps {
  title: string;
  hotkeySignal: number;
  hasFilters: boolean;
  sections: FilterSection[];
  initialSection: string;
  renderSection: (sectionId: string) => ReactNode;
  onClear: () => void;
  activeButtonClassName: string;
  inactiveButtonClassName: string;
  widthClassName?: string;
}

export function SectionedFilterDropdown(props: SectionedFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [section, setSection] = useState(props.initialSection);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const widthClassName = props.widthClassName ?? "w-[min(52rem,calc(100vw-2.5rem))]";

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
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
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

  useEffect(() => {
    if (props.hotkeySignal === 0) {
      return;
    }

    setIsOpen((current) => !current);
  }, [props.hotkeySignal]);

  const sectionButtonClassName = (current: string) =>
    `flex w-full items-center justify-between rounded-[8px] px-3 py-2 text-left text-sm ${
      section === current
        ? "bg-canvas-900 text-ink-50"
        : "text-ink-200 hover:bg-white/[0.03] hover:text-ink-50"
    }`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        className={props.hasFilters ? props.activeButtonClassName : props.inactiveButtonClassName}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? titleId : undefined}
        onClick={() => {
          setIsOpen((current) => !current);
        }}
      >
        Filter
      </button>
      {isOpen ? (
        <div
          id={titleId}
          role="dialog"
          aria-label={props.title}
          className={`fixed left-1/2 top-[4.25rem] z-30 grid ${widthClassName} -translate-x-1/2 grid-rows-[auto_1fr_auto] overflow-hidden rounded-[10px] border border-white/8 bg-canvas-925 shadow-[0_8px_24px_rgba(0,0,0,0.24)]`}
        >
          <div className="grid min-h-[22rem] grid-cols-[13rem_minmax(0,1fr)]">
            <div className="border-r border-white/8 p-3">
              <div className="grid gap-1">
                {props.sections.map((item) => (
                  <button key={item.id} type="button" className={sectionButtonClassName(item.id)} onClick={() => setSection(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">{props.renderSection(section)}</div>
          </div>
          <div className="flex items-center justify-between border-t border-white/8 px-4 py-3">
            <button type="button" className="text-sm text-ink-200 hover:text-ink-50" onClick={props.onClear}>
              Clear all
            </button>
            <div className="text-sm text-ink-300">Press Shift + F to open and close</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

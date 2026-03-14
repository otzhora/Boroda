import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent, ReactNode } from "react";
import { labelClassName } from "./ticket-form";

const editableReadRegionClassName =
  "grid min-w-0 gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-white/8 hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";
const nestedInteractiveSelector = "a, button, input, select, textarea, [role='button'], [role='tab']";
const disclosureRowClassName =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border border-transparent px-1 py-1.5 text-left transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50";

export function MetaRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-white/8 pb-2.5 last:border-b-0 last:pb-0">
      <span className="text-sm text-ink-300">{props.label}</span>
      <span className="text-sm font-medium text-ink-50">{props.value}</span>
    </div>
  );
}

export function MetaFieldEditor(props: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3">
      <span className={labelClassName}>{props.label}</span>
      {props.children}
    </div>
  );
}

export function EditableReadRegion(props: {
  label: string;
  onActivate: () => void;
  className?: string;
  children: ReactNode;
}) {
  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const interactiveTarget = event.target instanceof Element ? event.target.closest(nestedInteractiveSelector) : null;
    if (interactiveTarget && interactiveTarget !== event.currentTarget) {
      return;
    }

    props.onActivate();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    props.onActivate();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={props.label}
      className={`${editableReadRegionClassName} ${props.className ?? ""}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {props.children}
    </div>
  );
}

export function DisclosureRow(props: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  description?: string;
  className?: string;
  labelClassName?: string;
  descriptionClassName?: string;
  chevronClassName?: string;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={props.expanded}
      aria-label={`${props.expanded ? "Collapse" : "Expand"} ${props.label}`}
      className={`${disclosureRowClassName} ${props.className ?? ""}`}
      onClick={props.onToggle}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }

        event.preventDefault();
        props.onToggle();
      }}
    >
      <div className="min-w-0">
        <p className={`m-0 text-sm font-semibold text-ink-50 ${props.labelClassName ?? ""}`}>{props.label}</p>
        {props.description ? (
          <p className={`m-0 mt-0.5 text-sm text-ink-300 ${props.descriptionClassName ?? ""}`}>{props.description}</p>
        ) : null}
      </div>
      <ChevronIcon
        className={`h-4 w-4 shrink-0 text-ink-300 transition-transform ${props.expanded ? "" : "-rotate-90"} ${props.chevronClassName ?? ""}`}
      />
    </div>
  );
}

export function ChevronIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CheckIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={props.className} aria-hidden="true">
      <path d="M5 13.2 9.2 17 19 7.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function AlertIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={props.className} aria-hidden="true">
      <path d="M12 7.5v5.5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
      <path d="M12 3.75 21 19.25H3L12 3.75Z" strokeLinejoin="round" />
    </svg>
  );
}

export function AppWindowIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="16" rx="3.5" className="fill-white/6 stroke-current" strokeWidth="1.4" />
      <path d="M3.5 8h17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="6.1" r="0.9" className="fill-current" />
      <circle cx="10.2" cy="6.1" r="0.9" className="fill-current opacity-80" />
    </svg>
  );
}

export function FolderIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={props.className} aria-hidden="true">
      <path
        d="M3.5 7.5a2 2 0 0 1 2-2H9l1.8 2H18.5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"
        className="fill-white/6 stroke-current"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

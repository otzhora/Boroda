import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent, MutableRefObject, RefObject } from "react";
import type { OpenInTarget } from "../../lib/types";
import { ChevronIcon } from "./ticket-drawer-primitives";
import { getOpenInTargetIcon, openInTargets } from "./ticket-drawer-workspaces";
import type { OpenInFeedbackState } from "./ticket-drawer-open-types";

interface TicketDrawerOpenActionProps {
  openInMenuId: string;
  selectedOpenTarget: OpenInTarget;
  selectedOpenTargetLabel: string;
  isOpenInPending: boolean;
  isOpenInMenuOpen: boolean;
  openInFeedback: OpenInFeedbackState;
  openInStatusMessage: string | null;
  openInStatusTone: "success" | "error" | "neutral";
  openInActionButtonRef: RefObject<HTMLButtonElement | null>;
  openInToggleButtonRef: RefObject<HTMLButtonElement | null>;
  onAction: () => void;
  onToggleMenu: () => void;
}

export function TicketDrawerOpenAction(props: TicketDrawerOpenActionProps) {
  const openInButtonLabel = `Open in ${props.selectedOpenTargetLabel}`;

  return (
    <>
      <div className="flex min-w-0">
        <button
          ref={props.openInActionButtonRef}
          type="button"
          className={`inline-flex min-h-10 min-w-0 flex-1 items-center justify-center gap-2 rounded-l-md border px-3 py-2 text-sm font-medium transition-[background-color,border-color,color,opacity] duration-200 ease-out motion-reduce:transition-none disabled:cursor-progress ${
            props.openInFeedback.phase === "success"
              ? "border-accent-500/50 bg-accent-500/18 text-accent-700 motion-safe:animate-[open-in-success-flash_720ms_ease-out]"
              : props.openInFeedback.phase === "error"
                ? "border-danger-400/45 bg-danger-700/30 text-danger-400 motion-safe:animate-[open-in-error-nudge_360ms_ease-out]"
                : "border-white/10 bg-white/[0.10] text-ink-50 hover:bg-white/[0.14]"
          } ${props.isOpenInPending ? "opacity-90" : ""}`}
          onClick={props.onAction}
          disabled={props.isOpenInPending}
          aria-label={
            props.openInFeedback.phase === "opening"
              ? "Opening"
              : props.openInFeedback.phase === "success"
                ? "Opened"
                : props.openInFeedback.phase === "error"
                  ? "Open failed"
                  : openInButtonLabel
          }
        >
          {props.openInFeedback.phase === "opening" ? (
            <span
              className="inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : props.openInFeedback.phase === "success" ? (
            <span aria-hidden="true" className="inline-flex">
              {getOpenInTargetIcon(props.selectedOpenTarget)}
            </span>
          ) : props.openInFeedback.phase === "error" ? (
            <span aria-hidden="true" className="inline-flex text-danger-400">
              {getOpenInTargetIcon(props.selectedOpenTarget)}
            </span>
          ) : (
            getOpenInTargetIcon(props.selectedOpenTarget)
          )}
          <span className="truncate">
            {props.openInFeedback.phase === "opening"
              ? "Opening…"
              : props.openInFeedback.phase === "success"
                ? "Opened"
                : props.openInFeedback.phase === "error"
                  ? "Open failed"
                  : openInButtonLabel}
          </span>
        </button>
        <button
          ref={props.openInToggleButtonRef}
          type="button"
          className="inline-flex min-h-10 min-w-11 items-center justify-center rounded-r-md border border-l-0 border-white/10 bg-white/[0.10] px-3 py-2 text-ink-100 transition-colors hover:bg-white/[0.14] disabled:cursor-progress disabled:opacity-70"
          aria-label="Choose open-in app"
          aria-haspopup="dialog"
          aria-expanded={props.isOpenInMenuOpen}
          aria-controls={props.isOpenInMenuOpen ? props.openInMenuId : undefined}
          onClick={props.onToggleMenu}
          disabled={props.isOpenInPending}
        >
          <ChevronIcon className={`h-4 w-4 transition-transform ${props.isOpenInMenuOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {props.openInStatusMessage ? (
        <p
          className={`m-0 mt-2 min-h-5 text-sm ${
            props.openInStatusTone === "success"
              ? "text-accent-700"
              : props.openInStatusTone === "error"
                ? "text-danger-400"
                : "text-ink-300"
          }`}
          aria-live="polite"
          role={props.openInStatusTone === "error" ? "alert" : "status"}
        >
          {props.openInStatusMessage}
        </p>
      ) : null}
    </>
  );
}

interface TicketDrawerOpenMenuProps {
  openInMenuId: string;
  openInMenuSide: "top" | "bottom";
  openInMenuMaxHeight: number;
  selectedOpenTarget: OpenInTarget;
  openInMenuRef: RefObject<HTMLDivElement | null>;
  openInAppButtonRefs: MutableRefObject<Record<OpenInTarget, HTMLButtonElement | null>>;
  onMenuBlur: (event: FocusEvent<HTMLDivElement>) => void;
  onMenuKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onSelectTarget: (target: OpenInTarget) => void;
}

export function TicketDrawerOpenMenu(props: TicketDrawerOpenMenuProps) {
  return (
    <div
      id={props.openInMenuId}
      ref={props.openInMenuRef}
      data-side={props.openInMenuSide}
      className={`absolute right-0 z-20 grid w-[min(23rem,calc(100vw-4rem))] gap-1 overflow-y-auto rounded-lg border border-white/10 bg-canvas-900 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.28)] ${
        props.openInMenuSide === "top" ? "bottom-[calc(100%+0.45rem)]" : "top-[calc(100%+0.45rem)]"
      }`}
      role="dialog"
      aria-label="Open in"
      style={{ maxHeight: `${props.openInMenuMaxHeight}px` }}
      onBlur={props.onMenuBlur}
      onKeyDown={props.onMenuKeyDown}
    >
      <div className="px-2 pb-1 pt-1">
        <p className="m-0 text-sm font-medium text-ink-300">Choose app</p>
      </div>
      {openInTargets.map((target) => (
        <div key={target.id} className="grid gap-1 border border-transparent p-1">
          <button
            ref={(element) => {
              props.openInAppButtonRefs.current[target.id] = element;
            }}
            type="button"
            className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
            aria-pressed={props.selectedOpenTarget === target.id}
            onClick={() => {
              props.onSelectTarget(target.id);
            }}
          >
            {getOpenInTargetIcon(target.id)}
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-ink-50">{target.label}</span>
              <span className="block truncate text-[0.82rem] text-ink-300">{target.description}</span>
            </span>
            <span className="text-[0.8rem] font-medium text-ink-400">
              {props.selectedOpenTarget === target.id ? "Selected" : "Use"}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

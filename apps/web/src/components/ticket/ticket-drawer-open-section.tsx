import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent, MutableRefObject, RefObject } from "react";
import type { OpenInMode, OpenInTarget } from "../../lib/types";
import { TicketDrawerFolderPickerDialog, TicketDrawerWorkspacePickerDialog } from "./ticket-drawer-open-dialogs";
import { TicketDrawerOpenAction, TicketDrawerOpenMenu } from "./ticket-drawer-open-menu";
import type { OpenInFeedbackState } from "./ticket-drawer-open-types";
import type { TerminalFolderOption, WorkspaceOption } from "./ticket-drawer-workspaces";

const railSectionClassName = "grid min-w-0 gap-3 border-b border-white/8 pb-5 last:border-b-0 last:pb-0";

interface TicketDrawerOpenSectionProps {
  availableTerminalFolders: TerminalFolderOption[];
  selectedOpenMode: OpenInMode;
  selectedOpenTarget: OpenInTarget;
  selectedOpenTargetLabel: string;
  hasAnyWorktree: boolean;
  isOpenInPending: boolean;
  isOpenInMenuOpen: boolean;
  openInMenuId: string;
  openInMenuSide: "top" | "bottom";
  openInMenuMaxHeight: number;
  openInFeedback: OpenInFeedbackState;
  openInStatusMessage: string | null;
  openInStatusTone: "success" | "error" | "neutral";
  openInActionButtonRef: RefObject<HTMLButtonElement | null>;
  openInToggleButtonRef: RefObject<HTMLButtonElement | null>;
  openInMenuRef: RefObject<HTMLDivElement | null>;
  openInAppButtonRefs: MutableRefObject<Record<OpenInTarget, HTMLButtonElement | null>>;
  onSelectMode: (mode: OpenInMode) => void;
  onAction: () => void;
  onToggleMenu: () => void;
  onSelectTarget: (target: OpenInTarget) => void;
  onMenuBlur: (event: FocusEvent<HTMLDivElement>) => void;
  onMenuKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
}

export function TicketDrawerOpenSection(props: TicketDrawerOpenSectionProps) {
  if (!props.availableTerminalFolders.length) {
    return null;
  }

  return (
    <section className={railSectionClassName}>
      <div className="flex items-center justify-between gap-3">
        <h4 className="m-0 text-base font-semibold text-ink-50">Open</h4>
        <div className="inline-flex min-h-9 flex-wrap border border-white/8">
          {(["folder", "worktree"] as const).map((mode) => {
            const isSelected = props.selectedOpenMode === mode;
            const isDisabled = mode === "worktree" && !props.hasAnyWorktree;

            return (
              <button
                key={mode}
                type="button"
                className={`inline-flex min-h-8 min-w-20 items-center justify-center border-r border-white/8 px-2.5 py-1.5 text-sm transition-colors last:border-r-0 ${
                  isSelected ? "bg-white text-canvas-975" : "text-ink-200 hover:bg-white/[0.05] hover:text-ink-50"
                } disabled:cursor-not-allowed disabled:opacity-45`}
                aria-pressed={isSelected}
                onClick={() => {
                  props.onSelectMode(mode);
                }}
                disabled={isDisabled || props.isOpenInPending}
              >
                {mode === "folder" ? "Folder" : "Worktree"}
              </button>
            );
          })}
        </div>
      </div>
      <div className="relative min-w-0">
        <TicketDrawerOpenAction
          openInMenuId={props.openInMenuId}
          selectedOpenTarget={props.selectedOpenTarget}
          selectedOpenTargetLabel={props.selectedOpenTargetLabel}
          isOpenInPending={props.isOpenInPending}
          isOpenInMenuOpen={props.isOpenInMenuOpen}
          openInFeedback={props.openInFeedback}
          openInStatusMessage={props.openInStatusMessage}
          openInStatusTone={props.openInStatusTone}
          openInActionButtonRef={props.openInActionButtonRef}
          openInToggleButtonRef={props.openInToggleButtonRef}
          onAction={props.onAction}
          onToggleMenu={props.onToggleMenu}
        />

        {props.isOpenInMenuOpen ? (
          <TicketDrawerOpenMenu
            openInMenuId={props.openInMenuId}
            openInMenuSide={props.openInMenuSide}
            openInMenuMaxHeight={props.openInMenuMaxHeight}
            selectedOpenTarget={props.selectedOpenTarget}
            openInMenuRef={props.openInMenuRef}
            openInAppButtonRefs={props.openInAppButtonRefs}
            onMenuBlur={props.onMenuBlur}
            onMenuKeyDown={props.onMenuKeyDown}
            onSelectTarget={props.onSelectTarget}
          />
        ) : null}
      </div>
    </section>
  );
}

export function TicketDrawerArchiveAction(props: {
  archivedAt: string | null;
  isArchiving: boolean;
  isRestoring: boolean;
  onArchive: () => void;
  onRestore: () => void;
}) {
  return (
    <section className={railSectionClassName}>
      {props.archivedAt ? (
        <button
          type="button"
          className="inline-flex min-h-9 w-full max-w-full items-center justify-center rounded-lg border border-emerald-400/20 bg-emerald-950/28 px-3 py-1.5 text-sm font-medium text-emerald-100 transition-colors hover:border-emerald-300/30 hover:bg-emerald-950/40 disabled:cursor-progress disabled:opacity-70"
          onClick={props.onRestore}
          disabled={props.isRestoring}
          aria-label={props.isRestoring ? "Restoring ticket from history" : "Restore ticket from history"}
        >
          {props.isRestoring ? (
            <span
              className="mr-2 inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {props.isRestoring ? "Restoring…" : "Restore from history"}
        </button>
      ) : (
        <button
          type="button"
          className="inline-flex min-h-9 w-full max-w-full items-center justify-center rounded-lg border border-red-400/20 bg-red-950/28 px-3 py-1.5 text-sm font-medium text-red-100 transition-colors hover:border-red-300/30 hover:bg-red-950/40 disabled:cursor-progress disabled:opacity-70"
          onClick={props.onArchive}
          disabled={props.isArchiving}
          aria-label={props.isArchiving ? "Moving ticket to history" : "Move ticket to history"}
        >
          {props.isArchiving ? (
            <span
              className="mr-2 inline-block h-[0.85rem] w-[0.85rem] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          {props.isArchiving ? "Moving to history…" : "Move to history"}
        </button>
      )}
    </section>
  );
}

export { TicketDrawerFolderPickerDialog, TicketDrawerWorkspacePickerDialog } from "./ticket-drawer-open-dialogs";

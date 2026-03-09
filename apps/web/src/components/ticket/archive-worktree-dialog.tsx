import { useRef } from "react";
import { ModalDialog } from "../ui/modal-dialog";

export interface DirtyWorktreeDescriptor {
  branchName: string;
  worktreePath: string;
}

export function extractDirtyWorktrees(details: Record<string, unknown> | undefined) {
  const dirtyWorktrees = Array.isArray(details?.dirtyWorktrees) ? details.dirtyWorktrees : [];

  return dirtyWorktrees.flatMap((worktree) => {
    if (!worktree || typeof worktree !== "object") {
      return [];
    }

    const branchName = typeof worktree.branchName === "string" && worktree.branchName.trim() ? worktree.branchName : null;
    const worktreePath =
      typeof worktree.worktreePath === "string" && worktree.worktreePath.trim() ? worktree.worktreePath : null;

    if (!branchName || !worktreePath) {
      return [];
    }

    return [{ branchName, worktreePath }];
  });
}

interface ArchiveWorktreeDialogProps {
  open: boolean;
  worktrees: DirtyWorktreeDescriptor[];
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const secondaryButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-white/10 bg-canvas-950 px-3.5 py-2 text-sm font-medium text-ink-100 transition-colors hover:border-white/16 hover:bg-canvas-900 disabled:cursor-progress disabled:opacity-70";
const dangerButtonClassName =
  "inline-flex min-h-10 items-center justify-center rounded-[10px] border border-danger-400/25 bg-danger-700/30 px-3.5 py-2 text-sm font-medium text-danger-400 transition-colors hover:border-danger-400/40 hover:bg-danger-700/40 disabled:cursor-progress disabled:opacity-70";

export function ArchiveWorktreeDialog({
  open,
  worktrees,
  isDeleting,
  onCancel,
  onConfirm
}: ArchiveWorktreeDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      open={open}
      title="Delete dirty worktrees"
      description="These worktrees have uncommitted changes. Archiving the ticket will delete them."
      onClose={() => {
        if (isDeleting) {
          return;
        }

        onCancel();
      }}
      initialFocusRef={cancelButtonRef}
      variant="flat"
      showHeader={false}
      showCloseButton={false}
    >
      <div className="grid gap-3 px-4 py-4 sm:px-5">
        <div className="grid gap-1">
          <h2 className="m-0 text-[1.4rem] font-semibold tracking-[-0.025em] text-ink-50">Delete dirty worktrees</h2>
          <p className="m-0 text-sm text-ink-200">
            These worktrees have uncommitted changes. Archiving the ticket will remove them.
          </p>
        </div>

        <div className="overflow-hidden rounded-[10px] border border-white/8 bg-canvas-950">
          <ul className="m-0 list-none p-0">
            {worktrees.map((worktree) => (
              <li
                key={`${worktree.branchName}:${worktree.worktreePath}`}
                className="grid gap-1.5 border-t border-white/8 px-4 py-3 first:border-t-0"
              >
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <p className="m-0 text-sm font-medium text-ink-50">{worktree.branchName}</p>
                  <span className="shrink-0 text-xs text-danger-400">Dirty</span>
                </div>
                <p className="m-0 break-all font-mono text-xs text-ink-200">{worktree.worktreePath}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            ref={cancelButtonRef}
            type="button"
            className={secondaryButtonClassName}
            disabled={isDeleting}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button type="button" className={dangerButtonClassName} disabled={isDeleting} onClick={onConfirm}>
            {isDeleting ? "Deleting…" : "Delete and archive"}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}

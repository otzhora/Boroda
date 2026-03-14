import { getProjectBadgeStyle } from "../../lib/project-colors";
import type { WorkspaceSummaryItem } from "./ticket-drawer-workspace-types";

export function WorkspaceSummaryList(props: { items: WorkspaceSummaryItem[] }) {
  if (!props.items.length) {
    return <p className="m-0 text-sm text-ink-300">No workspaces yet.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-white/8">
      {props.items.map((workspace) => (
        <div key={workspace.key} className="grid gap-1 border-b border-white/8 px-3 py-2.5 last:border-b-0">
          <div className="flex items-center justify-between gap-3">
            <span
              className="inline-flex min-h-7 items-center rounded-md border border-white/8 bg-canvas-950 px-2.5 text-sm text-ink-200"
              style={getProjectBadgeStyle(workspace.projectColor)}
            >
              {workspace.projectName}
            </span>
            <span className="min-w-0 truncate text-sm text-ink-200">{workspace.branchName}</span>
          </div>
          <p className="m-0 text-[0.8rem] text-ink-300">
            {workspace.hasWorktreeSetup
              ? "Fresh worktrees for this folder can run repo-local setup."
              : "No repo-local worktree setup configured for this folder."}
          </p>
        </div>
      ))}
    </div>
  );
}

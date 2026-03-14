import { WorkspaceSummaryList, type WorkspaceSummaryItem } from "./ticket-drawer-workspaces";

export function TicketDrawerWorkspaceSummary(props: {
  workspaceSummaries: WorkspaceSummaryItem[];
  workspaceBaseBranchErrorCount: number;
  onOpenWorkspaceDrawer: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="rounded-lg border border-white/8 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
        onClick={props.onOpenWorkspaceDrawer}
        aria-label="Edit ticket workspaces"
      >
        <WorkspaceSummaryList items={props.workspaceSummaries} />
      </button>
      {props.workspaceBaseBranchErrorCount ? (
        <p className="m-0 text-sm text-red-100">
          {props.workspaceBaseBranchErrorCount} workspace{props.workspaceBaseBranchErrorCount === 1 ? "" : "s"} missing a folder default branch.
        </p>
      ) : null}
    </>
  );
}

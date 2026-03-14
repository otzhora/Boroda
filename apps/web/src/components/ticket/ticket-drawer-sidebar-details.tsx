import type { TicketFormState } from "../../features/tickets/form";
import type { Ticket } from "../../lib/types";
import type { EditableSectionId } from "./ticket-drawer-layout";
import type { WorkspaceSummaryItem } from "./ticket-drawer-workspaces";
import { TicketDrawerJiraSection } from "./ticket-drawer-jira-section";
import { TicketDrawerMetadataSection } from "./ticket-drawer-metadata-section";
import { TicketDrawerWorkspaceSummary } from "./ticket-drawer-workspace-summary";

const railSectionClassName = "grid min-w-0 gap-3 border-b border-white/8 pb-5 last:border-b-0 last:pb-0";

interface TicketDrawerSidebarDetailsProps {
  ticket: Ticket;
  form: TicketFormState;
  statuses: Array<{ id: number; status: string; label: string; position: number; createdAt: string; updatedAt: string }>;
  activeEditor: EditableSectionId | null;
  isJiraSectionExpanded: boolean;
  isRefreshingJira: boolean;
  jiraBaseUrl: string;
  jiraSectionId: string;
  editorRootRefs: React.MutableRefObject<Partial<Record<EditableSectionId, HTMLElement | null>>>;
  workspaceSummaries: WorkspaceSummaryItem[];
  workspaceBaseBranchErrorCount: number;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onOpenEditor: (section: EditableSectionId) => void;
  onToggleJiraSection: () => void;
  onRefreshJira: () => void;
  onOpenWorkspaceDrawer: () => void;
}

export function TicketDrawerSidebarDetails(props: TicketDrawerSidebarDetailsProps) {
  return (
    <section className={railSectionClassName}>
      <div className="flex min-w-0 items-center justify-between gap-4">
        <h4 className="m-0 text-base font-semibold text-ink-50">Details</h4>
      </div>

      <TicketDrawerWorkspaceSummary
        workspaceSummaries={props.workspaceSummaries}
        workspaceBaseBranchErrorCount={props.workspaceBaseBranchErrorCount}
        onOpenWorkspaceDrawer={props.onOpenWorkspaceDrawer}
      />

      <TicketDrawerMetadataSection
        ticket={props.ticket}
        form={props.form}
        statuses={props.statuses}
        activeEditor={props.activeEditor}
        editorRootRefs={props.editorRootRefs}
        onChange={props.onChange}
        onOpenEditor={props.onOpenEditor}
      />

      <TicketDrawerJiraSection
        ticket={props.ticket}
        form={props.form}
        activeEditor={props.activeEditor}
        isJiraSectionExpanded={props.isJiraSectionExpanded}
        isRefreshingJira={props.isRefreshingJira}
        jiraBaseUrl={props.jiraBaseUrl}
        jiraSectionId={props.jiraSectionId}
        editorRootRefs={props.editorRootRefs}
        onChange={props.onChange}
        onOpenEditor={props.onOpenEditor}
        onToggleJiraSection={props.onToggleJiraSection}
        onRefreshJira={props.onRefreshJira}
      />
    </section>
  );
}

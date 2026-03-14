import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, ReactNode, RefObject } from "react";
import type { TicketFormState } from "../../features/tickets/form";
import type { BoardColumnDefinition, Ticket } from "../../lib/types";
import { EditableReadRegion } from "./ticket-drawer-primitives";
import { TicketTitleField } from "./ticket-form";
import { TicketDrawerMainContent } from "./ticket-drawer-main-content";
import type { WorkspaceSummaryItem } from "./ticket-drawer-workspaces";
import { TicketDrawerSidebarDetails } from "./ticket-drawer-sidebar-details";

export const detailTabs = [
  { id: "contexts", label: "Work contexts" },
  { id: "activity", label: "Activity" }
] as const;

export type DetailTabId = (typeof detailTabs)[number]["id"];
export type EditableSectionId = "title" | "description" | "jiraIssues" | "status" | "priority" | "dueAt";
interface TicketDrawerHeaderProps {
  ticket: Ticket | undefined;
  form: TicketFormState;
  activeEditor: EditableSectionId | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  editorRootRefs: MutableRefObject<Partial<Record<EditableSectionId, HTMLElement | null>>>;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onOpenEditor: (section: EditableSectionId) => void;
}

export function TicketDrawerHeader(props: TicketDrawerHeaderProps) {
  const { ticket, form, activeEditor, titleInputRef, editorRootRefs, onChange, onOpenEditor } = props;

  if (!ticket) {
    return undefined;
  }

  return (
    <div className="min-w-0">
      <p className="m-0 text-sm font-semibold uppercase tracking-[0.12em] text-ink-300">{ticket.key}</p>
      {activeEditor === "title" ? (
        <div
          ref={(element) => {
            editorRootRefs.current.title = element;
          }}
          className="mt-2 max-w-3xl"
        >
          <TicketTitleField
            value={form.title}
            onChange={(value) =>
              onChange((current) => ({
                ...current,
                title: value
              }))
            }
            inputRef={titleInputRef}
            hideLabel
          />
        </div>
      ) : (
        <EditableReadRegion
          label="Edit ticket title"
          className="mt-1 max-w-3xl p-0"
          onActivate={() => {
            onOpenEditor("title");
          }}
        >
          <h2 className="m-0 min-w-0 break-words text-[1.8rem] font-semibold tracking-[-0.03em] text-ink-50">
            {form.title || "Untitled ticket"}
          </h2>
        </EditableReadRegion>
      )}
    </div>
  );
}

interface TicketDrawerBodyProps {
  ticket: Ticket;
  form: TicketFormState;
  statuses: BoardColumnDefinition[];
  activeEditor: EditableSectionId | null;
  activeDetailTab: DetailTabId;
  isJiraSectionExpanded: boolean;
  isRefreshingJira: boolean;
  jiraBaseUrl: string;
  detailTabsId: string;
  jiraSectionId: string;
  detailTabRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  descriptionTextareaRef: RefObject<HTMLTextAreaElement | null>;
  editorRootRefs: MutableRefObject<Partial<Record<EditableSectionId, HTMLElement | null>>>;
  activityMessages: Map<number, string>;
  workspaceSummaries: WorkspaceSummaryItem[];
  workspaceBaseBranchErrorCount: number;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onOpenEditor: (section: EditableSectionId) => void;
  onSetActiveDetailTab: (tab: DetailTabId) => void;
  onDetailTabKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => void;
  onToggleJiraSection: () => void;
  onRefreshJira: () => void;
  onOpenWorkspaceDrawer: () => void;
  sidebar: ReactNode;
}

export function TicketDrawerBody(props: TicketDrawerBodyProps) {
  return (
    <div className="grid w-full items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(17rem,20rem)] xl:gap-8">
      <TicketDrawerMainContent
        ticket={props.ticket}
        form={props.form}
        activeEditor={props.activeEditor}
        activeDetailTab={props.activeDetailTab}
        detailTabsId={props.detailTabsId}
        detailTabRefs={props.detailTabRefs}
        descriptionTextareaRef={props.descriptionTextareaRef}
        editorRootRefs={props.editorRootRefs}
        activityMessages={props.activityMessages}
        onChange={props.onChange}
        onSave={props.onSave}
        onOpenEditor={props.onOpenEditor}
        onSetActiveDetailTab={props.onSetActiveDetailTab}
        onDetailTabKeyDown={props.onDetailTabKeyDown}
      />

      <aside className="grid min-w-0 content-start xl:border-l xl:border-white/8 xl:pl-6">
        <div className="grid min-w-0 gap-4">
          {props.sidebar}
          <TicketDrawerSidebarDetails
            ticket={props.ticket}
            form={props.form}
            statuses={props.statuses}
            activeEditor={props.activeEditor}
            isJiraSectionExpanded={props.isJiraSectionExpanded}
            isRefreshingJira={props.isRefreshingJira}
            jiraBaseUrl={props.jiraBaseUrl}
            jiraSectionId={props.jiraSectionId}
            editorRootRefs={props.editorRootRefs}
            workspaceSummaries={props.workspaceSummaries}
            workspaceBaseBranchErrorCount={props.workspaceBaseBranchErrorCount}
            onChange={props.onChange}
            onOpenEditor={props.onOpenEditor}
            onToggleJiraSection={props.onToggleJiraSection}
            onRefreshJira={props.onRefreshJira}
            onOpenWorkspaceDrawer={props.onOpenWorkspaceDrawer}
          />
        </div>
      </aside>
    </div>
  );
}

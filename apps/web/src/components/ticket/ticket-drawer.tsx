import { useMemo } from "react";
import type { BoardColumnDefinition, OpenInMode, OpenInTarget, Project, Ticket } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
import { getActivityMessage } from "../../features/tickets/activity";
import { useJiraSettingsQuery } from "../../features/jira/queries";
import { ModalDialog } from "../ui/modal-dialog";
import { TicketDrawerBody, TicketDrawerHeader } from "./ticket-drawer-layout";
import { TicketDrawerDialogs } from "./ticket-drawer-dialogs";
import { TicketDrawerSidebarActions } from "./ticket-drawer-sidebar-actions";
import { countWorkspaceBaseBranchErrors, useWorkspaceSummaries } from "./ticket-drawer-workspaces";
import { useTicketDrawerEditing } from "./use-ticket-drawer-editing";
import { useTicketDrawerOpenIn } from "./use-ticket-drawer-open-in";
import { useTicketDrawerViewState } from "./use-ticket-drawer-view-state";

interface TicketDrawerProps {
  ticketId: number | null;
  ticket: Ticket | undefined;
  statuses?: BoardColumnDefinition[];
  isLoading: boolean;
  isError: boolean;
  form: TicketFormState;
  projects: Project[];
  isSaving: boolean;
  saveSuccessCount: number;
  isArchiving: boolean;
  isRestoring: boolean;
  isOpeningInApp: boolean;
  isRefreshingJira: boolean;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onOpenInApp: (target: OpenInTarget, mode: OpenInMode, folderId?: number, workspaceId?: number) => void | Promise<void>;
  onRefreshJira: () => void;
  onClose: () => void;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function TicketDrawer(props: TicketDrawerProps) {
  const {
    ticketId,
    ticket,
    statuses = [],
    isLoading,
    isError,
    form,
    projects,
    isSaving,
    saveSuccessCount,
    isArchiving,
    isRestoring,
    isOpeningInApp,
    isRefreshingJira,
    onChange,
    onSave,
    onArchive,
    onRestore,
    onOpenInApp,
    onRefreshJira,
    onClose
  } = props;
  const editing = useTicketDrawerEditing({
    ticketId,
    isSaving,
    saveSuccessCount,
    onSave
  });
  const viewState = useTicketDrawerViewState(ticketId);
  const activityMessages = useMemo(
    () =>
      new Map(
        (ticket?.activities ?? []).map((activity) => [activity.id, getActivityMessage(activity, statuses)])
      ),
    [statuses, ticket?.activities]
  );
  const jiraSettingsQuery = useJiraSettingsQuery();
  const jiraBaseUrl = jiraSettingsQuery.data?.baseUrl ? trimTrailingSlash(jiraSettingsQuery.data.baseUrl) : "";
  const workspaceSummaries = useWorkspaceSummaries(ticket, form, projects);
  const workspaceBaseBranchErrorCount = useMemo(() => countWorkspaceBaseBranchErrors(form, projects), [form, projects]);
  const openIn = useTicketDrawerOpenIn({
    ticketId,
    ticket,
    isOpeningInApp,
    onOpenInApp
  });

  return (
    <ModalDialog
      open={ticketId !== null}
      title={ticket ? `${ticket.key} ${form.title || "Untitled ticket"}` : "Ticket details"}
      header={
        <TicketDrawerHeader
          ticket={ticket}
          form={form}
          activeEditor={editing.activeEditor}
          titleInputRef={editing.titleInputRef}
          editorRootRefs={editing.editorRootRefs}
          onChange={onChange}
          onOpenEditor={editing.openEditor}
        />
      }
      description={undefined}
      onEscapeKeyDown={() => {
        if (viewState.isWorkspaceDrawerOpen || openIn.isFolderPickerOpen || openIn.workspacePickerFolderId !== null) {
          return false;
        }

        if (!editing.activeEditor) {
          return;
        }

        editing.saveAndCloseEditor();
        return false;
      }}
      onClose={() => {
        if (editing.activeEditor) {
          editing.saveAndCloseEditor();
          return;
        }

        onClose();
      }}
      size="wide"
      showCloseButton={false}
      initialFocusRef={editing.activeEditor === "title" ? editing.titleInputRef : undefined}
    >
      {isLoading ? (
        <p className="m-0 text-sm text-ink-200">Loading ticket…</p>
      ) : isError || !ticket ? (
        <p className="m-0 text-sm text-ink-200">
          Ticket details could not be loaded. Select it again or refresh the board.
        </p>
      ) : (
        <TicketDrawerBody
          ticket={ticket}
          form={form}
          statuses={statuses}
          activeEditor={editing.activeEditor}
          activeDetailTab={viewState.activeDetailTab}
          isJiraSectionExpanded={viewState.isJiraSectionExpanded}
          isRefreshingJira={isRefreshingJira}
          jiraBaseUrl={jiraBaseUrl}
          detailTabsId={viewState.detailTabsId}
          jiraSectionId={viewState.jiraSectionId}
          detailTabRefs={viewState.detailTabRefs}
          descriptionTextareaRef={editing.descriptionTextareaRef}
          editorRootRefs={editing.editorRootRefs}
          activityMessages={activityMessages}
          workspaceSummaries={workspaceSummaries}
          workspaceBaseBranchErrorCount={workspaceBaseBranchErrorCount}
          onChange={onChange}
          onSave={onSave}
          onOpenEditor={editing.openEditor}
          onSetActiveDetailTab={viewState.setActiveDetailTab}
          onDetailTabKeyDown={viewState.handleDetailTabKeyDown}
          onToggleJiraSection={() => {
            viewState.setIsJiraSectionExpanded((current) => !current);
          }}
          onRefreshJira={onRefreshJira}
          onOpenWorkspaceDrawer={() => {
            viewState.setIsWorkspaceDrawerOpen(true);
          }}
          sidebar={
            <TicketDrawerSidebarActions
              archivedAt={ticket.archivedAt}
              isArchiving={isArchiving}
              isRestoring={isRestoring}
              openIn={openIn}
              onArchive={onArchive}
              onRestore={onRestore}
            />
          }
        />
      )}

      <TicketDrawerDialogs
        form={form}
        projects={projects}
        isSaving={isSaving}
        isWorkspaceDrawerOpen={viewState.isWorkspaceDrawerOpen}
        openIn={openIn}
        onChange={onChange}
        onSave={onSave}
        onSetWorkspaceDrawerOpen={viewState.setIsWorkspaceDrawerOpen}
      />
    </ModalDialog>
  );
}

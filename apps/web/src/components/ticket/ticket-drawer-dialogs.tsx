import type { Project } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
import { TicketDrawerFolderPickerDialog, TicketDrawerWorkspacePickerDialog } from "./ticket-drawer-open-section";
import { TicketWorkspaceDrawer } from "./ticket-workspace-drawer";
import type { useTicketDrawerOpenIn } from "./use-ticket-drawer-open-in";

interface TicketDrawerDialogsProps {
  form: TicketFormState;
  projects: Project[];
  isSaving: boolean;
  isWorkspaceDrawerOpen: boolean;
  openIn: ReturnType<typeof useTicketDrawerOpenIn>;
  onChange: (updater: (current: TicketFormState) => TicketFormState) => void;
  onSave: () => void;
  onSetWorkspaceDrawerOpen: (open: boolean) => void;
}

export function TicketDrawerDialogs(props: TicketDrawerDialogsProps) {
  const { openIn } = props;

  return (
    <>
      <TicketWorkspaceDrawer
        open={props.isWorkspaceDrawerOpen}
        form={props.form}
        projects={props.projects}
        isSaving={props.isSaving}
        onChange={props.onChange}
        onSave={props.onSave}
        onClose={() => {
          props.onSetWorkspaceDrawerOpen(false);
        }}
      />

      <TicketDrawerFolderPickerDialog
        open={openIn.isFolderPickerOpen}
        selectedOpenTargetLabel={openIn.selectedOpenTargetLabel}
        availableTerminalFolders={openIn.availableTerminalFolders}
        firstFolderOptionRef={openIn.firstFolderOptionRef}
        onClose={() => {
          openIn.setIsFolderPickerOpen(false);
        }}
        onSelectFolder={(folderId) => {
          openIn.setIsFolderPickerOpen(false);
          openIn.handleOpenInSelection(folderId);
        }}
      />

      <TicketDrawerWorkspacePickerDialog
        open={openIn.workspacePickerFolderId !== null}
        selectedOpenTargetLabel={openIn.selectedOpenTargetLabel}
        availableWorkspaceOptions={openIn.availableWorkspaceOptions}
        firstWorkspaceOptionRef={openIn.firstWorkspaceOptionRef}
        onClose={() => {
          openIn.setWorkspacePickerFolderId(null);
        }}
        onSelectWorkspace={(workspace) => {
          openIn.setWorkspacePickerFolderId(null);
          void openIn.runOpenInAction(workspace.folderId, workspace.id);
        }}
      />
    </>
  );
}

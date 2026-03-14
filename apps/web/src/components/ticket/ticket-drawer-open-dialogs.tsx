import type { RefObject } from "react";
import { ModalDialog } from "../ui/modal-dialog";
import type { TerminalFolderOption, WorkspaceOption } from "./ticket-drawer-workspaces";

export function TicketDrawerFolderPickerDialog(props: {
  open: boolean;
  selectedOpenTargetLabel: string;
  availableTerminalFolders: TerminalFolderOption[];
  firstFolderOptionRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelectFolder: (folderId: number) => void;
}) {
  return (
    <ModalDialog
      open={props.open}
      title="Choose folder"
      description={`Pick which linked project folder to open in ${props.selectedOpenTargetLabel}.`}
      onClose={props.onClose}
      initialFocusRef={props.firstFolderOptionRef}
    >
      <div className="grid min-w-0 gap-2">
        {props.availableTerminalFolders.map((folder, index) => (
          <button
            key={folder.folderId}
            ref={index === 0 ? props.firstFolderOptionRef : undefined}
            type="button"
            className="grid min-w-0 gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
            onClick={() => {
              props.onSelectFolder(folder.folderId);
            }}
          >
            <span className="min-w-0 text-sm font-semibold text-ink-50">
              {folder.projectName}
              <span className="ml-2 text-[0.82rem] font-medium text-ink-300">{folder.relationship}</span>
              {folder.isPrimaryFolder ? (
                <span className="ml-2 text-[0.82rem] font-medium text-amber-200">Primary folder</span>
              ) : null}
            </span>
            <span className="text-sm text-ink-200">{folder.folderLabel}</span>
            <span className="min-w-0 break-all font-mono text-[0.88rem] text-ink-300">{folder.path}</span>
          </button>
        ))}
      </div>
    </ModalDialog>
  );
}

export function TicketDrawerWorkspacePickerDialog(props: {
  open: boolean;
  selectedOpenTargetLabel: string;
  availableWorkspaceOptions: WorkspaceOption[];
  firstWorkspaceOptionRef: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  onSelectWorkspace: (workspace: WorkspaceOption) => void;
}) {
  return (
    <ModalDialog
      open={props.open}
      title="Choose workspace"
      description={`Pick which ticket workspace to open in ${props.selectedOpenTargetLabel}.`}
      onClose={props.onClose}
      initialFocusRef={props.firstWorkspaceOptionRef}
    >
      <div className="grid min-w-0 gap-2">
        {props.availableWorkspaceOptions.map((workspace, index) => (
          <button
            key={workspace.id}
            ref={index === 0 ? props.firstWorkspaceOptionRef : undefined}
            type="button"
            className="grid min-w-0 gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition-colors hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-50"
            onClick={() => {
              props.onSelectWorkspace(workspace);
            }}
          >
            <span className="min-w-0 text-sm font-semibold text-ink-50">
              {workspace.projectName}
              <span className="ml-2 text-[0.82rem] font-medium text-ink-300">{workspace.folderLabel}</span>
            </span>
            <span className="text-sm text-ink-200">{workspace.branchName}</span>
            <span className="text-[0.82rem] text-ink-300">{workspace.role}</span>
          </button>
        ))}
      </div>
    </ModalDialog>
  );
}

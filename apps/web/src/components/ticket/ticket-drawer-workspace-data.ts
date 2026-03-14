import type { Project, Ticket } from "../../lib/types";
import type { TicketFormState } from "../../features/tickets/form";
import { getPreferredExistingProjectFolder, sortTicketProjectLinks } from "../../features/tickets/project-links";
import type { TerminalFolderOption, WorkspaceOption, WorkspaceSummaryItem } from "./ticket-drawer-workspace-types";

export function getAvailableTerminalFolders(ticket: Ticket | undefined): TerminalFolderOption[] {
  if (!ticket) {
    return [];
  }

  return sortTicketProjectLinks(ticket.projectLinks).flatMap((link) =>
    link.project.folders
      .filter((folder) => folder.existsOnDisk)
      .sort((left, right) => {
        if (left.isPrimary === right.isPrimary) {
          return left.id - right.id;
        }

        return left.isPrimary ? -1 : 1;
      })
      .map((folder) => ({
        folderId: folder.id,
        projectId: link.projectId,
        projectName: link.project.name,
        relationship: link.relationship,
        folderLabel: folder.label,
        path: folder.path,
        isPrimaryFolder: folder.isPrimary
      }))
  );
}

export function getWorkspaceOptions(ticket: Ticket | undefined, folderId: number | null): WorkspaceOption[] {
  if (!ticket || folderId === null) {
    return [];
  }

  return ticket.workspaces
    .filter((workspace) => workspace.projectFolderId === folderId)
    .map((workspace) => ({
      id: workspace.id,
      folderId,
      branchName: workspace.branchName,
      role: workspace.role,
      projectName: workspace.projectFolder.project.name,
      folderLabel: workspace.projectFolder.label
    }));
}

export function getPreferredProjectFolder(ticket: Ticket | undefined) {
  return getPreferredExistingProjectFolder(ticket);
}

export function getWorkspaceSummaries(ticket: Ticket | undefined, form: TicketFormState, projects: Project[]): WorkspaceSummaryItem[] {
  if (!form.workspaces.length) {
    return [];
  }

  const folderLookup = new Map<string, { projectName: string; projectColor: string; hasWorktreeSetup: boolean }>();

  for (const project of projects) {
    for (const folder of project.folders) {
      folderLookup.set(String(folder.id), {
        projectName: project.name,
        projectColor: project.color,
        hasWorktreeSetup: folder.setupInfo?.hasWorktreeSetup === true
      });
    }
  }

  return form.workspaces.map((workspace, index) => {
    const ticketWorkspace = ticket?.workspaces.find((item) => item.id === workspace.id);
    const folderInfo =
      folderLookup.get(workspace.projectFolderId) ??
      (ticketWorkspace
        ? {
            projectName: ticketWorkspace.projectFolder.project.name,
            projectColor: ticketWorkspace.projectFolder.project.color,
            hasWorktreeSetup: false
          }
        : null);

    return {
      key: String(workspace.id ?? `${workspace.projectFolderId}-${index}`),
      projectName: folderInfo?.projectName ?? "Unlinked project",
      projectColor: folderInfo?.projectColor ?? "#6b7280",
      branchName: workspace.branchName.trim() || "No branch",
      hasWorktreeSetup: folderInfo?.hasWorktreeSetup ?? false
    };
  });
}

export function countWorkspaceBaseBranchErrors(form: TicketFormState, projects: Project[]) {
  const folderLookup = new Map<string, { defaultBranch: string | null }>();

  for (const project of projects) {
    for (const folder of project.folders) {
      folderLookup.set(String(folder.id), { defaultBranch: folder.defaultBranch });
    }
  }

  return form.workspaces.filter((workspace) => {
    if (!workspace.branchName.trim()) {
      return false;
    }

    return !folderLookup.get(workspace.projectFolderId)?.defaultBranch?.trim();
  }).length;
}

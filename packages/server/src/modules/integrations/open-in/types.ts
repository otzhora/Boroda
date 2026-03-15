export const openInTargets = ["explorer", "vscode", "cursor", "terminal"] as const;
export type OpenInTarget = (typeof openInTargets)[number];

export const openInModes = ["folder", "worktree"] as const;
export type OpenInMode = (typeof openInModes)[number];

export interface OpenInAppInput {
  directory: string;
  target: OpenInTarget;
}

export interface OpenTicketInAppInput {
  target: OpenInTarget;
  mode: OpenInMode;
  folderId?: number;
  workspaceId?: number;
  runSetup: boolean;
}

export interface PreferredFolderCandidate {
  projectId: number;
  relationship: string;
  project: {
    folders: Array<{
      id: number;
      path: string;
      isPrimary: boolean;
      existsOnDisk: boolean;
    }>;
  };
}

export interface TicketWorkspaceCandidate {
  id: number;
  ticketId: number;
  projectFolderId: number;
  branchName: string;
  baseBranch: string | null;
  role: string;
  worktreePath: string | null;
  createdByBoroda: boolean;
  lastOpenedAt: string | null;
  projectFolder: {
    id: number;
    projectId: number;
    label: string;
    path: string;
    defaultBranch: string | null;
    project: {
      id: number;
      name: string;
      slug: string;
    };
  };
}

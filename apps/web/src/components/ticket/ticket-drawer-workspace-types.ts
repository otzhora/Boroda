export interface TerminalFolderOption {
  folderId: number;
  projectId: number;
  projectName: string;
  relationship: string;
  folderLabel: string;
  path: string;
  isPrimaryFolder: boolean;
}

export interface WorkspaceOption {
  id: number;
  folderId: number;
  branchName: string;
  role: string;
  projectName: string;
  folderLabel: string;
}

export interface WorkspaceSummaryItem {
  key: string;
  projectName: string;
  projectColor: string;
  branchName: string;
  hasWorktreeSetup: boolean;
}

import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { getConfig } from "../../../config";
import { ticketWorkspaces } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { getTicketOrThrow } from "../../tickets/service";
import {
  detectRemoteDefaultBranch,
  ensureGitRepo,
  ensureWorkspaceWorktree,
  validateWorkspaceWorktree
} from "./git-workspaces";
import { recordTicketActivity } from "./ticket-activity";
import type { OpenTicketInAppInput, PreferredFolderCandidate, TicketWorkspaceCandidate } from "./types";
import { runWorktreeSetup } from "./worktree-setup";

function sortProjectLinks(links: PreferredFolderCandidate[]) {
  return [...links].sort((left, right) => {
    if (left.relationship === right.relationship) {
      return left.projectId - right.projectId;
    }

    if (left.relationship === "PRIMARY") {
      return -1;
    }

    if (right.relationship === "PRIMARY") {
      return 1;
    }

    return left.projectId - right.projectId;
  });
}

function pickPreferredFolder(links: PreferredFolderCandidate[]) {
  for (const link of sortProjectLinks(links)) {
    const primaryFolder = link.project.folders.find((folder) => folder.isPrimary);
    if (primaryFolder?.existsOnDisk) {
      return primaryFolder;
    }

    const firstExistingFolder = link.project.folders.find((folder) => folder.existsOnDisk);
    if (firstExistingFolder) {
      return firstExistingFolder;
    }
  }

  return null;
}

function findLinkedProjectFolder(links: PreferredFolderCandidate[], folderId: number) {
  for (const link of links) {
    const folder = link.project.folders.find((candidate) => candidate.id === folderId);
    if (folder) {
      return folder;
    }
  }

  return null;
}

function slugifyPathSegment(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "workspace";
}

function getManagedWorkspacePath(params: {
  ticketKey: string;
  projectSlug: string;
  folderLabel: string;
  branchName: string;
}) {
  return path.resolve(
    getConfig().worktreesPath,
    params.ticketKey,
    slugifyPathSegment(params.projectSlug),
    slugifyPathSegment(params.folderLabel),
    slugifyPathSegment(params.branchName)
  );
}

function findWorkspacesForFolder(workspaces: TicketWorkspaceCandidate[], folderId: number) {
  return workspaces.filter((workspace) => workspace.projectFolderId === folderId);
}

async function resolveWorkspaceDirectory(
  app: FastifyInstance,
  ticket: Awaited<ReturnType<typeof getTicketOrThrow>>,
  folderId: number,
  workspace: TicketWorkspaceCandidate,
  input: OpenTicketInAppInput
) {
  const repoRoot = ensureGitRepo(workspace.projectFolder.path);
  const folderDefaultBranch = workspace.projectFolder.defaultBranch?.trim() || null;
  const detectedDefaultBranch = detectRemoteDefaultBranch(repoRoot);
  const baseBranch = workspace.baseBranch?.trim() || folderDefaultBranch;
  const shouldRunSetup = workspace.worktreePath === null && input.runSetup;

  if (folderDefaultBranch && detectedDefaultBranch && folderDefaultBranch !== detectedDefaultBranch) {
    throw new AppError(409, "WORKSPACE_DEFAULT_BRANCH_INVALID", "The configured default branch does not match the repository default branch", {
      projectFolderId: folderId,
      configuredDefaultBranch: folderDefaultBranch,
      detectedDefaultBranch
    });
  }

  const worktreePath =
    workspace.worktreePath ??
    getManagedWorkspacePath({
      ticketKey: ticket.key,
      projectSlug: workspace.projectFolder.project.slug,
      folderLabel: workspace.projectFolder.label,
      branchName: workspace.branchName
    });
  await mkdir(path.dirname(worktreePath), { recursive: true });

  const ensuredPath = workspace.worktreePath
    ? validateWorkspaceWorktree({
        worktreePath,
        expectedBranch: workspace.branchName
      })
    : await ensureWorkspaceWorktree({
        repoPath: repoRoot,
        worktreePath,
        branchName: workspace.branchName,
        baseBranch
      });

  if (shouldRunSetup) {
    try {
      const executedSteps = runWorktreeSetup({
        worktreePath: ensuredPath,
        ticketKey: ticket.key,
        branchName: workspace.branchName,
        repoPath: repoRoot
      });

      if (executedSteps.length > 0) {
        recordTicketActivity(
          app,
          ticket.id,
          "ticket.workspace_setup_ran",
          executedSteps.length === 1
            ? `Ran worktree setup step ${executedSteps[0]}`
            : `Ran ${executedSteps.length} worktree setup steps`,
          {
            projectFolderId: folderId,
            workspaceId: workspace.id,
            worktreePath: ensuredPath,
            steps: executedSteps
          }
        );
      }
    } catch (error) {
      if (error instanceof AppError) {
        recordTicketActivity(app, ticket.id, "ticket.workspace_setup_failed", "Worktree setup failed", {
          projectFolderId: folderId,
          workspaceId: workspace.id,
          worktreePath: ensuredPath,
          errorCode: error.code,
          ...error.details
        });
      }

      throw error;
    }
  }

  const now = new Date().toISOString();
  app.db
    .update(ticketWorkspaces)
    .set({
      worktreePath: ensuredPath,
      updatedAt: now,
      lastOpenedAt: now
    })
    .where(eq(ticketWorkspaces.id, workspace.id))
    .run();

  return ensuredPath;
}

export async function resolveTicketOpenDirectory(
  app: FastifyInstance,
  ticket: Awaited<ReturnType<typeof getTicketOrThrow>>,
  input: OpenTicketInAppInput
) {
  const selectedFolder =
    input.folderId === undefined ? pickPreferredFolder(ticket.projectLinks) : findLinkedProjectFolder(ticket.projectLinks, input.folderId);

  if (input.folderId !== undefined && !selectedFolder) {
    throw new AppError(409, "TICKET_PROJECT_FOLDER_NOT_AVAILABLE", "The selected project folder is not available for this ticket");
  }

  if (!selectedFolder?.existsOnDisk) {
    throw new AppError(
      409,
      "TICKET_PROJECT_FOLDER_NOT_AVAILABLE",
      input.folderId === undefined
        ? "No linked project folder is available for this ticket"
        : "The selected project folder is not available for this ticket"
    );
  }

  let directory = selectedFolder.path;

  if (input.mode === "worktree") {
    const matchingWorkspaces = findWorkspacesForFolder(ticket.workspaces ?? [], selectedFolder.id);
    let selectedWorkspace: TicketWorkspaceCandidate | null = null;

    if (input.workspaceId !== undefined) {
      selectedWorkspace = matchingWorkspaces.find((workspace) => workspace.id === input.workspaceId) ?? null;

      if (!selectedWorkspace) {
        throw new AppError(409, "TICKET_WORKSPACE_NOT_AVAILABLE", "The selected workspace is not available for this folder", {
          folderId: selectedFolder.id,
          workspaceId: input.workspaceId
        });
      }
    } else if (matchingWorkspaces.length > 1) {
      throw new AppError(409, "TICKET_WORKSPACE_SELECTION_REQUIRED", "Choose which ticket workspace to open for this folder", {
        folderId: selectedFolder.id,
        workspaces: matchingWorkspaces.map((workspace) => ({
          id: workspace.id,
          branchName: workspace.branchName,
          role: workspace.role,
          projectFolderId: workspace.projectFolderId
        }))
      });
    } else {
      selectedWorkspace = matchingWorkspaces[0] ?? null;
    }

    if (!selectedWorkspace) {
      throw new AppError(409, "TICKET_WORKSPACE_NOT_AVAILABLE", "No ticket worktree is available for this folder", {
        folderId: selectedFolder.id
      });
    }

    directory = await resolveWorkspaceDirectory(app, ticket, selectedFolder.id, selectedWorkspace, input);
  }

  return {
    directory,
    folderId: selectedFolder.id
  };
}

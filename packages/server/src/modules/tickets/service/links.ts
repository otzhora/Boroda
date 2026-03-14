import { asc, eq, inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { projectFolders, projects, ticketJiraIssueLinks, ticketProjectLinks, ticketWorkspaces } from "../../../db/schema";
import { getProjectFolderSetupInfo } from "../../../shared/worktree-setup";
import { AppError } from "../../../shared/errors";
import { nowIso, type DbExecutor } from "./shared";
import { normalizeJiraIssueKey, normalizeJiraIssueSummary } from "./activity";

export function assertUniqueProjectLinks(projectLinks: Array<{ projectId: number; relationship: string }>) {
  const projectIds = new Set<number>();
  let primaryCount = 0;

  for (const link of projectLinks) {
    if (projectIds.has(link.projectId)) {
      throw new AppError(400, "TICKET_PROJECT_DUPLICATE", "Each project can only be linked once", {
        projectId: link.projectId
      });
    }

    projectIds.add(link.projectId);

    if (link.relationship === "PRIMARY") {
      primaryCount += 1;
    }
  }

  if (primaryCount > 1) {
    throw new AppError(
      400,
      "TICKET_PRIMARY_PROJECT_CONFLICT",
      "A ticket can only have one primary project"
    );
  }
}

export function assertUniqueJiraIssueLinks(jiraIssues: Array<{ key: string; summary: string }>) {
  const issueKeys = new Set<string>();

  for (const issue of jiraIssues) {
    const normalizedKey = normalizeJiraIssueKey(issue.key);

    if (!normalizedKey) {
      throw new AppError(400, "TICKET_JIRA_KEY_REQUIRED", "Jira issue key is required");
    }

    if (issueKeys.has(normalizedKey)) {
      throw new AppError(400, "TICKET_JIRA_DUPLICATE", "Each Jira issue can only be linked once", {
        key: normalizedKey
      });
    }

    issueKeys.add(normalizedKey);
  }
}

export function ensureProjectsExist(db: DbExecutor, projectIds: number[]) {
  const uniqueProjectIds = [...new Set(projectIds)];

  if (!uniqueProjectIds.length) {
    return;
  }

  const existingProjects = db
    .select({ id: projects.id })
    .from(projects)
    .where(inArray(projects.id, uniqueProjectIds))
    .all();

  if (existingProjects.length !== uniqueProjectIds.length) {
    const existingProjectIds = new Set(existingProjects.map((project: { id: number }) => project.id));
    const missingProjectId = uniqueProjectIds.find((projectId) => !existingProjectIds.has(projectId));
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found", {
      projectId: missingProjectId
    });
  }
}

export async function loadTicketProjectLinks(app: FastifyInstance, ticketId: number) {
  const projectLinks = await app.db.query.ticketProjectLinks.findMany({
    where: eq(ticketProjectLinks.ticketId, ticketId),
    with: {
      project: {
        with: {
          folders: true
        }
      }
    }
  });

  return projectLinks.map((link) => ({
    ...link,
    project: {
      ...link.project,
      folders: link.project.folders.map((folder) => ({
        ...folder,
        setupInfo: getProjectFolderSetupInfo(folder.path)
      }))
    }
  }));
}

export async function loadTicketJiraIssueLinks(app: FastifyInstance, ticketId: number) {
  return app.db.query.ticketJiraIssueLinks.findMany({
    where: eq(ticketJiraIssueLinks.ticketId, ticketId),
    orderBy: [asc(ticketJiraIssueLinks.id)]
  });
}

export async function loadTicketWorkspaces(app: FastifyInstance, ticketId: number) {
  const workspaces = await app.db.query.ticketWorkspaces.findMany({
    where: eq(ticketWorkspaces.ticketId, ticketId),
    with: {
      projectFolder: {
        with: {
          project: true
        }
      }
    },
    orderBy: [asc(ticketWorkspaces.id)]
  });

  return workspaces.map((workspace) => ({
    ...workspace,
    projectFolder: {
      ...workspace.projectFolder,
      setupInfo: getProjectFolderSetupInfo(workspace.projectFolder.path)
    }
  }));
}

export function normalizeWorkspaceRole(role: string | undefined) {
  const normalized = role?.trim().toLowerCase();
  return normalized && normalized.length ? normalized : "primary";
}

export function normalizeWorkspaceBranch(branchName: string) {
  return branchName.trim();
}

export function deriveLegacyBranch(
  workspaces: Array<{ branchName: string; role?: string | null }>,
  fallbackBranch?: string | null
) {
  const preferredWorkspace =
    workspaces.find((workspace) => normalizeWorkspaceRole(workspace.role ?? undefined) === "primary") ?? workspaces[0];

  return preferredWorkspace?.branchName ?? fallbackBranch ?? null;
}

export function listProjectNamesById(db: DbExecutor, projectIds: number[]): Map<number, string> {
  const uniqueProjectIds = [...new Set(projectIds)];

  if (!uniqueProjectIds.length) {
    return new Map<number, string>();
  }

  const rows = db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(inArray(projects.id, uniqueProjectIds))
    .all();

  return new Map(rows.map((project: { id: number; name: string }) => [project.id, project.name]));
}

export function ensureWorkspaceFoldersExist(
  db: DbExecutor,
  projectLinks: Array<{ projectId: number }>,
  workspaces: Array<{ projectFolderId: number }>
) {
  if (!workspaces.length) {
    return [];
  }

  const folderIds = [...new Set(workspaces.map((workspace) => workspace.projectFolderId))];
  const folders = db
    .select({
      id: projectFolders.id,
      projectId: projectFolders.projectId
    })
    .from(projectFolders)
    .where(inArray(projectFolders.id, folderIds))
    .all();

  if (folders.length !== folderIds.length) {
    const existingFolderIds = new Set(folders.map((folder: { id: number }) => folder.id));
    const missingFolderId = folderIds.find((folderId) => !existingFolderIds.has(folderId));
    throw new AppError(404, "PROJECT_FOLDER_NOT_FOUND", "Project folder not found", {
      projectFolderId: missingFolderId
    });
  }

  const linkedProjectIds = new Set(projectLinks.map((link) => link.projectId));
  const unlinkedFolder = folders.find((folder: { projectId: number }) => !linkedProjectIds.has(folder.projectId));
  if (unlinkedFolder) {
    throw new AppError(400, "WORKSPACE_PROJECT_FOLDER_NOT_LINKED", "Workspace folder must belong to a project linked to the ticket", {
      projectFolderId: unlinkedFolder.id,
      projectId: unlinkedFolder.projectId
    });
  }

  return folders;
}

export function replaceWorkspaces(
  db: DbExecutor,
  ticketId: number,
  projectLinks: Array<{ projectId: number }>,
  workspaces: Array<{ projectFolderId: number; branchName: string; baseBranch?: string | null; role?: string }>
) {
  const normalizedWorkspaces = workspaces
    .map((workspace) => ({
      projectFolderId: workspace.projectFolderId,
      branchName: normalizeWorkspaceBranch(workspace.branchName),
      baseBranch: workspace.baseBranch?.trim() || null,
      role: normalizeWorkspaceRole(workspace.role)
    }))
    .filter((workspace) => workspace.branchName.length > 0);

  const uniqueKeys = new Set<string>();
  for (const workspace of normalizedWorkspaces) {
    const key = `${workspace.projectFolderId}:${workspace.branchName.toLowerCase()}`;
    if (uniqueKeys.has(key)) {
      throw new AppError(400, "TICKET_WORKSPACE_DUPLICATE", "Each workspace branch can only be linked once per folder", {
        projectFolderId: workspace.projectFolderId,
        branchName: workspace.branchName
      });
    }
    uniqueKeys.add(key);
  }

  ensureWorkspaceFoldersExist(db, projectLinks, normalizedWorkspaces);
  db.delete(ticketWorkspaces).where(eq(ticketWorkspaces.ticketId, ticketId)).run();

  if (!normalizedWorkspaces.length) {
    return;
  }

  const now = nowIso();
  db
    .insert(ticketWorkspaces)
    .values(
      normalizedWorkspaces.map((workspace) => ({
        ticketId,
        projectFolderId: workspace.projectFolderId,
        branchName: workspace.branchName,
        baseBranch: workspace.baseBranch,
        role: workspace.role,
        createdByBoroda: true,
        createdAt: now,
        updatedAt: now
      }))
    )
    .run();
}

export function replaceProjectLinks(
  db: DbExecutor,
  ticketId: number,
  projectLinks: Array<{ projectId: number; relationship: string }>
) {
  assertUniqueProjectLinks(projectLinks);
  ensureProjectsExist(
    db,
    projectLinks.map((link) => link.projectId)
  );
  db.delete(ticketProjectLinks).where(eq(ticketProjectLinks.ticketId, ticketId)).run();

  if (!projectLinks.length) {
    return;
  }

  const now = nowIso();
  db
    .insert(ticketProjectLinks)
    .values(
      projectLinks.map((link) => ({
        ticketId,
        projectId: link.projectId,
        relationship: link.relationship,
        createdAt: now
      }))
    )
    .run();
}

export function replaceJiraIssueLinks(
  db: DbExecutor,
  ticketId: number,
  jiraIssues: Array<{ key: string; summary: string }>
) {
  assertUniqueJiraIssueLinks(jiraIssues);
  db.delete(ticketJiraIssueLinks).where(eq(ticketJiraIssueLinks.ticketId, ticketId)).run();

  if (!jiraIssues.length) {
    return;
  }

  const now = nowIso();
  db
    .insert(ticketJiraIssueLinks)
    .values(
      jiraIssues.map((issue) => ({
        ticketId,
        issueKey: normalizeJiraIssueKey(issue.key),
        issueSummary: normalizeJiraIssueSummary(issue.summary),
        createdAt: now
      }))
    )
    .run();
}

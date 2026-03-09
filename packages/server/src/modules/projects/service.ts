import { and, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/errors";
import { normalizeWslPath, resolvePathInfo } from "../../shared/path-utils";
import { getProjectFolderSetupInfo, scaffoldProjectFolderWorktreeSetup } from "../../shared/worktree-setup";
import { projectFolders, projects } from "../../db/schema";

function nowIso() {
  return new Date().toISOString();
}

function enrichProjectFolder<T extends { path: string }>(folder: T) {
  return {
    ...folder,
    setupInfo: getProjectFolderSetupInfo(folder.path)
  };
}

function enrichProject<T extends { folders: Array<{ path: string }> }>(project: T) {
  return {
    ...project,
    folders: project.folders.map((folder) => enrichProjectFolder(folder))
  };
}

function isSqliteUniqueConstraintError(
  error: unknown,
  constraintTarget: string
): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
    error.message.includes(constraintTarget)
  );
}

function rethrowProjectConflict(error: unknown): never {
  if (isSqliteUniqueConstraintError(error, "projects.slug")) {
    throw new AppError(409, "PROJECT_SLUG_CONFLICT", "Project slug already exists", {
      field: "slug"
    });
  }

  if (isSqliteUniqueConstraintError(error, "project_folders.path")) {
    throw new AppError(409, "PROJECT_FOLDER_PATH_CONFLICT", "Project folder path already exists", {
      field: "path"
    });
  }

  throw error;
}

export async function listProjects(app: FastifyInstance) {
  const items = await app.db.query.projects.findMany({
    with: {
      folders: true
    },
    orderBy: (table, operators) => [operators.desc(table.updatedAt)]
  });

  return items.map((project) => enrichProject(project));
}

export async function getProjectOrThrow(app: FastifyInstance, id: number) {
  const project = await app.db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: {
      folders: true
    }
  });

  if (!project) {
    throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  }

  return enrichProject(project);
}

export async function createProject(
  app: FastifyInstance,
  input: { name: string; slug: string; description: string; color: string }
) {
  const now = nowIso();
  try {
    const result = app.db
      .insert(projects)
      .values({ ...input, createdAt: now, updatedAt: now })
      .returning()
      .get();

    return result;
  } catch (error) {
    rethrowProjectConflict(error);
  }
}

export async function updateProject(
  app: FastifyInstance,
  id: number,
  input: Partial<{ name: string; slug: string; description: string; color: string }>
) {
  await getProjectOrThrow(app, id);

  try {
    const result = app.db
      .update(projects)
      .set({
        ...input,
        updatedAt: nowIso()
      })
      .where(eq(projects.id, id))
      .returning()
      .get();

    return result;
  } catch (error) {
    rethrowProjectConflict(error);
  }
}

export async function deleteProject(app: FastifyInstance, id: number) {
  await getProjectOrThrow(app, id);
  app.db.delete(projects).where(eq(projects.id, id)).run();
  return { ok: true };
}

export async function createProjectFolder(
  app: FastifyInstance,
  projectId: number,
  input: { label: string; path: string; defaultBranch?: string | null; kind: string; isPrimary: boolean }
) {
  await getProjectOrThrow(app, projectId);
  const pathInfo = await resolvePathInfo(input.path);
  const now = nowIso();

  if (input.isPrimary) {
    app.db
      .update(projectFolders)
      .set({ isPrimary: false, updatedAt: now })
      .where(eq(projectFolders.projectId, projectId))
      .run();
  }

  try {
    const folder = app.db
      .insert(projectFolders)
      .values({
        projectId,
        label: input.label,
        path: normalizeWslPath(input.path),
        defaultBranch: input.defaultBranch?.trim() || null,
        kind: input.kind,
        isPrimary: input.isPrimary,
        existsOnDisk: pathInfo.exists,
        createdAt: now,
        updatedAt: now
      })
      .returning()
      .get();

    return {
      ...enrichProjectFolder(folder),
      pathInfo
    };
  } catch (error) {
    rethrowProjectConflict(error);
  }
}

export async function updateProjectFolder(
  app: FastifyInstance,
  id: number,
  input: Partial<{ label: string; path: string; defaultBranch: string | null; kind: string; isPrimary: boolean }>
) {
  const existing = app.db
    .select()
    .from(projectFolders)
    .where(eq(projectFolders.id, id))
    .get();

  if (!existing) {
    throw new AppError(404, "PROJECT_FOLDER_NOT_FOUND", "Project folder not found");
  }

  let pathInfo = null;
  let normalizedPath = input.path;

  if (input.path) {
    pathInfo = await resolvePathInfo(input.path);
    normalizedPath = normalizeWslPath(input.path);
  }

  const now = nowIso();

  if (input.isPrimary) {
    app.db
      .update(projectFolders)
      .set({ isPrimary: false, updatedAt: now })
      .where(
        and(eq(projectFolders.projectId, existing.projectId), eq(projectFolders.isPrimary, true))
      )
      .run();
  }

  try {
    const folder = app.db
      .update(projectFolders)
      .set({
        ...input,
        path: normalizedPath,
        defaultBranch: input.defaultBranch === undefined ? existing.defaultBranch : input.defaultBranch?.trim() || null,
        existsOnDisk: pathInfo?.exists ?? existing.existsOnDisk,
        updatedAt: now
      })
      .where(eq(projectFolders.id, id))
      .returning()
      .get();

    return {
      ...enrichProjectFolder(folder),
      pathInfo
    };
  } catch (error) {
    rethrowProjectConflict(error);
  }
}

export async function deleteProjectFolder(app: FastifyInstance, id: number) {
  const existing = app.db
    .select()
    .from(projectFolders)
    .where(eq(projectFolders.id, id))
    .get();

  if (!existing) {
    throw new AppError(404, "PROJECT_FOLDER_NOT_FOUND", "Project folder not found");
  }

  app.db.delete(projectFolders).where(eq(projectFolders.id, id)).run();
  return { ok: true };
}

export async function scaffoldProjectFolderSetup(app: FastifyInstance, id: number) {
  const existing = app.db
    .select()
    .from(projectFolders)
    .where(eq(projectFolders.id, id))
    .get();

  if (!existing) {
    throw new AppError(404, "PROJECT_FOLDER_NOT_FOUND", "Project folder not found");
  }

  if (!existing.existsOnDisk) {
    throw new AppError(409, "PROJECT_FOLDER_NOT_AVAILABLE", "Project folder is not available on disk", {
      folderId: id
    });
  }

  const setupInfo = await scaffoldProjectFolderWorktreeSetup(existing.path);
  const updatedAt = nowIso();
  const folder = app.db
    .update(projectFolders)
    .set({ updatedAt })
    .where(eq(projectFolders.id, id))
    .returning()
    .get();

  return {
    ...folder,
    setupInfo
  };
}

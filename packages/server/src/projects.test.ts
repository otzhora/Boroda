import { mkdtemp, mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let sqlite: { close: () => void };
let projectsTable: (typeof import("./db/schema"))["projects"];
let projectFoldersTable: (typeof import("./db/schema"))["projectFolders"];
let tempRoot = "";
let existingFolderPath = "";
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-m2-tests-"));
  existingFolderPath = path.join(tempRoot, "workspace-folder");
  await mkdir(existingFolderPath, { recursive: true });

  process.env.BORODA_DB_PATH = path.join(tempRoot, "test.sqlite");

  const [{ buildApp }, dbClient, schema] = await Promise.all([
    import("./app"),
    import("./db/client"),
    import("./db/schema")
  ]);

  sqlite = dbClient.sqlite;
  projectsTable = schema.projects;
  projectFoldersTable = schema.projectFolders;

  migrate(dbClient.db, {
    migrationsFolder: path.resolve(repoRoot, "drizzle/migrations")
  });

  app = buildApp();
  await app.ready();
});

beforeEach(() => {
  app.db.delete(projectFoldersTable).run();
  app.db.delete(projectsTable).run();
});

after(async () => {
  await app.close();
  sqlite.close();
  await rm(tempRoot, { recursive: true, force: true });
});

test("project CRUD works through the API", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Payments Backend",
      slug: "payments-backend",
      description: "Main backend system",
      color: "#355c7d"
    }
  });

  assert.equal(createResponse.statusCode, 200);
  const createdProject = createResponse.json();
  assert.equal(createdProject.name, "Payments Backend");
  assert.equal(createdProject.slug, "payments-backend");

  const listResponse = await app.inject({
    method: "GET",
    url: "/api/projects"
  });

  assert.equal(listResponse.statusCode, 200);
  assert.deepEqual(listResponse.json(), [
    {
      ...createdProject,
      folders: []
    }
  ]);

  const getResponse = await app.inject({
    method: "GET",
    url: `/api/projects/${createdProject.id}`
  });

  assert.equal(getResponse.statusCode, 200);
  assert.deepEqual(getResponse.json(), {
    ...createdProject,
    folders: []
  });

  const patchResponse = await app.inject({
    method: "PATCH",
    url: `/api/projects/${createdProject.id}`,
    payload: {
      description: "Updated description",
      color: "#101820"
    }
  });

  assert.equal(patchResponse.statusCode, 200);
  const updatedProject = patchResponse.json();
  assert.equal(updatedProject.description, "Updated description");
  assert.equal(updatedProject.color, "#101820");

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/projects/${createdProject.id}`
  });

  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(deleteResponse.json(), { ok: true });

  const missingResponse = await app.inject({
    method: "GET",
    url: `/api/projects/${createdProject.id}`
  });

  assert.equal(missingResponse.statusCode, 404);
  assert.deepEqual(missingResponse.json(), {
    error: {
      code: "PROJECT_NOT_FOUND",
      message: "Project not found",
      details: {}
    }
  });
});

test("project folder CRUD validates paths and updates primary state", async () => {
  const projectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Infra",
      slug: "infra",
      description: "",
      color: "#223344"
    }
  });
  const project = projectResponse.json();

  const createFolderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${project.id}/folders`,
    payload: {
      label: "workspace",
      path: existingFolderPath,
      kind: "APP",
      isPrimary: true
    }
  });

  assert.equal(createFolderResponse.statusCode, 200);
  const createdFolder = createFolderResponse.json();
  assert.equal(createdFolder.path, existingFolderPath);
  assert.equal(createdFolder.existsOnDisk, true);
  assert.equal(createdFolder.isPrimary, true);
  assert.deepEqual(createdFolder.pathInfo, {
    path: existingFolderPath,
    resolvedPath: existingFolderPath,
    exists: true,
    isDirectory: true
  });

  const secondFolderPath = path.join(tempRoot, "missing-folder");
  const secondFolderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${project.id}/folders`,
    payload: {
      label: "docs",
      path: secondFolderPath,
      kind: "DOCS",
      isPrimary: true
    }
  });

  assert.equal(secondFolderResponse.statusCode, 200);
  const secondFolder = secondFolderResponse.json();
  assert.equal(secondFolder.existsOnDisk, false);
  assert.equal(secondFolder.isPrimary, true);
  assert.equal(secondFolder.pathInfo.exists, false);

  const projectWithFoldersResponse = await app.inject({
    method: "GET",
    url: `/api/projects/${project.id}`
  });

  assert.equal(projectWithFoldersResponse.statusCode, 200);
  const projectWithFolders = projectWithFoldersResponse.json();
  assert.equal(projectWithFolders.folders.length, 2);

  const previousPrimaryFolder = projectWithFolders.folders.find(
    (folder: { id: number }) => folder.id === createdFolder.id
  );
  assert.ok(previousPrimaryFolder);
  assert.equal(previousPrimaryFolder.isPrimary, false);

  const validPatchFolderResponse = await app.inject({
    method: "PATCH",
    url: `/api/project-folders/${secondFolder.id}`,
    payload: {
      label: "docs-updated",
      kind: "OTHER",
      path: path.join(tempRoot, "docs-updated"),
      isPrimary: false
    }
  });

  assert.equal(validPatchFolderResponse.statusCode, 200);
  const updatedFolder = validPatchFolderResponse.json();
  assert.equal(updatedFolder.label, "docs-updated");
  assert.equal(updatedFolder.kind, "OTHER");
  assert.equal(updatedFolder.existsOnDisk, false);

  const deleteFolderResponse = await app.inject({
    method: "DELETE",
    url: `/api/project-folders/${createdFolder.id}`
  });

  assert.equal(deleteFolderResponse.statusCode, 200);
  assert.deepEqual(deleteFolderResponse.json(), { ok: true });
});

test("duplicate project slugs and folder paths return 409 conflicts", async () => {
  const firstProjectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Payments",
      slug: "payments",
      description: "",
      color: "#111111"
    }
  });

  assert.equal(firstProjectResponse.statusCode, 200);
  const firstProject = firstProjectResponse.json();

  const duplicateProjectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Payments Duplicate",
      slug: "payments",
      description: "",
      color: "#222222"
    }
  });

  assert.equal(duplicateProjectResponse.statusCode, 409);
  assert.deepEqual(duplicateProjectResponse.json(), {
    error: {
      code: "PROJECT_SLUG_CONFLICT",
      message: "Project slug already exists",
      details: {
        field: "slug"
      }
    }
  });

  const secondProjectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Billing",
      slug: "billing",
      description: "",
      color: "#333333"
    }
  });

  assert.equal(secondProjectResponse.statusCode, 200);
  const secondProject = secondProjectResponse.json();

  const duplicateUpdateResponse = await app.inject({
    method: "PATCH",
    url: `/api/projects/${secondProject.id}`,
    payload: {
      slug: "payments"
    }
  });

  assert.equal(duplicateUpdateResponse.statusCode, 409);
  assert.deepEqual(duplicateUpdateResponse.json(), {
    error: {
      code: "PROJECT_SLUG_CONFLICT",
      message: "Project slug already exists",
      details: {
        field: "slug"
      }
    }
  });

  const firstFolderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${firstProject.id}/folders`,
    payload: {
      label: "workspace",
      path: existingFolderPath,
      kind: "APP",
      isPrimary: true
    }
  });

  assert.equal(firstFolderResponse.statusCode, 200);

  const duplicateFolderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${secondProject.id}/folders`,
    payload: {
      label: "workspace-copy",
      path: existingFolderPath,
      kind: "APP",
      isPrimary: false
    }
  });

  assert.equal(duplicateFolderResponse.statusCode, 409);
  assert.deepEqual(duplicateFolderResponse.json(), {
    error: {
      code: "PROJECT_FOLDER_PATH_CONFLICT",
      message: "Project folder path already exists",
      details: {
        field: "path"
      }
    }
  });
});

test("path validation route returns normalized metadata and validation errors", async () => {
  const validResponse = await app.inject({
    method: "POST",
    url: "/api/fs/validate-path",
    payload: {
      path: existingFolderPath
    }
  });

  assert.equal(validResponse.statusCode, 200);
  assert.deepEqual(validResponse.json(), {
    path: existingFolderPath,
    resolvedPath: existingFolderPath,
    exists: true,
    isDirectory: true
  });

  const invalidResponse = await app.inject({
    method: "POST",
    url: "/api/fs/validate-path",
    payload: {
      path: "relative/path"
    }
  });

  assert.equal(invalidResponse.statusCode, 400);
  assert.deepEqual(invalidResponse.json(), {
    error: {
      code: "INVALID_PATH",
      message: "Path must be absolute",
      details: {}
    }
  });
});

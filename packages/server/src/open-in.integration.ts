// This integration harness is kept out of the default `src/*.test.ts` glob because
// Node's test runner is currently aborting the file before assertions surface.
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let sqlite: { close: () => void };
let projectsTable: (typeof import("./db/schema"))["projects"];
let projectFoldersTable: (typeof import("./db/schema"))["projectFolders"];
let ticketsTable: (typeof import("./db/schema"))["tickets"];
let ticketProjectLinksTable: (typeof import("./db/schema"))["ticketProjectLinks"];
let ticketWorkspacesTable: (typeof import("./db/schema"))["ticketWorkspaces"];
let tempRoot = "";
let existingFolderPath = "";
let gitRepoFolderPath = "";
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const previousWslDistroName = process.env.WSL_DISTRO_NAME;
const previousExplorerBin = process.env.BORODA_EXPLORER_BIN;
const previousVscodeBin = process.env.BORODA_VSCODE_BIN;
const previousCursorBin = process.env.BORODA_CURSOR_BIN;
const previousTerminalBin = process.env.BORODA_TERMINAL_BIN;
const previousWorktreesPath = process.env.BORODA_WORKTREES_PATH;

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-open-in-tests-"));
  existingFolderPath = path.join(tempRoot, "workspace-folder");
  gitRepoFolderPath = path.join(tempRoot, "git-workspace-folder");
  await mkdir(existingFolderPath, { recursive: true });
  await mkdir(gitRepoFolderPath, { recursive: true });

  process.env.BORODA_DB_PATH = path.join(tempRoot, "test.sqlite");
  process.env.WSL_DISTRO_NAME = "boroda-test";
  process.env.BORODA_EXPLORER_BIN = "/bin/true";
  process.env.BORODA_VSCODE_BIN = "/bin/true";
  process.env.BORODA_CURSOR_BIN = "/bin/true";
  process.env.BORODA_TERMINAL_BIN = "/bin/true";
  process.env.BORODA_WORKTREES_PATH = path.join(tempRoot, "managed-worktrees");

  const [{ buildApp }, dbClient, schema] = await Promise.all([
    import("./app"),
    import("./db/client"),
    import("./db/schema")
  ]);

  sqlite = dbClient.sqlite;
  projectsTable = schema.projects;
  projectFoldersTable = schema.projectFolders;
  ticketsTable = schema.tickets;
  ticketProjectLinksTable = schema.ticketProjectLinks;
  ticketWorkspacesTable = schema.ticketWorkspaces;

  migrate(dbClient.db, {
    migrationsFolder: path.resolve(repoRoot, "drizzle/migrations")
  });

  app = buildApp();
  await app.ready();
});

function resetOpenInState() {
  app.db.delete(ticketWorkspacesTable).run();
  app.db.delete(ticketProjectLinksTable).run();
  app.db.delete(projectFoldersTable).run();
  app.db.delete(ticketsTable).run();
  app.db.delete(projectsTable).run();
  process.env.WSL_DISTRO_NAME = "boroda-test";
  process.env.BORODA_EXPLORER_BIN = "/bin/true";
  process.env.BORODA_VSCODE_BIN = "/bin/true";
  process.env.BORODA_CURSOR_BIN = "/bin/true";
  process.env.BORODA_TERMINAL_BIN = "/bin/true";
  process.env.BORODA_WORKTREES_PATH = path.join(tempRoot, "managed-worktrees");
}

after(async () => {
  if (previousWslDistroName === undefined) {
    delete process.env.WSL_DISTRO_NAME;
  } else {
    process.env.WSL_DISTRO_NAME = previousWslDistroName;
  }

  if (previousExplorerBin === undefined) {
    delete process.env.BORODA_EXPLORER_BIN;
  } else {
    process.env.BORODA_EXPLORER_BIN = previousExplorerBin;
  }

  if (previousVscodeBin === undefined) {
    delete process.env.BORODA_VSCODE_BIN;
  } else {
    process.env.BORODA_VSCODE_BIN = previousVscodeBin;
  }

  if (previousCursorBin === undefined) {
    delete process.env.BORODA_CURSOR_BIN;
  } else {
    process.env.BORODA_CURSOR_BIN = previousCursorBin;
  }

  if (previousTerminalBin === undefined) {
    delete process.env.BORODA_TERMINAL_BIN;
  } else {
    process.env.BORODA_TERMINAL_BIN = previousTerminalBin;
  }

  if (previousWorktreesPath === undefined) {
    delete process.env.BORODA_WORKTREES_PATH;
  } else {
    process.env.BORODA_WORKTREES_PATH = previousWorktreesPath;
  }

  await app.close();
  sqlite.close();
  await rm(tempRoot, { recursive: true, force: true });
});

async function createTicketWithFolder(projectName: string) {
  const projectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: projectName,
      slug: projectName.toLowerCase().replace(/\s+/g, "-"),
      description: "",
      color: "#355c7d"
    }
  });
  const project = projectResponse.json();

  const folderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${project.id}/folders`,
    payload: {
      label: "workspace",
      path: existingFolderPath,
      kind: "APP",
      isPrimary: true
    }
  });
  const folder = folderResponse.json();

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: `Open ${projectName}`,
      description: "",
      status: "READY",
      priority: "HIGH",
      projectLinks: [
        {
          projectId: project.id,
          relationship: "PRIMARY"
        }
      ]
    }
  });
  const ticket = ticketResponse.json();

  return { project, folder, ticket };
}

function git(cwd: string, ...args: string[]) {
  execFileSync("git", args, {
    cwd,
    stdio: "pipe"
  });
}

async function createGitWorkspaceRepo() {
  await rm(gitRepoFolderPath, { recursive: true, force: true });
  await mkdir(gitRepoFolderPath, { recursive: true });
  git(gitRepoFolderPath, "init", "--initial-branch=main");
  git(gitRepoFolderPath, "config", "user.email", "boroda@example.test");
  git(gitRepoFolderPath, "config", "user.name", "Boroda Tests");
  await writeFile(path.join(gitRepoFolderPath, "README.md"), "main\n");
  git(gitRepoFolderPath, "add", "README.md");
  git(gitRepoFolderPath, "commit", "-m", "init");
}

function serialTest(name: string, fn: () => Promise<void>) {
  return test(name, { concurrency: false }, fn);
}

serialTest("opens VS Code for the primary linked project folder", async () => {
  resetOpenInState();
  const { folder, ticket } = await createTicketWithFolder("Payments Backend");

  const response = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "vscode"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    directory: folder.path,
    target: "vscode"
  });
});

serialTest("opens Terminal for the primary linked project folder", async () => {
  resetOpenInState();
  const { folder, ticket } = await createTicketWithFolder("CLI Tools");

  const response = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "terminal"
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    directory: folder.path,
    target: "terminal"
  });
});

serialTest("opens Cursor for the selected linked project folder", async () => {
  resetOpenInState();
  const projectOneResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Payments Backend",
      slug: "payments-backend",
      description: "",
      color: "#355c7d"
    }
  });
  const projectOne = projectOneResponse.json();

  const projectTwoResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Admin Dashboard",
      slug: "admin-dashboard",
      description: "",
      color: "#4f6d7a"
    }
  });
  const projectTwo = projectTwoResponse.json();

  await app.inject({
    method: "POST",
    url: `/api/projects/${projectOne.id}/folders`,
    payload: {
      label: "workspace",
      path: existingFolderPath,
      kind: "APP",
      isPrimary: true
    }
  });

  const secondaryFolderPath = path.join(tempRoot, "secondary-folder");
  await mkdir(secondaryFolderPath, { recursive: true });
  const secondFolderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${projectTwo.id}/folders`,
    payload: {
      label: "workspace",
      path: secondaryFolderPath,
      kind: "APP",
      isPrimary: true
    }
  });
  const secondFolder = secondFolderResponse.json();

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Open selected folder",
      description: "",
      status: "READY",
      priority: "HIGH",
      projectLinks: [
        {
          projectId: projectOne.id,
          relationship: "PRIMARY"
        },
        {
          projectId: projectTwo.id,
          relationship: "RELATED"
        }
      ]
    }
  });
  const ticket = ticketResponse.json();

  const response = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "cursor",
      folderId: secondFolder.id
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    ok: true,
    directory: secondFolder.path,
    target: "cursor"
  });
});

serialTest("returns 409 when the ticket has no available linked project folder", async () => {
  resetOpenInState();
  const projectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Docs",
      slug: "docs",
      description: "",
      color: "#223344"
    }
  });
  const project = projectResponse.json();

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Missing repo path",
      description: "",
      status: "INBOX",
      priority: "MEDIUM",
      projectLinks: [
        {
          projectId: project.id,
          relationship: "PRIMARY"
        }
      ]
    }
  });
  const ticket = ticketResponse.json();

  const response = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "explorer"
    }
  });

  assert.equal(response.statusCode, 409);
  assert.deepEqual(response.json(), {
    error: {
      code: "TICKET_PROJECT_FOLDER_NOT_AVAILABLE",
      message: "No linked project folder is available for this ticket",
      details: {}
    }
  });
});

serialTest("opens a Boroda-managed worktree when the ticket has one workspace for the selected folder", async () => {
  resetOpenInState();
  await createGitWorkspaceRepo();
  git(gitRepoFolderPath, "checkout", "-b", "feature/existing-worktree");
  await writeFile(path.join(gitRepoFolderPath, "feature.txt"), "workspace\n");
  git(gitRepoFolderPath, "add", "feature.txt");
  git(gitRepoFolderPath, "commit", "-m", "workspace branch");
  git(gitRepoFolderPath, "checkout", "main");

  const projectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Managed Repo",
      slug: "managed-repo",
      description: "",
      color: "#355c7d"
    }
  });
  const project = projectResponse.json();

  const folderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${project.id}/folders`,
    payload: {
      label: "workspace",
      path: gitRepoFolderPath,
      defaultBranch: "main",
      kind: "APP",
      isPrimary: true
    }
  });
  const folder = folderResponse.json();

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Open managed workspace",
      description: "",
      branch: "feature/existing-worktree",
      workspaces: [
        {
          projectFolderId: folder.id,
          branchName: "feature/existing-worktree",
          role: "primary"
        }
      ],
      status: "READY",
      priority: "HIGH",
      projectLinks: [
        {
          projectId: project.id,
          relationship: "PRIMARY"
        }
      ]
    }
  });
  const ticket = ticketResponse.json();

  const response = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "vscode"
    }
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.equal(payload.target, "vscode");
  assert.notEqual(payload.directory, folder.path);
  assert.equal(
    payload.directory,
    path.join(tempRoot, "managed-worktrees", ticket.key, "managed-repo", "workspace", "feature-existing-worktree")
  );
});

serialTest("returns 409 when multiple workspaces exist for the selected folder and no workspace is chosen", async () => {
  resetOpenInState();
  await createGitWorkspaceRepo();
  const projectResponse = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name: "Conflict Repo",
      slug: "conflict-repo",
      description: "",
      color: "#355c7d"
    }
  });
  const project = projectResponse.json();

  const folderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${project.id}/folders`,
    payload: {
      label: "workspace",
      path: gitRepoFolderPath,
      defaultBranch: "main",
      kind: "APP",
      isPrimary: true
    }
  });
  const folder = folderResponse.json();

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Open conflicting workspace",
      description: "",
      workspaces: [
        {
          projectFolderId: folder.id,
          branchName: "feature/one",
          role: "primary"
        },
        {
          projectFolderId: folder.id,
          branchName: "feature/two",
          role: "secondary"
        }
      ],
      status: "READY",
      priority: "HIGH",
      projectLinks: [
        {
          projectId: project.id,
          relationship: "PRIMARY"
        }
      ]
    }
  });
  const ticket = ticketResponse.json();

  const response = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "vscode"
    }
  });

  assert.equal(response.statusCode, 409);
  assert.equal(response.json().error.code, "TICKET_WORKSPACE_SELECTION_REQUIRED");
  assert.equal(response.json().error.details.workspaces.length, 2);
});

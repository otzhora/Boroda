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
let ticketsTable: (typeof import("./db/schema"))["tickets"];
let ticketProjectLinksTable: (typeof import("./db/schema"))["ticketProjectLinks"];
let tempRoot = "";
let existingFolderPath = "";
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const previousWslDistroName = process.env.WSL_DISTRO_NAME;
const previousExplorerBin = process.env.BORODA_EXPLORER_BIN;
const previousVscodeBin = process.env.BORODA_VSCODE_BIN;
const previousCursorBin = process.env.BORODA_CURSOR_BIN;
const previousTerminalBin = process.env.BORODA_TERMINAL_BIN;

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-open-in-tests-"));
  existingFolderPath = path.join(tempRoot, "workspace-folder");
  await mkdir(existingFolderPath, { recursive: true });

  process.env.BORODA_DB_PATH = path.join(tempRoot, "test.sqlite");
  process.env.WSL_DISTRO_NAME = "boroda-test";
  process.env.BORODA_EXPLORER_BIN = "/bin/true";
  process.env.BORODA_VSCODE_BIN = "/bin/true";
  process.env.BORODA_CURSOR_BIN = "/bin/true";
  process.env.BORODA_TERMINAL_BIN = "/bin/true";

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

  migrate(dbClient.db, {
    migrationsFolder: path.resolve(repoRoot, "drizzle/migrations")
  });

  app = buildApp();
  await app.ready();
});

beforeEach(() => {
  app.db.delete(ticketProjectLinksTable).run();
  app.db.delete(projectFoldersTable).run();
  app.db.delete(ticketsTable).run();
  app.db.delete(projectsTable).run();
  process.env.WSL_DISTRO_NAME = "boroda-test";
  process.env.BORODA_EXPLORER_BIN = "/bin/true";
  process.env.BORODA_VSCODE_BIN = "/bin/true";
  process.env.BORODA_CURSOR_BIN = "/bin/true";
  process.env.BORODA_TERMINAL_BIN = "/bin/true";
});

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

test("opens VS Code for the primary linked project folder", async () => {
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

test("opens Terminal for the primary linked project folder", async () => {
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

test("opens Cursor for the selected linked project folder", async () => {
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

test("returns 409 when the ticket has no available linked project folder", async () => {
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

test("returns 501 when the selected target app is unavailable", async () => {
  process.env.BORODA_CURSOR_BIN = path.join(tempRoot, "missing-cursor");

  const { ticket } = await createTicketWithFolder("Infra");

  const response = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "cursor"
    }
  });

  assert.equal(response.statusCode, 501);
  assert.deepEqual(response.json(), {
    error: {
      code: "OPEN_TARGET_NOT_AVAILABLE",
      message: "Cursor is not available on this machine",
      details: {}
    }
  });
});

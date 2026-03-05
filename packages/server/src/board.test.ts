import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let sqlite: { close: () => void };
let schema: typeof import("./db/schema");
let tempRoot = "";
const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-m4-tests-"));
  process.env.BORODA_DB_PATH = path.join(tempRoot, "test.sqlite");

  const [{ buildApp }, dbClient, importedSchema] = await Promise.all([
    import("./app"),
    import("./db/client"),
    import("./db/schema")
  ]);

  sqlite = dbClient.sqlite;
  schema = importedSchema;

  migrate(dbClient.db, {
    migrationsFolder: path.resolve(repoRoot, "drizzle/migrations")
  });

  app = buildApp();
  await app.ready();
});

beforeEach(() => {
  app.db.delete(schema.ticketActivities).run();
  app.db.delete(schema.workContexts).run();
  app.db.delete(schema.ticketJiraIssueLinks).run();
  app.db.delete(schema.ticketProjectLinks).run();
  app.db.delete(schema.tickets).run();
  app.db.delete(schema.projectFolders).run();
  app.db.delete(schema.projects).run();
  app.db.delete(schema.sequences).run();
});

after(async () => {
  await app.close();
  sqlite.close();
  await rm(tempRoot, { recursive: true, force: true });
});

async function createProject(name: string, slug: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/projects",
    payload: {
      name,
      slug,
      description: "",
      color: "#355c7d"
    }
  });

  assert.equal(response.statusCode, 200);
  return response.json();
}

async function createTicket(payload: {
  title: string;
  description: string;
  status: string;
  priority: string;
  jiraIssues?: Array<{ key: string; summary: string }>;
  projectLinks: Array<{ projectId: number; relationship: string }>;
}) {
  const response = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload
  });

  assert.equal(response.statusCode, 200);
  return response.json();
}

test("board endpoint groups tickets by status and includes context counts and project badges", async () => {
  const appProject = await createProject("Payments Backend", "payments-backend");
  const infraProject = await createProject("Payments Infra", "payments-infra");

  const inboxTicket = await createTicket({
    title: "Wire board filters",
    description: "Search and project filtering",
    jiraIssues: [
      { key: "PAY-42", summary: "Board filter work" },
      { key: "PAY-43", summary: "Board card polish" }
    ],
    status: "INBOX",
    priority: "HIGH",
    projectLinks: [
      { projectId: appProject.id, relationship: "PRIMARY" },
      { projectId: infraProject.id, relationship: "RELATED" }
    ]
  });

  const doneTicket = await createTicket({
    title: "Ship board shell",
    description: "Initial board delivery",
    status: "DONE",
    priority: "MEDIUM",
    projectLinks: [{ projectId: appProject.id, relationship: "PRIMARY" }]
  });

  const contextResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${inboxTicket.id}/contexts`,
    payload: {
      type: "NOTE",
      label: "Spec notes",
      value: "Need query filters",
      meta: {}
    }
  });

  assert.equal(contextResponse.statusCode, 200);

  const boardResponse = await app.inject({
    method: "GET",
    url: "/api/board"
  });

  assert.equal(boardResponse.statusCode, 200);
  const board = boardResponse.json();
  assert.equal(board.columns.length, 7);

  const inboxColumn = board.columns.find((column: { status: string }) => column.status === "INBOX");
  const doneColumn = board.columns.find((column: { status: string }) => column.status === "DONE");

  assert.ok(inboxColumn);
  assert.ok(doneColumn);
  assert.equal(inboxColumn.tickets.length, 1);
  assert.equal(doneColumn.tickets.length, 1);
  assert.equal(inboxColumn.tickets[0].title, "Wire board filters");
  assert.equal(inboxColumn.tickets[0].contextsCount, 1);
  assert.deepEqual(inboxColumn.tickets[0].jiraIssues, [
    { key: "PAY-42", summary: "Board filter work" },
    { key: "PAY-43", summary: "Board card polish" }
  ]);
  assert.deepEqual(
    inboxColumn.tickets[0].projectBadges.map(
      (badge: { name: string; color: string; relationship: string }) => ({
      name: badge.name,
      color: badge.color,
      relationship: badge.relationship
      })
    ),
    [
      { name: "Payments Backend", color: "#355c7d", relationship: "PRIMARY" },
      { name: "Payments Infra", color: "#355c7d", relationship: "RELATED" }
    ]
  );
  assert.equal(doneColumn.tickets[0].id, doneTicket.id);
});

test("board endpoint applies project, priority, and text filters together", async () => {
  const appProject = await createProject("App", "app");
  const infraProject = await createProject("Infra", "infra");

  await createTicket({
    title: "Terraform drift fix",
    description: "Infra review and apply",
    jiraIssues: [{ key: "OPS-12", summary: "Drift fix" }],
    status: "READY",
    priority: "HIGH",
    projectLinks: [{ projectId: infraProject.id, relationship: "PRIMARY" }]
  });

  await createTicket({
    title: "Terraform docs",
    description: "Documentation only",
    status: "READY",
    priority: "LOW",
    projectLinks: [{ projectId: infraProject.id, relationship: "PRIMARY" }]
  });

  await createTicket({
    title: "Application bugfix",
    description: "User-facing issue",
    status: "READY",
    priority: "HIGH",
    projectLinks: [{ projectId: appProject.id, relationship: "PRIMARY" }]
  });

  const boardResponse = await app.inject({
    method: "GET",
    url: `/api/board?projectId=${infraProject.id}&priority=HIGH&q=OPS-12`
  });

  assert.equal(boardResponse.statusCode, 200);
  const board = boardResponse.json();
  const filteredTickets = board.columns.flatMap((column: { tickets: unknown[] }) => column.tickets);

  assert.equal(filteredTickets.length, 1);
  assert.equal(filteredTickets[0].title, "Terraform drift fix");
  assert.equal(filteredTickets[0].priority, "HIGH");
});

test("export endpoint returns a workspace snapshot with current records", async () => {
  const appProject = await createProject("Board App", "board-app");
  const ticket = await createTicket({
    title: "Prepare export snapshot",
    description: "Verify export payload",
    status: "READY",
    priority: "MEDIUM",
    projectLinks: [{ projectId: appProject.id, relationship: "PRIMARY" }]
  });

  const exportResponse = await app.inject({
    method: "GET",
    url: "/api/export"
  });

  assert.equal(exportResponse.statusCode, 200);
  assert.match(
    exportResponse.headers["content-disposition"] ?? "",
    /^attachment; filename="boroda-export-\d{4}-\d{2}-\d{2}\.json"$/
  );

  const snapshot = exportResponse.json();
  assert.equal(typeof snapshot.exportedAt, "string");
  assert.equal(snapshot.data.projects.length, 1);
  assert.equal(snapshot.data.tickets.length, 1);
  assert.equal(snapshot.data.ticketProjectLinks.length, 1);
  assert.equal(snapshot.data.ticketJiraIssueLinks.length, 0);
  assert.equal(snapshot.data.projects[0].id, appProject.id);
  assert.equal(snapshot.data.tickets[0].id, ticket.id);
});

test("import endpoint refuses to overwrite existing data without replacement", async () => {
  const appProject = await createProject("Import Source", "import-source");

  const exportResponse = await app.inject({
    method: "GET",
    url: "/api/export"
  });

  assert.equal(exportResponse.statusCode, 200);

  const importResponse = await app.inject({
    method: "POST",
    url: "/api/import",
    payload: {
      replaceExisting: false,
      snapshot: exportResponse.json()
    }
  });

  assert.equal(importResponse.statusCode, 409);
  assert.equal(importResponse.json().error.code, "IMPORT_REQUIRES_REPLACE");

  const projectsResponse = await app.inject({
    method: "GET",
    url: "/api/projects"
  });

  assert.equal(projectsResponse.statusCode, 200);
  assert.equal(projectsResponse.json()[0].id, appProject.id);
});

test("import endpoint replaces workspace data from an exported snapshot", async () => {
  const sourceProject = await createProject("Snapshot Project", "snapshot-project");
  const sourceTicket = await createTicket({
    title: "Snapshot ticket",
    description: "Roundtrip import test",
    status: "READY",
    priority: "HIGH",
    projectLinks: [{ projectId: sourceProject.id, relationship: "PRIMARY" }]
  });

  const exportResponse = await app.inject({
    method: "GET",
    url: "/api/export"
  });

  assert.equal(exportResponse.statusCode, 200);
  const snapshot = exportResponse.json();

  app.db.delete(schema.ticketActivities).run();
  app.db.delete(schema.workContexts).run();
  app.db.delete(schema.ticketJiraIssueLinks).run();
  app.db.delete(schema.ticketProjectLinks).run();
  app.db.delete(schema.tickets).run();
  app.db.delete(schema.projectFolders).run();
  app.db.delete(schema.projects).run();
  app.db.delete(schema.sequences).run();

  const replacementProject = await createProject("Replacement", "replacement");
  assert.equal(replacementProject.id > 0, true);

  const importResponse = await app.inject({
    method: "POST",
    url: "/api/import",
    payload: {
      replaceExisting: true,
      snapshot
    }
  });

  assert.equal(importResponse.statusCode, 200);
  assert.equal(importResponse.json().counts.projects, 1);
  assert.equal(importResponse.json().counts.tickets, 1);

  const projectsResponse = await app.inject({
    method: "GET",
    url: "/api/projects"
  });
  const boardResponse = await app.inject({
    method: "GET",
    url: "/api/board"
  });

  assert.equal(projectsResponse.statusCode, 200);
  assert.equal(boardResponse.statusCode, 200);
  assert.equal(projectsResponse.json().length, 1);
  assert.equal(projectsResponse.json()[0].id, sourceProject.id);

  const restoredTickets = boardResponse
    .json()
    .columns.flatMap((column: { tickets: Array<{ id: number; title: string }> }) => column.tickets);

  assert.equal(restoredTickets.length, 1);
  assert.equal(restoredTickets[0].id, sourceTicket.id);
  assert.equal(restoredTickets[0].title, "Snapshot ticket");
});

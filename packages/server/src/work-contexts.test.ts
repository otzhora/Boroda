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
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-m5-tests-"));
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

async function createTicket() {
  const response = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Connect work contexts",
      description: "",
      status: "IN_PROGRESS",
      priority: "HIGH",
      projectLinks: []
    }
  });

  assert.equal(response.statusCode, 200);
  return response.json();
}

test("work context CRUD supports PR, session, note, and manual UI references", async () => {
  const ticket = await createTicket();

  const createPrResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/contexts`,
    payload: {
      type: "PR",
      label: "Backend PR",
      value: "https://example.test/pr/42"
    }
  });

  assert.equal(createPrResponse.statusCode, 200);
  const prContext = createPrResponse.json();
  assert.equal(prContext.type, "PR");

  const createSessionResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/contexts`,
    payload: {
      type: "CODEX_SESSION",
      label: "Codex pair session",
      value: "session-123"
    }
  });

  assert.equal(createSessionResponse.statusCode, 200);
  assert.equal(createSessionResponse.json().type, "CODEX_SESSION");

  const createNoteResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/contexts`,
    payload: {
      type: "NOTE",
      label: "",
      value: "Manual verification needed after deploy"
    }
  });

  assert.equal(createNoteResponse.statusCode, 200);
  assert.equal(createNoteResponse.json().type, "NOTE");
  assert.equal(createNoteResponse.json().label, "");

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/work-contexts/${prContext.id}`,
    payload: {
      type: "MANUAL_UI",
      label: "Checkout QA flow",
      value: "Windows browser: verify tax summary drawer"
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  const updatedContext = updateResponse.json();
  assert.equal(updatedContext.type, "MANUAL_UI");

  const deleteResponse = await app.inject({
    method: "DELETE",
    url: `/api/work-contexts/${createSessionResponse.json().id}`
  });

  assert.equal(deleteResponse.statusCode, 200);
  assert.deepEqual(deleteResponse.json(), { ok: true });

  const ticketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(ticketResponse.statusCode, 200);
  const updatedTicket = ticketResponse.json();
  assert.equal(updatedTicket.workContexts.length, 2);
  assert.equal(updatedTicket.workContexts[0].type, "NOTE");
  assert.equal(updatedTicket.workContexts[1].type, "MANUAL_UI");

  const activityTypes = updatedTicket.activities.map((activity: { type: string }) => activity.type);
  assert.ok(activityTypes.includes("work-context.created"));
  assert.ok(activityTypes.includes("work-context.updated"));
  assert.ok(activityTypes.includes("work-context.deleted"));
});

test("work contexts allow empty labels for non-note types", async () => {
  const ticket = await createTicket();

  const createResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/contexts`,
    payload: {
      type: "PR",
      label: "",
      value: "https://example.test/pr/42"
    }
  });

  assert.equal(createResponse.statusCode, 200);
  assert.equal(createResponse.json().label, "");

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/work-contexts/${createResponse.json().id}`,
    payload: {
      label: ""
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().label, "");
});

test("creating a work context for a missing ticket returns ticket not found", async () => {
  const response = await app.inject({
    method: "POST",
    url: "/api/tickets/99999/contexts",
    payload: {
      type: "PR",
      label: "Missing ticket PR",
      value: "https://example.test/pr/404"
    }
  });

  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "TICKET_NOT_FOUND");
});

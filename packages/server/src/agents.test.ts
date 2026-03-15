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
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-agents-tests-"));
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
  app.db.delete(schema.ticketWorkspaces).run();
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

function parseMetaJson(metaJson: string) {
  return JSON.parse(metaJson) as Record<string, unknown>;
}

test("agent routes list projects and tickets through the stable surface", async () => {
  const project = await createProject("Boroda", "boroda");

  const createTicketResponse = await app.inject({
    method: "POST",
    url: "/api/agents/tickets",
    payload: {
      title: "Add agent route surface",
      description: "Expose explicit HTTP routes for agents.",
      status: "INBOX",
      priority: "HIGH",
      projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }]
    }
  });

  assert.equal(createTicketResponse.statusCode, 200);
  const createdTicket = createTicketResponse.json();

  const projectListResponse = await app.inject({
    method: "GET",
    url: "/api/agents/projects"
  });

  assert.equal(projectListResponse.statusCode, 200);
  assert.equal(projectListResponse.json().length, 1);
  assert.equal(projectListResponse.json()[0].id, project.id);

  const ticketListResponse = await app.inject({
    method: "GET",
    url: `/api/agents/tickets?q=agent&projectId=${project.id}`
  });

  assert.equal(ticketListResponse.statusCode, 200);
  assert.equal(ticketListResponse.json().items.length, 1);
  assert.equal(ticketListResponse.json().items[0].id, createdTicket.id);

  const ticketDetailResponse = await app.inject({
    method: "GET",
    url: `/api/agents/tickets/${createdTicket.id}`
  });

  assert.equal(ticketDetailResponse.statusCode, 200);
  assert.equal(ticketDetailResponse.json().id, createdTicket.id);
});

test("agent write routes delegate to shared services and record provenance", async () => {
  const project = await createProject("Boroda", "boroda");

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/agents/tickets",
    payload: {
      title: "Implement agent append activity",
      description: "Need a stable HTTP contract for agent progress writes.",
      status: "INBOX",
      priority: "MEDIUM",
      projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }],
      workContexts: [
        {
          type: "NOTE",
          label: "Source",
          value: "Discovered while implementing Step 3."
        }
      ],
      actor: {
        agentKind: "codex",
        sessionRef: "codex://session/step-3"
      }
    }
  });

  assert.equal(createResponse.statusCode, 200);
  const createdTicket = createResponse.json();
  const createdActivity = createdTicket.activities.find(
    (activity: { type: string }) => activity.type === "ticket.created"
  );

  assert.ok(createdActivity);
  assert.deepEqual(parseMetaJson(createdActivity.metaJson), {
    actorType: "agent",
    agentKind: "codex",
    sessionRef: "codex://session/step-3",
    transport: "http"
  });
  assert.equal(createdTicket.workContexts.length, 1);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/agents/tickets/${createdTicket.id}`,
    payload: {
      patch: {
        status: "IN_PROGRESS",
        priority: "HIGH",
        description: "Now wiring append activity through the agent route."
      },
      actor: {
        agentKind: "codex",
        sessionRef: "codex://session/step-3"
      }
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  assert.equal(updateResponse.json().status, "IN_PROGRESS");
  assert.equal(updateResponse.json().priority, "HIGH");

  const contextResponse = await app.inject({
    method: "POST",
    url: `/api/agents/tickets/${createdTicket.id}/contexts`,
    payload: {
      type: "CODEX_SESSION",
      label: "Session",
      value: "codex://session/step-3",
      actor: {
        agentKind: "codex"
      }
    }
  });

  assert.equal(contextResponse.statusCode, 200);
  assert.equal(contextResponse.json().type, "CODEX_SESSION");

  const activityResponse = await app.inject({
    method: "POST",
    url: `/api/agents/tickets/${createdTicket.id}/activity`,
    payload: {
      type: "agent.note",
      message: "Agent-facing route tests are in place.",
      meta: {
        phase: "verification"
      },
      actor: {
        agentKind: "codex"
      }
    }
  });

  assert.equal(activityResponse.statusCode, 200);
  const appendedActivity = activityResponse
    .json()
    .activities.find((activity: { type: string; message: string }) => (
      activity.type === "agent.note" && activity.message === "Agent-facing route tests are in place."
    ));

  assert.ok(appendedActivity);
  assert.deepEqual(parseMetaJson(appendedActivity.metaJson), {
    phase: "verification",
    actorType: "agent",
    agentKind: "codex",
    transport: "http"
  });
});

test("agent ticket update rejects web-only fields", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/agents/tickets",
    payload: {
      title: "Narrow route contract"
    }
  });

  assert.equal(createResponse.statusCode, 200);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/agents/tickets/${createResponse.json().id}`,
    payload: {
      patch: {
        status: "DONE",
        projectLinks: [{ projectId: 1, relationship: "PRIMARY" }]
      }
    }
  });

  assert.equal(updateResponse.statusCode, 400);
  assert.equal(updateResponse.json().error.code, "VALIDATION_ERROR");
});

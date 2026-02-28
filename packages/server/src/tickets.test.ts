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
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-m3-tests-"));
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

test("ticket CRUD supports multi-project links, filters, and activity writes", async () => {
  const primaryProject = await createProject("Payments Backend", "payments-backend");
  const relatedProject = await createProject("Payments Terraform", "payments-terraform");

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Finish backend refactor",
      description: "Need app repo changes and infra follow-up",
      status: "IN_PROGRESS",
      priority: "HIGH",
      type: "TASK",
      projectLinks: [
        { projectId: primaryProject.id, relationship: "PRIMARY" },
        { projectId: relatedProject.id, relationship: "RELATED" }
      ]
    }
  });

  assert.equal(createResponse.statusCode, 200);
  const createdTicket = createResponse.json();
  assert.equal(createdTicket.key, "BRD-1");
  assert.equal(createdTicket.projectLinks.length, 2);
  assert.equal(createdTicket.activities[0].type, "ticket.created");

  const filteredListResponse = await app.inject({
    method: "GET",
    url: `/api/tickets?projectId=${relatedProject.id}`
  });

  assert.equal(filteredListResponse.statusCode, 200);
  const filteredTickets = filteredListResponse.json();
  assert.equal(filteredTickets.length, 1);
  assert.equal(filteredTickets[0].id, createdTicket.id);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/tickets/${createdTicket.id}`,
    payload: {
      status: "DONE",
      priority: "CRITICAL",
      projectLinks: [{ projectId: relatedProject.id, relationship: "PRIMARY" }]
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  const updatedTicket = updateResponse.json();
  assert.equal(updatedTicket.status, "DONE");
  assert.equal(updatedTicket.priority, "CRITICAL");
  assert.deepEqual(
    updatedTicket.projectLinks.map((link: { projectId: number; relationship: string }) => ({
      projectId: link.projectId,
      relationship: link.relationship
    })),
    [{ projectId: relatedProject.id, relationship: "PRIMARY" }]
  );

  const activityTypes = updatedTicket.activities.map((activity: { type: string }) => activity.type);
  assert.ok(activityTypes.includes("ticket.status.changed"));
  assert.ok(activityTypes.includes("ticket.priority.changed"));
  assert.ok(activityTypes.includes("ticket.project_linked"));
  assert.ok(activityTypes.includes("ticket.project_unlinked"));
});

test("ticket-project link endpoints enforce duplicate and primary constraints", async () => {
  const appProject = await createProject("App", "app");
  const infraProject = await createProject("Infra", "infra");
  const docsProject = await createProject("Docs", "docs");

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Set up local automation",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      type: "CHORE",
      projectLinks: []
    }
  });

  assert.equal(ticketResponse.statusCode, 200);
  const ticket = ticketResponse.json();

  const createPrimaryLinkResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/projects`,
    payload: {
      projectId: appProject.id,
      relationship: "PRIMARY"
    }
  });

  assert.equal(createPrimaryLinkResponse.statusCode, 200);

  const duplicateLinkResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/projects`,
    payload: {
      projectId: appProject.id,
      relationship: "PRIMARY"
    }
  });

  assert.equal(duplicateLinkResponse.statusCode, 400);
  assert.equal(duplicateLinkResponse.json().error.code, "TICKET_PROJECT_DUPLICATE");

  const secondPrimaryResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/projects`,
    payload: {
      projectId: infraProject.id,
      relationship: "PRIMARY"
    }
  });

  assert.equal(secondPrimaryResponse.statusCode, 400);
  assert.equal(secondPrimaryResponse.json().error.code, "TICKET_PRIMARY_PROJECT_CONFLICT");

  const relatedLinkResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/projects`,
    payload: {
      projectId: docsProject.id,
      relationship: "RELATED"
    }
  });

  assert.equal(relatedLinkResponse.statusCode, 200);
  const createdLink = relatedLinkResponse.json();

  const deleteLinkResponse = await app.inject({
    method: "DELETE",
    url: `/api/ticket-project-links/${createdLink.id}`
  });

  assert.equal(deleteLinkResponse.statusCode, 200);
  assert.deepEqual(deleteLinkResponse.json(), { ok: true });

  const getTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(getTicketResponse.statusCode, 200);
  const ticketWithLinks = getTicketResponse.json();
  assert.equal(ticketWithLinks.projectLinks.length, 1);
  assert.equal(ticketWithLinks.projectLinks[0].projectId, appProject.id);

  const missingProjectResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/projects`,
    payload: {
      projectId: 99999,
      relationship: "RELATED"
    }
  });

  assert.equal(missingProjectResponse.statusCode, 404);
  assert.equal(missingProjectResponse.json().error.code, "PROJECT_NOT_FOUND");
});

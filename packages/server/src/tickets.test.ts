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
  process.env.BORODA_UPLOADS_PATH = path.join(tempRoot, "uploads");

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
  app.db.delete(schema.jiraSettings).run();
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

test("ticket CRUD supports multi-project links, filters, and activity writes", async () => {
  const primaryProject = await createProject("Payments Backend", "payments-backend");
  const relatedProject = await createProject("Payments Terraform", "payments-terraform");

  const createResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Finish backend refactor",
      description: "Need app repo changes and infra follow-up",
      branch: "feature/backend-refactor",
      jiraIssues: [{ key: "PAY-128", summary: "Backend refactor" }],
      status: "IN_PROGRESS",
      priority: "HIGH",
      projectLinks: [
        { projectId: primaryProject.id, relationship: "PRIMARY" },
        { projectId: relatedProject.id, relationship: "RELATED" }
      ]
    }
  });

  assert.equal(createResponse.statusCode, 200);
  const createdTicket = createResponse.json();
  assert.equal(createdTicket.key, "BRD-1");
  assert.equal(createdTicket.branch, "feature/backend-refactor");
  assert.equal(createdTicket.jiraIssues.length, 1);
  assert.equal(createdTicket.jiraIssues[0].key, "PAY-128");
  assert.equal(createdTicket.jiraIssues[0].summary, "Backend refactor");
  assert.equal(createdTicket.projectLinks.length, 2);
  assert.ok(createdTicket.activities.some((activity: { type: string }) => activity.type === "ticket.created"));

  const filteredListResponse = await app.inject({
    method: "GET",
    url: `/api/tickets?projectId=${relatedProject.id}`
  });

  assert.equal(filteredListResponse.statusCode, 200);
  const filteredTickets = filteredListResponse.json();
  assert.equal(filteredTickets.length, 1);
  assert.equal(filteredTickets[0].id, createdTicket.id);

  const jiraFilteredListResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?jiraIssue=PAY-128"
  });

  assert.equal(jiraFilteredListResponse.statusCode, 200);
  assert.equal(jiraFilteredListResponse.json().length, 1);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: `/api/tickets/${createdTicket.id}`,
    payload: {
      branch: "release/backend-refactor",
      jiraIssues: [],
      status: "DONE",
      priority: "CRITICAL",
      projectLinks: [{ projectId: relatedProject.id, relationship: "PRIMARY" }]
    }
  });

  assert.equal(updateResponse.statusCode, 200);
  const updatedTicket = updateResponse.json();
  assert.equal(updatedTicket.branch, "release/backend-refactor");
  assert.deepEqual(updatedTicket.jiraIssues, []);
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
  assert.ok(activityTypes.includes("ticket.jira_issue_linked"));
  assert.ok(activityTypes.includes("ticket.jira_issue_unlinked"));

  const archiveResponse = await app.inject({
    method: "DELETE",
    url: `/api/tickets/${createdTicket.id}`
  });

  assert.equal(archiveResponse.statusCode, 200);

  const activeListResponse = await app.inject({
    method: "GET",
    url: "/api/tickets"
  });

  assert.equal(activeListResponse.statusCode, 200);
  assert.equal(activeListResponse.json().length, 0);

  const archivedListResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?scope=archived&q=BRD-1"
  });

  assert.equal(archivedListResponse.statusCode, 200);
  const archivedTickets = archivedListResponse.json();
  assert.equal(archivedTickets.length, 1);
  assert.equal(archivedTickets[0].id, createdTicket.id);

  const allListResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?scope=all"
  });

  assert.equal(allListResponse.statusCode, 200);
  assert.equal(allListResponse.json().length, 1);

  const archivedTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${createdTicket.id}`
  });

  assert.equal(archivedTicketResponse.statusCode, 200);
  const archivedTicket = archivedTicketResponse.json();
  assert.equal(typeof archivedTicket.archivedAt, "string");
  assert.ok(archivedTicket.activities.some((activity: { type: string }) => activity.type === "ticket.archived"));

  const boardResponse = await app.inject({
    method: "GET",
    url: "/api/board"
  });

  assert.equal(boardResponse.statusCode, 200);
  const board = boardResponse.json();
  const visibleTickets = board.columns.flatMap((column: { tickets: Array<{ id: number }> }) => column.tickets);
  assert.equal(visibleTickets.length, 0);
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

test("refreshing linked Jira issues updates cached summaries", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          issues: [
            {
              key: "PAY-128",
              fields: {
                summary: "Backend refactor renamed"
              }
            }
          ],
          total: 1
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );

    app.db.insert(schema.jiraSettings).values({
      baseUrl: "https://jira.example.test",
      email: "me@example.test",
      apiToken: "secret-token"
    }).run();

    const createResponse = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        title: "Refresh linked Jira issue",
        description: "",
        jiraIssues: [{ key: "PAY-128", summary: "Old summary" }],
        status: "READY",
        priority: "MEDIUM",
        projectLinks: []
      }
    });

    assert.equal(createResponse.statusCode, 200);
    const createdTicket = createResponse.json();

    const refreshResponse = await app.inject({
      method: "POST",
      url: `/api/tickets/${createdTicket.id}/jira/refresh`
    });

    assert.equal(refreshResponse.statusCode, 200);
    const refreshedTicket = refreshResponse.json();
    assert.equal(refreshedTicket.jiraIssues[0].summary, "Backend refactor renamed");
    assert.ok(
      refreshedTicket.activities.some(
        (activity: { type: string }) => activity.type === "ticket.jira_issue_refreshed"
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("assigned Jira issues include linked Boroda tickets", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          issues: [
            {
              key: "PAY-128",
              fields: {
                summary: "Backend refactor"
              }
            },
            {
              key: "OPS-42",
              fields: {
                summary: "Ops cleanup"
              }
            }
          ],
          total: 2
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      );

    app.db.insert(schema.jiraSettings).values({
      baseUrl: "https://jira.example.test",
      email: "me@example.test",
      apiToken: "secret-token"
    }).run();

    const firstTicketResponse = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        title: "Refactor backend service",
        description: "",
        jiraIssues: [{ key: "PAY-128", summary: "Backend refactor" }],
        status: "READY",
        priority: "HIGH",
        projectLinks: []
      }
    });

    const secondTicketResponse = await app.inject({
      method: "POST",
      url: "/api/tickets",
      payload: {
        title: "Follow-up checklist",
        description: "",
        jiraIssues: [{ key: "PAY-128", summary: "Backend refactor" }],
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        projectLinks: []
      }
    });

    assert.equal(firstTicketResponse.statusCode, 200);
    assert.equal(secondTicketResponse.statusCode, 200);

    const linkedIssuesResponse = await app.inject({
      method: "GET",
      url: "/api/integrations/jira/issues/assigned/links"
    });

    assert.equal(linkedIssuesResponse.statusCode, 200);
    const payload = linkedIssuesResponse.json();
    assert.equal(payload.total, 2);
    assert.equal(payload.linked, 1);
    assert.equal(payload.unlinked, 1);

    const payIssue = payload.issues.find((issue: { key: string }) => issue.key === "PAY-128");
    const opsIssue = payload.issues.find((issue: { key: string }) => issue.key === "OPS-42");

    assert.ok(payIssue);
    assert.ok(opsIssue);
    assert.equal(payIssue.borodaTickets.length, 2);
    assert.deepEqual(
      payIssue.borodaTickets.map((ticket: { title: string; status: string }) => ({
        title: ticket.title,
        status: ticket.status
      })),
      [
        { title: "Follow-up checklist", status: "IN_PROGRESS" },
        { title: "Refactor backend service", status: "READY" }
      ]
    );
    assert.deepEqual(opsIssue.borodaTickets, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ticket jira-link endpoint appends a Jira issue to an existing Boroda ticket", async () => {
  const createResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Link an existing ticket",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      projectLinks: []
    }
  });

  assert.equal(createResponse.statusCode, 200);
  const ticket = createResponse.json();

  const linkResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/jira-links`,
    payload: {
      key: "OPS-42",
      summary: "Ops cleanup"
    }
  });

  assert.equal(linkResponse.statusCode, 200);
  assert.equal(linkResponse.json().key, "OPS-42");

  const getTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(getTicketResponse.statusCode, 200);
  const linkedTicket = getTicketResponse.json();
  assert.deepEqual(
    linkedTicket.jiraIssues.map((issue: { key: string; summary: string }) => ({
      key: issue.key,
      summary: issue.summary
    })),
    [{ key: "OPS-42", summary: "Ops cleanup" }]
  );
  assert.ok(
    linkedTicket.activities.some(
      (activity: { type: string; message: string }) =>
        activity.type === "ticket.jira_issue_linked" && activity.message.includes("OPS-42")
    )
  );
});

test("ticket image uploads can be pasted and rendered back from local storage", async () => {
  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Support pasted screenshots",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      projectLinks: []
    }
  });

  assert.equal(ticketResponse.statusCode, 200);
  const ticket = ticketResponse.json();

  const formData = new FormData();
  formData.set("image", new Blob(["fake-image"], { type: "image/png" }), "clipboard.png");

  const uploadResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/images`,
    payload: formData
  });

  assert.equal(uploadResponse.statusCode, 200);
  const uploadedImage = uploadResponse.json();
  assert.match(uploadedImage.url, new RegExp(`^/api/tickets/${ticket.id}/images/.+\\.png$`));
  assert.equal(uploadedImage.markdown, `![clipboard](${uploadedImage.url})`);

  const imageResponse = await app.inject({
    method: "GET",
    url: uploadedImage.url
  });

  assert.equal(imageResponse.statusCode, 200);
  assert.equal(imageResponse.headers["content-type"], "image/png");
  assert.equal(imageResponse.body, "fake-image");
});

test("ticket image cleanup removes orphaned files on description update and keeps remaining files after moving ticket to history", async () => {
  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Clean up pasted screenshots",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      projectLinks: []
    }
  });

  assert.equal(ticketResponse.statusCode, 200);
  const ticket = ticketResponse.json();

  const firstFormData = new FormData();
  firstFormData.set("image", new Blob(["first-image"], { type: "image/png" }), "first.png");

  const firstUploadResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/images`,
    payload: firstFormData
  });

  assert.equal(firstUploadResponse.statusCode, 200);
  const firstImage = firstUploadResponse.json();

  const secondFormData = new FormData();
  secondFormData.set("image", new Blob(["second-image"], { type: "image/png" }), "second.png");

  const secondUploadResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/images`,
    payload: secondFormData
  });

  assert.equal(secondUploadResponse.statusCode, 200);
  const secondImage = secondUploadResponse.json();

  const keepOnlySecondResponse = await app.inject({
    method: "PATCH",
    url: `/api/tickets/${ticket.id}`,
    payload: {
      description: `${secondImage.markdown}\n`
    }
  });

  assert.equal(keepOnlySecondResponse.statusCode, 200);

  const deletedFirstImageResponse = await app.inject({
    method: "GET",
    url: firstImage.url
  });

  assert.equal(deletedFirstImageResponse.statusCode, 404);

  const retainedSecondImageResponse = await app.inject({
    method: "GET",
    url: secondImage.url
  });

  assert.equal(retainedSecondImageResponse.statusCode, 200);

  const archiveTicketResponse = await app.inject({
    method: "DELETE",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(archiveTicketResponse.statusCode, 200);

  const retainedSecondImageAfterArchiveResponse = await app.inject({
    method: "GET",
    url: secondImage.url
  });

  assert.equal(retainedSecondImageAfterArchiveResponse.statusCode, 200);

  const archivedTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(archivedTicketResponse.statusCode, 200);
  assert.equal(typeof archivedTicketResponse.json().archivedAt, "string");
});

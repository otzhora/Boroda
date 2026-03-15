import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
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
  process.env.BORODA_TERMINAL_BIN = "/bin/true";

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

function git(cwd: string, ...args: string[]) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || `git ${args.join(" ")} failed`);
  }
}

async function createGitRepo(rootPath: string) {
  await mkdir(rootPath, { recursive: true });
  git(rootPath, "init", "--initial-branch=main");
  git(rootPath, "config", "user.email", "boroda@example.test");
  git(rootPath, "config", "user.name", "Boroda Tests");
  await writeFile(path.join(rootPath, "README.md"), "main\n");
  git(rootPath, "add", "README.md");
  git(rootPath, "commit", "-m", "init");
}

async function createTicketWorkspaceFixture() {
  const repoPath = path.join(tempRoot, `repo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const managedWorktreesPath = path.join(tempRoot, `managed-worktrees-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  process.env.BORODA_WORKTREES_PATH = managedWorktreesPath;

  await createGitRepo(repoPath);

  const project = await createProject("Workspace Project", `workspace-project-${Math.random().toString(36).slice(2, 8)}`);
  const folderResponse = await app.inject({
    method: "POST",
    url: `/api/projects/${project.id}/folders`,
    payload: {
      label: "repo",
      path: repoPath,
      kind: "APP",
      isPrimary: true
    }
  });

  assert.equal(folderResponse.statusCode, 200);
  const folder = folderResponse.json();

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Archive workspace fixture",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }],
      workspaces: [
        {
          projectFolderId: folder.id,
          branchName: "feature/archive-fixture",
          baseBranch: "main",
          role: "primary"
        }
      ]
    }
  });

  assert.equal(ticketResponse.statusCode, 200);
  const ticket = ticketResponse.json();
  const workspace = ticket.workspaces[0];

  const openResponse = await app.inject({
    method: "POST",
    url: `/api/integrations/open-in/tickets/${ticket.id}/open`,
    payload: {
      target: "terminal",
      mode: "worktree",
      folderId: folder.id,
      workspaceId: workspace.id,
      runSetup: false
    }
  });

  assert.equal(openResponse.statusCode, 200);

  return {
    ticket,
    workspace: {
      ...workspace,
      worktreePath: openResponse.json().directory as string
    }
  };
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
  assert.equal(filteredTickets.items.length, 1);
  assert.equal(filteredTickets.items[0].id, createdTicket.id);
  assert.deepEqual(filteredTickets.meta.jiraIssues, ["PAY-128"]);

  const jiraFilteredListResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?jiraIssue=PAY-128"
  });

  assert.equal(jiraFilteredListResponse.statusCode, 200);
  const jiraFilteredTickets = jiraFilteredListResponse.json();
  assert.equal(jiraFilteredTickets.items.length, 1);
  assert.deepEqual(jiraFilteredTickets.meta.jiraIssues, ["PAY-128"]);

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
  assert.equal(activeListResponse.json().items.length, 0);

  const archivedListResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?scope=archived&q=BRD-1"
  });

  assert.equal(archivedListResponse.statusCode, 200);
  const archivedTickets = archivedListResponse.json();
  assert.equal(archivedTickets.items.length, 1);
  assert.equal(archivedTickets.items[0].id, createdTicket.id);

  const allListResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?scope=all"
  });

  assert.equal(allListResponse.statusCode, 200);
  assert.equal(allListResponse.json().items.length, 1);

  const archivedTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${createdTicket.id}`
  });

  assert.equal(archivedTicketResponse.statusCode, 200);
  const archivedTicket = archivedTicketResponse.json();
  assert.equal(typeof archivedTicket.archivedAt, "string");
  assert.ok(archivedTicket.activities.some((activity: { type: string }) => activity.type === "ticket.archived"));

  const unarchiveResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${createdTicket.id}/unarchive`
  });

  assert.equal(unarchiveResponse.statusCode, 200);

  const restoredTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${createdTicket.id}`
  });

  assert.equal(restoredTicketResponse.statusCode, 200);
  const restoredTicket = restoredTicketResponse.json();
  assert.equal(restoredTicket.archivedAt, null);
  assert.ok(restoredTicket.activities.some((activity: { type: string }) => activity.type === "ticket.unarchived"));

  const boardResponse = await app.inject({
    method: "GET",
    url: "/api/board"
  });

  assert.equal(boardResponse.statusCode, 200);
  const board = boardResponse.json();
  const visibleTickets = board.columns.flatMap((column: { tickets: Array<{ id: number }> }) => column.tickets);
  assert.equal(visibleTickets.length, 1);
  assert.equal(visibleTickets[0].id, createdTicket.id);
});

test("ticket list returns Jira facets for the current slice and sorts on the server", async () => {
  const project = await createProject("Payments Backend", "payments-backend");

  await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Low priority cleanup",
      description: "",
      jiraIssues: [{ key: "OPS-42", summary: "Cleanup" }],
      status: "READY",
      priority: "LOW",
      projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }]
    }
  });

  await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Critical incident",
      description: "",
      jiraIssues: [{ key: "PAY-128", summary: "Incident" }],
      status: "READY",
      priority: "CRITICAL",
      projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }]
    }
  });

  const sortedResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?sort=priority&dir=asc"
  });

  assert.equal(sortedResponse.statusCode, 200);
  const sortedPayload = sortedResponse.json();
  assert.deepEqual(
    sortedPayload.items.map((ticket: { priority: string }) => ticket.priority),
    ["LOW", "CRITICAL"]
  );
  assert.deepEqual(sortedPayload.meta.jiraIssues, ["OPS-42", "PAY-128"]);

  const jiraFilteredResponse = await app.inject({
    method: "GET",
    url: "/api/tickets?jiraIssue=PAY-128"
  });

  assert.equal(jiraFilteredResponse.statusCode, 200);
  const jiraFilteredPayload = jiraFilteredResponse.json();
  assert.equal(jiraFilteredPayload.items.length, 1);
  assert.equal(jiraFilteredPayload.items[0].jiraIssues[0].key, "PAY-128");
  assert.deepEqual(jiraFilteredPayload.meta.jiraIssues, ["OPS-42", "PAY-128"]);
});

test("ticket creation rolls back sequence and rows when related writes fail", async () => {
  const project = await createProject("Atomicity Project", "atomicity-project");

  const failedCreateResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Will fail",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }],
      workspaces: [
        {
          projectFolderId: 999999,
          branchName: "feature/missing-folder",
          role: "primary"
        }
      ]
    }
  });

  assert.equal(failedCreateResponse.statusCode, 404);
  assert.equal(app.db.select().from(schema.tickets).all().length, 0);
  assert.equal(app.db.select().from(schema.ticketProjectLinks).all().length, 0);
  assert.equal(app.db.select().from(schema.sequences).all().length, 0);

  const successfulCreateResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "After rollback",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }]
    }
  });

  assert.equal(successfulCreateResponse.statusCode, 200);
  assert.equal(successfulCreateResponse.json().key, "BRD-1");
});

test("unarchiving a ticket also restores linked archived projects", async () => {
  const linkedProject = await createProject("Restore Parent Project", "restore-parent-project");

  const ticketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Restore linked project with ticket",
      description: "",
      status: "READY",
      priority: "MEDIUM",
      projectLinks: [{ projectId: linkedProject.id, relationship: "PRIMARY" }]
    }
  });

  assert.equal(ticketResponse.statusCode, 200);
  const ticket = ticketResponse.json();

  const archiveProjectResponse = await app.inject({
    method: "DELETE",
    url: `/api/projects/${linkedProject.id}`
  });

  assert.equal(archiveProjectResponse.statusCode, 200);

  const archivedProjectResponse = await app.inject({
    method: "GET",
    url: `/api/projects/${linkedProject.id}`
  });

  assert.equal(archivedProjectResponse.statusCode, 200);
  assert.equal(typeof archivedProjectResponse.json().archivedAt, "string");

  const archivedTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(archivedTicketResponse.statusCode, 200);
  assert.equal(typeof archivedTicketResponse.json().archivedAt, "string");

  const unarchiveTicketResponse = await app.inject({
    method: "POST",
    url: `/api/tickets/${ticket.id}/unarchive`
  });

  assert.equal(unarchiveTicketResponse.statusCode, 200);

  const restoredProjectResponse = await app.inject({
    method: "GET",
    url: `/api/projects/${linkedProject.id}`
  });

  assert.equal(restoredProjectResponse.statusCode, 200);
  assert.equal(restoredProjectResponse.json().archivedAt, null);

  const restoredTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(restoredTicketResponse.statusCode, 200);
  assert.equal(restoredTicketResponse.json().archivedAt, null);
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

test("archiving deletes clean managed worktrees", async () => {
  const { ticket, workspace } = await createTicketWorkspaceFixture();

  const archiveResponse = await app.inject({
    method: "DELETE",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(archiveResponse.statusCode, 200);

  const archivedTicketResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(archivedTicketResponse.statusCode, 200);
  assert.equal(typeof archivedTicketResponse.json().archivedAt, "string");
  await assert.rejects(() => rm(workspace.worktreePath, { recursive: true }), /ENOENT/);
});

test("archiving blocks on dirty managed worktrees unless forced", async () => {
  const { ticket, workspace } = await createTicketWorkspaceFixture();
  await writeFile(path.join(workspace.worktreePath, "dirty.txt"), "pending changes\n");

  const blockedArchiveResponse = await app.inject({
    method: "DELETE",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(blockedArchiveResponse.statusCode, 409);
  assert.equal(blockedArchiveResponse.json().error.code, "TICKET_ARCHIVE_DIRTY_WORKTREES");
  assert.deepEqual(blockedArchiveResponse.json().error.details.dirtyWorktrees, [
    {
      workspaceId: workspace.id,
      branchName: workspace.branchName,
      worktreePath: workspace.worktreePath
    }
  ]);

  const archivedTicketBeforeForceResponse = await app.inject({
    method: "GET",
    url: `/api/tickets/${ticket.id}`
  });

  assert.equal(archivedTicketBeforeForceResponse.statusCode, 200);
  assert.equal(archivedTicketBeforeForceResponse.json().archivedAt, null);

  const forcedArchiveResponse = await app.inject({
    method: "DELETE",
    url: `/api/tickets/${ticket.id}?force=true`
  });

  assert.equal(forcedArchiveResponse.statusCode, 200);
  await assert.rejects(() => rm(workspace.worktreePath, { recursive: true }), /ENOENT/);
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

test("jira linkable ticket search uses the Jira-scoped endpoint and excludes already linked matches", async () => {
  const linkedTicketResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Ops cleanup linked ticket",
      description: "Cleanup checklist",
      jiraIssues: [{ key: "OPS-42", summary: "Ops cleanup" }],
      status: "READY",
      priority: "MEDIUM",
      projectLinks: []
    }
  });

  const firstCandidateResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Ops cleanup candidate",
      description: "Cleanup follow-up",
      status: "READY",
      priority: "LOW",
      projectLinks: []
    }
  });

  const secondCandidateResponse = await app.inject({
    method: "POST",
    url: "/api/tickets",
    payload: {
      title: "Ops cleanup candidate newer",
      description: "Cleanup verification",
      status: "IN_PROGRESS",
      priority: "HIGH",
      projectLinks: []
    }
  });

  assert.equal(linkedTicketResponse.statusCode, 200);
  assert.equal(firstCandidateResponse.statusCode, 200);
  assert.equal(secondCandidateResponse.statusCode, 200);

  const response = await app.inject({
    method: "GET",
    url: "/api/integrations/jira/issues/OPS-42/linkable-tickets?q=cleanup"
  });

  assert.equal(response.statusCode, 200);
  const payload = response.json();
  assert.deepEqual(
    payload.items.map((ticket: { title: string }) => ticket.title),
    ["Ops cleanup candidate newer", "Ops cleanup candidate"]
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

  await mkdir(path.join(process.env.BORODA_UPLOADS_PATH as string, "tickets", String(ticket.id), "stale-dir"), {
    recursive: true
  });

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

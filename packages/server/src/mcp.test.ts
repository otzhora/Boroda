import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, beforeEach, test } from "node:test";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { FastifyInstance } from "fastify";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

let app: FastifyInstance;
let sqlite: { close: () => void };
let schema: typeof import("./db/schema");
let tempRoot = "";

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-mcp-tests-"));
  process.env.BORODA_DB_PATH = path.join(tempRoot, "test.sqlite");
  process.env.BORODA_REQUEST_LOGGING = "false";

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

test("mcp handler exposes the first-pass Boroda tools and reuses shared agent logic", async () => {
  const { handleMcpRequest } = await import("./modules/integrations/mcp/server");
  const project = await createProject("Boroda", "boroda");

  const initializeResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "init",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "boroda-test",
        version: "0.1.0"
      }
    }
  });

  assert.equal(initializeResponse?.result?.protocolVersion, "2024-11-05");

  const listToolsResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "tools",
    method: "tools/list"
  });

  const toolNames = (listToolsResponse?.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
  assert.deepEqual(toolNames, [
    "boroda.list_projects",
    "boroda.list_tickets",
    "boroda.get_ticket",
    "boroda.create_ticket",
    "boroda.update_ticket",
    "boroda.attach_work_context",
    "boroda.append_activity"
  ]);

  const createTicketResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "create",
    method: "tools/call",
    params: {
      name: "boroda.create_ticket",
      arguments: {
        title: "Add MCP adapter",
        description: "Expose Boroda agent workflows through MCP.",
        projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }],
        workContexts: [
          {
            type: "NOTE",
            label: "Source",
            value: "Created during MCP test."
          }
        ],
        actor: {
          agentKind: "codex",
          sessionRef: "codex://session/mcp-test"
        }
      }
    }
  });

  const createdTicket = createTicketResponse?.result?.structuredContent as {
    id: number;
    workContexts: Array<{ type: string }>;
    activities: Array<{ type: string; metaJson: string }>;
  };

  assert.equal(createdTicket.workContexts.length, 1);
  assert.equal(createdTicket.workContexts[0].type, "NOTE");
  const createdActivity = createdTicket.activities.find((activity) => activity.type === "ticket.created");
  assert.ok(createdActivity);
  assert.deepEqual(JSON.parse(createdActivity.metaJson), {
    actorType: "agent",
    agentKind: "codex",
    sessionRef: "codex://session/mcp-test",
    transport: "mcp"
  });

  const updateResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "update",
    method: "tools/call",
    params: {
      name: "boroda.update_ticket",
      arguments: {
        ticketId: createdTicket.id,
        patch: {
          status: "IN_PROGRESS",
          priority: "HIGH"
        },
        actor: {
          agentKind: "codex"
        }
      }
    }
  });

  assert.equal((updateResponse?.result?.structuredContent as { status: string }).status, "IN_PROGRESS");
  assert.equal((updateResponse?.result?.structuredContent as { priority: string }).priority, "HIGH");

  const attachContextResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "context",
    method: "tools/call",
    params: {
      name: "boroda.attach_work_context",
      arguments: {
        ticketId: createdTicket.id,
        type: "CODEX_SESSION",
        label: "Session",
        value: "codex://session/mcp-test"
      }
    }
  });

  assert.equal((attachContextResponse?.result?.structuredContent as { type: string }).type, "CODEX_SESSION");

  const appendActivityResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "activity",
    method: "tools/call",
    params: {
      name: "boroda.append_activity",
      arguments: {
        ticketId: createdTicket.id,
        type: "agent.note",
        message: "MCP test activity appended."
      }
    }
  });

  const appendedTicket = appendActivityResponse?.result?.structuredContent as {
    activities: Array<{ type: string; message: string }>;
  };

  assert.ok(
    appendedTicket.activities.some(
      (activity) => activity.type === "agent.note" && activity.message === "MCP test activity appended."
    )
  );

  const listTicketsResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "list-tickets",
    method: "tools/call",
    params: {
      name: "boroda.list_tickets",
      arguments: {
        q: "MCP adapter"
      }
    }
  });

  assert.equal(
    (listTicketsResponse?.result?.structuredContent as { items: Array<{ id: number }> }).items[0]?.id,
    createdTicket.id
  );

  const getTicketResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "get-ticket",
    method: "tools/call",
    params: {
      name: "boroda.get_ticket",
      arguments: {
        ticketId: createdTicket.id
      }
    }
  });

  assert.equal((getTicketResponse?.result?.structuredContent as { id: number }).id, createdTicket.id);

  const listProjectsResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "list-projects",
    method: "tools/call",
    params: {
      name: "boroda.list_projects",
      arguments: {
        scope: "active"
      }
    }
  });

  assert.equal(
    (listProjectsResponse?.result?.structuredContent as { items: Array<{ slug: string }> }).items[0]?.slug,
    "boroda"
  );
});

test("mcp handler returns structured validation errors for invalid tool input", async () => {
  const { handleMcpRequest } = await import("./modules/integrations/mcp/server");
  const project = await createProject("Boroda", "boroda");

  const createTicketResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "create",
    method: "tools/call",
    params: {
      name: "boroda.create_ticket",
      arguments: {
        title: "Validate MCP errors",
        projectLinks: [{ projectId: project.id, relationship: "PRIMARY" }]
      }
    }
  });

  const createdTicketId = (createTicketResponse?.result?.structuredContent as { id: number }).id;

  const invalidUpdateResponse = await handleMcpRequest(app, {
    jsonrpc: "2.0",
    id: "invalid-update",
    method: "tools/call",
    params: {
      name: "boroda.update_ticket",
      arguments: {
        ticketId: createdTicketId,
        patch: {}
      }
    }
  });

  assert.equal(invalidUpdateResponse?.result?.isError, true);
  assert.equal(
    (invalidUpdateResponse?.result?.structuredContent as { error: { code: string } }).error.code,
    "VALIDATION_ERROR"
  );
});

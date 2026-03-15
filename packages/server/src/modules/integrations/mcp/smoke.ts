import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const repoRoot = fileURLToPath(new URL("../../../../../..", import.meta.url));

async function main() {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-mcp-smoke-"));
  const previousDbPath = process.env.BORODA_DB_PATH;
  const previousRequestLogging = process.env.BORODA_REQUEST_LOGGING;
  const previousMcpEnabled = process.env.BORODA_MCP_ENABLED;

  process.env.BORODA_DB_PATH = path.join(tempRoot, "smoke.sqlite");
  process.env.BORODA_REQUEST_LOGGING = "false";
  process.env.BORODA_MCP_ENABLED = "true";

  try {
    const [{ buildApp }, dbClient, { handleMcpRequest }, { getConfig }] = await Promise.all([
      import("../../../app"),
      import("../../../db/client"),
      import("./server"),
      import("../../../config")
    ]);

    assert.equal(getConfig().mcpEnabled, true);

    migrate(dbClient.db, {
      migrationsFolder: path.resolve(repoRoot, "drizzle/migrations")
    });

    const app = buildApp();
    await app.ready();

    try {
      const initializeResponse = await handleMcpRequest(app, {
        jsonrpc: "2.0",
        id: "initialize",
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: {
            name: "boroda-mcp-smoke",
            version: "0.1.0"
          }
        }
      });

      assert.equal(initializeResponse?.result?.protocolVersion, "2025-06-18");

      const toolsResponse = await handleMcpRequest(app, {
        jsonrpc: "2.0",
        id: "tools",
        method: "tools/list"
      });

      const toolNames = (toolsResponse?.result?.tools as Array<{ name: string }>).map((tool) => tool.name);

      assert.deepEqual(toolNames, [
        "boroda.list_projects",
        "boroda.list_tickets",
        "boroda.get_ticket",
        "boroda.create_ticket",
        "boroda.update_ticket",
        "boroda.attach_work_context",
        "boroda.append_activity"
      ]);
    } finally {
      await app.close();
      dbClient.sqlite.close();
    }
  } finally {
    if (previousDbPath === undefined) {
      delete process.env.BORODA_DB_PATH;
    } else {
      process.env.BORODA_DB_PATH = previousDbPath;
    }

    if (previousRequestLogging === undefined) {
      delete process.env.BORODA_REQUEST_LOGGING;
    } else {
      process.env.BORODA_REQUEST_LOGGING = previousRequestLogging;
    }

    if (previousMcpEnabled === undefined) {
      delete process.env.BORODA_MCP_ENABLED;
    } else {
      process.env.BORODA_MCP_ENABLED = previousMcpEnabled;
    }

    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();

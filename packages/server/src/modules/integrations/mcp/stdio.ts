import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { buildConfiguredApp } from "../../../app";
import { getConfig } from "../../../config";
import { db } from "../../../db/client";
import { logServerError } from "../../../shared/observability";
import { handleMcpRequest } from "./server";

const HEADER_SEPARATOR = "\r\n\r\n";
const MCP_DISABLED_MESSAGE =
  "Boroda MCP is disabled. Run `npm run mcp` or set BORODA_MCP_ENABLED=true before starting the MCP server.";

function encodeMessage(message: unknown) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"),
    body
  ]);
}

export async function runMcpServer() {
  const config = getConfig();

  if (!config.mcpEnabled) {
    throw new Error(MCP_DISABLED_MESSAGE);
  }

  migrate(db, {
    migrationsFolder: config.migrationsPath
  });

  const app = buildConfiguredApp(false, false);
  await app.ready();

  let buffer = Buffer.alloc(0);

  const processChunk = async () => {
    while (true) {
      const headerEnd = buffer.indexOf(HEADER_SEPARATOR);

      if (headerEnd === -1) {
        return;
      }

      const headerText = buffer.subarray(0, headerEnd).toString("utf8");
      const lengthHeader = headerText
        .split("\r\n")
        .find((line) => line.toLowerCase().startsWith("content-length:"));

      if (!lengthHeader) {
        throw new Error("Missing Content-Length header");
      }

      const contentLength = Number(lengthHeader.split(":")[1]?.trim());
      const bodyStart = headerEnd + HEADER_SEPARATOR.length;

      if (!Number.isFinite(contentLength) || contentLength < 0) {
        throw new Error("Invalid Content-Length header");
      }

      if (buffer.length < bodyStart + contentLength) {
        return;
      }

      const messageBuffer = buffer.subarray(bodyStart, bodyStart + contentLength);
      buffer = buffer.subarray(bodyStart + contentLength);

      const request = JSON.parse(messageBuffer.toString("utf8")) as Parameters<typeof handleMcpRequest>[1];
      const response = await handleMcpRequest(app, request);

      if (response) {
        process.stdout.write(encodeMessage(response));
      }
    }
  };

  process.on("SIGINT", async () => {
    await app.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });

  try {
    for await (const chunk of process.stdin) {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      await processChunk();
    }
  } catch (error) {
    logServerError(console, "mcp.server.failed", error, {});
    process.exitCode = 1;
  } finally {
    await app.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await runMcpServer();
}

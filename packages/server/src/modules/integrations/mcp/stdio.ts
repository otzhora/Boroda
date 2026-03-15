import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { fileURLToPath } from "node:url";
import { buildConfiguredApp } from "../../../app";
import { getConfig } from "../../../config";
import { db } from "../../../db/client";
import { logServerError } from "../../../shared/observability";
import { handleMcpRequest } from "./server";

const HEADER_SEPARATOR = "\r\n\r\n";
const MCP_DISABLED_MESSAGE =
  "Boroda MCP is disabled. Run `./scripts/run-mcp.sh` or set BORODA_MCP_ENABLED=true before starting the MCP server.";

type StdioMessageMode = "content-length" | "line-delimited";

function encodeMessage(message: unknown, mode: StdioMessageMode) {
  const body = Buffer.from(JSON.stringify(message), "utf8");

  if (mode === "line-delimited") {
    return Buffer.concat([body, Buffer.from("\n", "utf8")]);
  }

  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"), body]);
}

function tryReadContentLengthMessage(buffer: Buffer) {
  const headerEnd = buffer.indexOf(HEADER_SEPARATOR);

  if (headerEnd === -1) {
    return null;
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
    return null;
  }

  return {
    mode: "content-length" as const,
    requestText: buffer.subarray(bodyStart, bodyStart + contentLength).toString("utf8"),
    remainingBuffer: buffer.subarray(bodyStart + contentLength)
  };
}

function tryReadLineDelimitedMessage(buffer: Buffer) {
  const newlineIndex = buffer.indexOf("\n");

  if (newlineIndex === -1) {
    return null;
  }

  const line = buffer.subarray(0, newlineIndex).toString("utf8").trim();
  const remainingBuffer = buffer.subarray(newlineIndex + 1);

  if (line.length === 0) {
    return {
      mode: "line-delimited" as const,
      requestText: null,
      remainingBuffer
    };
  }

  return {
    mode: "line-delimited" as const,
    requestText: line,
    remainingBuffer
  };
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
      const framedMessage = tryReadContentLengthMessage(buffer);

      if (framedMessage) {
        buffer = framedMessage.remainingBuffer;

        const request = JSON.parse(framedMessage.requestText) as Parameters<typeof handleMcpRequest>[1];
        const response = await handleMcpRequest(app, request);

        if (response) {
          process.stdout.write(encodeMessage(response, framedMessage.mode));
        }

        continue;
      }

      const firstNonWhitespace = buffer.toString("utf8", 0, Math.min(buffer.length, 32)).trimStart()[0];

      if (firstNonWhitespace !== "{" && firstNonWhitespace !== "[") {
        return;
      }

      const lineMessage = tryReadLineDelimitedMessage(buffer);

      if (!lineMessage) {
        return;
      }

      buffer = lineMessage.remainingBuffer;

      if (!lineMessage.requestText) {
        continue;
      }

      const request = JSON.parse(lineMessage.requestText) as Parameters<typeof handleMcpRequest>[1];
      const response = await handleMcpRequest(app, request);

      if (response) {
        process.stdout.write(encodeMessage(response, lineMessage.mode));
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

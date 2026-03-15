import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { buildConfiguredApp } from "../../../app";
import { getConfig } from "../../../config";
import { db } from "../../../db/client";
import { logServerError } from "../../../shared/observability";
import { handleMcpRequest } from "./server";

const HEADER_SEPARATOR = "\r\n\r\n";

function encodeMessage(message: unknown) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  return Buffer.concat([
    Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8"),
    body
  ]);
}

async function main() {
  const config = getConfig();
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

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    processChunk().catch(async (error: unknown) => {
      logServerError(console, "mcp.server.failed", error, {});
      await app.close();
      process.exitCode = 1;
      process.stdin.pause();
    });
  });

  process.stdin.on("end", async () => {
    await app.close();
  });

  process.on("SIGINT", async () => {
    await app.close();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });
}

await main();

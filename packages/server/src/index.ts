import { getConfig } from "./config";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db/client";
import { buildApp } from "./app";
import { logServerEvent } from "./shared/observability";

const config = getConfig();
logServerEvent(console, "info", "server.migrations.started", {
  migrationsPath: config.migrationsPath
});
migrate(db, {
  migrationsFolder: config.migrationsPath
});
logServerEvent(console, "info", "server.migrations.completed", {
  migrationsPath: config.migrationsPath
});

const app = buildApp();

await app.listen({
  host: config.host,
  port: config.port
});

logServerEvent(app, "info", "server.listen.completed", {
  host: config.host,
  port: config.port
});

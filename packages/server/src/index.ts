import { getConfig } from "./config";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./db/client";
import { buildApp } from "./app";

const config = getConfig();
migrate(db, {
  migrationsFolder: config.migrationsPath
});

const app = buildApp();

await app.listen({
  host: config.host,
  port: config.port
});

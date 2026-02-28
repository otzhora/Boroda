import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function getConfig() {
  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3000),
    databasePath: process.env.BORODA_DB_PATH ?? path.resolve(repoRoot, "data/boroda.sqlite"),
    webDistPath: path.resolve(repoRoot, "apps/web/dist"),
    migrationsPath: path.resolve(repoRoot, "drizzle/migrations")
  };
}

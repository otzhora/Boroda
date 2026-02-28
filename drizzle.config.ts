import path from "node:path";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/server/src/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.BORODA_DB_PATH ?? path.resolve(process.cwd(), "data/boroda.sqlite")
  },
  strict: true,
  verbose: true
});


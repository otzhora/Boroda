import os from "node:os";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

function getDefaultDataRoot() {
  if (process.platform === "win32") {
    return path.resolve(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), "Boroda");
  }

  if (process.platform === "darwin") {
    return path.resolve(os.homedir(), "Library", "Application Support", "Boroda");
  }

  return path.resolve(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "boroda");
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./packages/server/src/db/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    url: process.env.BORODA_DB_PATH ?? path.resolve(getDefaultDataRoot(), "boroda.sqlite")
  },
  strict: true,
  verbose: true
});

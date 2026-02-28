import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { getConfig } from "../config";
import { db } from "./client";

const config = getConfig();

migrate(db, {
  migrationsFolder: config.migrationsPath
});

console.log("Migrations applied from drizzle/migrations.");

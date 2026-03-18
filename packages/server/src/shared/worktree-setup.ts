import fs from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface ProjectFolderSetupInfo {
  hasWorktreeSetup: boolean;
  configPath: string | null;
}

export function getProjectFolderSetupInfo(folderPath: string): ProjectFolderSetupInfo {
  const configPath = path.resolve(folderPath, ".boroda", "worktree.setup.json");
  return {
    hasWorktreeSetup: fs.existsSync(configPath),
    configPath: fs.existsSync(configPath) ? configPath : null
  };
}

export async function scaffoldProjectFolderWorktreeSetup(folderPath: string) {
  const borodaDirectory = path.resolve(folderPath, ".boroda");
  const configPath = path.resolve(borodaDirectory, "worktree.setup.json");

  await rm(borodaDirectory, { recursive: true, force: true });
  await mkdir(borodaDirectory, { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        version: 1,
        onCreate: [
          'copy-file("/.env")',
          'copy-file("/.env.local")',
          'copy-file("/.env.development")',
          'copy-file("/.env.test")',
          'copy-file("/.env.staging")',
          'copy-file("/appsettings.json")',
          'copy-file("/appsettings.Development.json")',
          'copy-file("/src/backend/appsettings.Development.json")'
        ],
        steps: {}
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  return getProjectFolderSetupInfo(folderPath);
}

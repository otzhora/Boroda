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

function createCopyEnvScript() {
  return `#!/bin/sh
set -eu

copy_if_present() {
  source_path="$1"
  target_path="$2"

  if [ -f "$source_path" ] && [ ! -e "$target_path" ]; then
    cp "$source_path" "$target_path"
  fi
}

copy_if_present "$BORODA_REPO_PATH/.env" "$BORODA_WORKTREE_PATH/.env"
copy_if_present "$BORODA_REPO_PATH/.env.local" "$BORODA_WORKTREE_PATH/.env.local"
copy_if_present "$BORODA_REPO_PATH/.env.development" "$BORODA_WORKTREE_PATH/.env.development"
copy_if_present "$BORODA_REPO_PATH/.env.test" "$BORODA_WORKTREE_PATH/.env.test"
copy_if_present "$BORODA_REPO_PATH/.env.staging" "$BORODA_WORKTREE_PATH/.env.staging"
copy_if_present "$BORODA_REPO_PATH/appsettings.json" "$BORODA_WORKTREE_PATH/appsettings.json"
copy_if_present "$BORODA_REPO_PATH/appsettings.Development.json" "$BORODA_WORKTREE_PATH/appsettings.Development.json"
`;
}

export async function scaffoldProjectFolderWorktreeSetup(folderPath: string) {
  const borodaDirectory = path.resolve(folderPath, ".boroda");
  const scriptsDirectory = path.resolve(borodaDirectory, "scripts");
  const configPath = path.resolve(borodaDirectory, "worktree.setup.json");
  const scriptPath = path.resolve(scriptsDirectory, "copy-env.sh");

  await rm(borodaDirectory, { recursive: true, force: true });
  await mkdir(scriptsDirectory, { recursive: true });
  await writeFile(
    configPath,
    `${JSON.stringify(
      {
        version: 1,
        onCreate: ["copy-env"],
        steps: {
          "copy-env": {
            script: ".boroda/scripts/copy-env.sh"
          }
        }
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(scriptPath, createCopyEnvScript(), { mode: 0o755 });

  return getProjectFolderSetupInfo(folderPath);
}

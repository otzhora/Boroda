import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

function getDefaultDataRoot() {
  const appDirName = "Boroda";

  if (process.platform === "win32") {
    return path.resolve(process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local"), appDirName);
  }

  if (process.platform === "darwin") {
    return path.resolve(os.homedir(), "Library", "Application Support", appDirName);
  }

  return path.resolve(process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share"), "boroda");
}

export function getConfig() {
  const defaultTerminalBinary =
    process.platform === "win32" || process.env.WSL_DISTRO_NAME ? "wt.exe" : "x-terminal-emulator";
  const defaultDataRoot = getDefaultDataRoot();

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3000),
    databasePath: process.env.BORODA_DB_PATH ?? path.resolve(defaultDataRoot, "boroda.sqlite"),
    uploadsPath: process.env.BORODA_UPLOADS_PATH ?? path.resolve(defaultDataRoot, "uploads"),
    worktreesPath: process.env.BORODA_WORKTREES_PATH ?? path.resolve(defaultDataRoot, "worktrees"),
    webDistPath: path.resolve(repoRoot, "apps/web/dist"),
    migrationsPath: path.resolve(repoRoot, "drizzle/migrations"),
    explorerBinary: process.env.BORODA_EXPLORER_BIN ?? "explorer.exe",
    vscodeBinary: process.env.BORODA_VSCODE_BIN ?? "code",
    cursorBinary: process.env.BORODA_CURSOR_BIN ?? "cursor",
    terminalBinary: process.env.BORODA_TERMINAL_BIN ?? defaultTerminalBinary,
    windowsTerminalSettingsPath: process.env.BORODA_WINDOWS_TERMINAL_SETTINGS_PATH ?? ""
  };
}

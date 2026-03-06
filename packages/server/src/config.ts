import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function getConfig() {
  const defaultTerminalBinary =
    process.platform === "win32" || process.env.WSL_DISTRO_NAME ? "wt.exe" : "x-terminal-emulator";

  return {
    host: process.env.HOST ?? "0.0.0.0",
    port: Number(process.env.PORT ?? 3000),
    databasePath: process.env.BORODA_DB_PATH ?? path.resolve(repoRoot, "data/boroda.sqlite"),
    uploadsPath: process.env.BORODA_UPLOADS_PATH ?? path.resolve(repoRoot, "data/uploads"),
    worktreesPath: process.env.BORODA_WORKTREES_PATH ?? path.resolve(repoRoot, "data/worktrees"),
    webDistPath: path.resolve(repoRoot, "apps/web/dist"),
    migrationsPath: path.resolve(repoRoot, "drizzle/migrations"),
    explorerBinary: process.env.BORODA_EXPLORER_BIN ?? "explorer.exe",
    vscodeBinary: process.env.BORODA_VSCODE_BIN ?? "code",
    cursorBinary: process.env.BORODA_CURSOR_BIN ?? "cursor",
    terminalBinary: process.env.BORODA_TERMINAL_BIN ?? defaultTerminalBinary,
    windowsTerminalSettingsPath: process.env.BORODA_WINDOWS_TERMINAL_SETTINGS_PATH ?? ""
  };
}

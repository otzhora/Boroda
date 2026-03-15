import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { AppError } from "../../../shared/errors";
import type { OpenInTarget } from "./types";

interface OpenInProviderContext {
  target: OpenInTarget;
}

export interface LauncherSpec {
  binary: string;
  args: (directory: string) => string[];
  cwd?: (directory: string) => string | undefined;
  preserveInputCwd?: boolean;
}

interface OpenInProvider {
  target: OpenInTarget;
  label: string;
  getLauncherSpec: () => LauncherSpec;
}

interface WindowsTerminalProfile {
  guid: string;
  name?: string;
  source?: string;
  commandline?: string;
}

function isWslEnvironment() {
  return Boolean(process.env.WSL_DISTRO_NAME);
}

function toWindowsPath(input: string) {
  if (process.platform === "win32") {
    return input;
  }

  if (!isWslEnvironment()) {
    return null;
  }

  const result = spawnSync("wslpath", ["-w", input], {
    encoding: "utf8"
  });

  const output = result.stdout.trim();
  return result.status === 0 && output ? output : null;
}

function toWindowsPathOrThrow(input: string) {
  const windowsPath = toWindowsPath(input);

  if (windowsPath) {
    return windowsPath;
  }

  throw new AppError(501, "OPEN_TARGET_UNSUPPORTED", "Explorer is only supported on Windows or WSL");
}

function isWindowsTerminalBinary(binary: string) {
  return /(^|[\\/])wt(?:\.exe)?$/i.test(binary);
}

function findWindowsTerminalSettingsPath() {
  const configuredPath = process.env.BORODA_WINDOWS_TERMINAL_SETTINGS_PATH ?? "";
  if (configuredPath) {
    return configuredPath;
  }

  if (process.platform === "win32") {
    return null;
  }

  const usersRoot = "/mnt/c/Users";
  if (!fs.existsSync(usersRoot)) {
    return null;
  }

  const candidateRelativePaths = [
    "AppData/Local/Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json",
    "AppData/Local/Packages/Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe/LocalState/settings.json",
    "AppData/Local/Microsoft/Windows Terminal/settings.json"
  ];

  for (const userDirectory of fs.readdirSync(usersRoot)) {
    for (const relativePath of candidateRelativePaths) {
      const candidatePath = path.join(usersRoot, userDirectory, relativePath);
      if (fs.existsSync(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return null;
}

function loadDefaultWindowsTerminalProfile(): WindowsTerminalProfile | null {
  const settingsPath = findWindowsTerminalSettingsPath();
  if (!settingsPath || !fs.existsSync(settingsPath)) {
    return null;
  }

  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8")) as {
      defaultProfile?: string;
      profiles?: { list?: WindowsTerminalProfile[] };
    };

    if (!settings.defaultProfile) {
      return null;
    }

    return settings.profiles?.list?.find((profile) => profile.guid === settings.defaultProfile) ?? null;
  } catch {
    return null;
  }
}

function isWslWindowsTerminalProfile(profile: WindowsTerminalProfile | null) {
  if (!profile) {
    return false;
  }

  return (
    profile.source === "Windows.Terminal.Wsl" ||
    profile.source?.startsWith("CanonicalGroupLimited.") === true ||
    profile.commandline?.toLowerCase().includes("wsl.exe") === true ||
    profile.name?.toLowerCase().includes("ubuntu") === true
  );
}

function buildWindowsTerminalArgs(directory: string) {
  const defaultProfile = loadDefaultWindowsTerminalProfile();

  if (process.platform !== "win32" && isWslEnvironment() && isWslWindowsTerminalProfile(defaultProfile)) {
    const args = ["-w", "0", "nt"];
    if (defaultProfile?.guid) {
      args.push("-p", defaultProfile.guid);
    }

    args.push("wsl.exe", "--distribution", process.env.WSL_DISTRO_NAME ?? "", "--cd", directory);
    return args;
  }

  const windowsPath = toWindowsPath(directory);
  return ["-w", "0", "nt", "-d", windowsPath ?? directory];
}

function createProvider(target: OpenInTarget, label: string, getLauncherSpec: () => LauncherSpec): OpenInProvider {
  return { target, label, getLauncherSpec };
}

const openInProviders: Record<OpenInTarget, OpenInProvider> = {
  explorer: createProvider("explorer", "File Explorer", () => ({
    binary: process.env.BORODA_EXPLORER_BIN ?? "explorer.exe",
    args: (directory: string) => [toWindowsPathOrThrow(directory)],
    preserveInputCwd: true
  })),
  vscode: createProvider("vscode", "VS Code", () => ({
    binary: process.env.BORODA_VSCODE_BIN ?? "code",
    args: (directory: string) => [directory],
    preserveInputCwd: true
  })),
  cursor: createProvider("cursor", "Cursor", () => ({
    binary: process.env.BORODA_CURSOR_BIN ?? "cursor",
    args: (directory: string) => [directory],
    preserveInputCwd: true
  })),
  terminal: createProvider("terminal", "Terminal", () => {
    const defaultTerminalBinary =
      process.platform === "win32" || process.env.WSL_DISTRO_NAME ? "wt.exe" : "x-terminal-emulator";
    const binary = process.env.BORODA_TERMINAL_BIN ?? defaultTerminalBinary;

    if (isWindowsTerminalBinary(binary)) {
      return {
        binary,
        args: (directory: string) => buildWindowsTerminalArgs(directory),
        cwd: () => undefined
      };
    }

    return {
      binary,
      args: (directory: string) => {
        if (process.platform === "win32" || isWslEnvironment()) {
          const windowsPath = toWindowsPath(directory);
          return windowsPath ? ["-d", windowsPath] : [];
        }

        return [];
      },
      cwd: (directory: string) => (process.platform === "win32" || isWslEnvironment() ? undefined : directory)
    };
  })
};

export function getOpenInProvider(input: OpenInProviderContext) {
  return openInProviders[input.target];
}

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { getConfig } from "../../../config";
import { AppError } from "../../../shared/errors";
import { getTicketOrThrow } from "../../tickets/service";

interface LaunchWindowsTerminalInput {
  directory: string;
}

interface OpenTicketInWindowsTerminalInput {
  folderId?: number;
}

interface PreferredFolderCandidate {
  projectId: number;
  relationship: string;
  project: {
    folders: Array<{
      id: number;
      path: string;
      isPrimary: boolean;
      existsOnDisk: boolean;
    }>;
  };
}

interface WindowsTerminalProfile {
  guid: string;
  name?: string;
  source?: string;
  commandline?: string;
}

function sortProjectLinks(links: PreferredFolderCandidate[]) {
  return [...links].sort((left, right) => {
    if (left.relationship === right.relationship) {
      return left.projectId - right.projectId;
    }

    if (left.relationship === "PRIMARY") {
      return -1;
    }

    if (right.relationship === "PRIMARY") {
      return 1;
    }

    return left.projectId - right.projectId;
  });
}

function pickPreferredFolder(links: PreferredFolderCandidate[]) {
  for (const link of sortProjectLinks(links)) {
    const primaryFolder = link.project.folders.find((folder) => folder.isPrimary);
    if (primaryFolder?.existsOnDisk) {
      return primaryFolder;
    }

    const firstExistingFolder = link.project.folders.find((folder) => folder.existsOnDisk);
    if (firstExistingFolder) {
      return firstExistingFolder;
    }
  }

  return null;
}

function findLinkedProjectFolder(
  links: PreferredFolderCandidate[],
  folderId: number
) {
  for (const link of links) {
    const folder = link.project.folders.find((candidate) => candidate.id === folderId);
    if (folder) {
      return folder;
    }
  }

  return null;
}

function findWindowsTerminalSettingsPath() {
  const config = getConfig();

  if (config.windowsTerminalSettingsPath) {
    return config.windowsTerminalSettingsPath;
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
      profiles?: {
        list?: WindowsTerminalProfile[];
      };
    };
    const defaultProfileGuid = settings.defaultProfile;
    const profiles = settings.profiles?.list ?? [];

    if (!defaultProfileGuid) {
      return null;
    }

    return profiles.find((profile) => profile.guid === defaultProfileGuid) ?? null;
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

function resolveWindowsTerminalStartingDirectory(input: string) {
  if (process.platform === "win32") {
    return input;
  }

  if (!process.env.WSL_DISTRO_NAME) {
    throw new AppError(
      501,
      "WINDOWS_TERMINAL_UNSUPPORTED",
      "Windows Terminal launch is only supported on Windows or WSL"
    );
  }

  const result = spawnSync("wslpath", ["-w", input], {
    encoding: "utf8"
  });

  if (result.status === 0 && result.stdout.trim()) {
    return result.stdout.trim();
  }

  if (result.error && "stdout" in result.error && typeof result.error.stdout === "string" && result.error.stdout.trim()) {
    return result.error.stdout.trim();
  }

  if (result.stdout.trim()) {
    return result.stdout.trim();
  }

  {
    throw new AppError(
      501,
      "WINDOWS_TERMINAL_UNSUPPORTED",
      "Could not translate the project directory for Windows Terminal"
    );
  }
}

function buildWindowsTerminalArgs(input: LaunchWindowsTerminalInput) {
  const defaultProfile = loadDefaultWindowsTerminalProfile();

  if (process.platform !== "win32" && process.env.WSL_DISTRO_NAME && isWslWindowsTerminalProfile(defaultProfile)) {
    const args = ["-w", "0", "nt"];

    if (defaultProfile?.guid) {
      args.push("-p", defaultProfile.guid);
    }

    args.push("wsl.exe", "--distribution", process.env.WSL_DISTRO_NAME, "--cd", input.directory);
    return args;
  }

  return ["-w", "0", "nt", "-d", resolveWindowsTerminalStartingDirectory(input.directory)];
}

export async function openWindowsTerminal(input: LaunchWindowsTerminalInput) {
  const config = getConfig();
  const child = spawn(config.windowsTerminalBinary, buildWindowsTerminalArgs(input), {
    detached: true,
    stdio: "ignore"
  });

  try {
    await new Promise<void>((resolve, reject) => {
      child.once("spawn", () => {
        resolve();
      });
      child.once("error", (error) => {
        reject(error);
      });
    });
    child.unref();
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string" &&
      error.code === "ENOENT"
    ) {
      throw new AppError(
        501,
        "WINDOWS_TERMINAL_NOT_AVAILABLE",
        "Windows Terminal is not available on this machine"
      );
    }

    throw error;
  }

  return {
    ok: true as const,
    directory: input.directory
  };
}

export async function openTicketInWindowsTerminal(
  app: FastifyInstance,
  ticketId: number,
  input: OpenTicketInWindowsTerminalInput = {}
) {
  const ticket = await getTicketOrThrow(app, ticketId);
  const selectedFolder =
    input.folderId === undefined ? pickPreferredFolder(ticket.projectLinks) : findLinkedProjectFolder(ticket.projectLinks, input.folderId);

  if (input.folderId !== undefined && !selectedFolder) {
    throw new AppError(
      409,
      "TICKET_PROJECT_FOLDER_NOT_AVAILABLE",
      "The selected project folder is not available for this ticket"
    );
  }

  if (!selectedFolder?.existsOnDisk) {
    throw new AppError(
      409,
      "TICKET_PROJECT_FOLDER_NOT_AVAILABLE",
      input.folderId === undefined
        ? "No linked project folder is available for this ticket"
        : "The selected project folder is not available for this ticket"
    );
  }

  return openWindowsTerminal({
    directory: selectedFolder.path
  });
}

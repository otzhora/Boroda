import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { getConfig } from "../../../config";
import { ticketWorkspaces } from "../../../db/schema";
import { AppError } from "../../../shared/errors";
import { getTicketOrThrow } from "../../tickets/service";
import {
  detectRemoteDefaultBranch,
  ensureGitRepo,
  ensureWorkspaceWorktree,
  validateWorkspaceWorktree
} from "./git-workspaces";

export type OpenInTarget = "explorer" | "vscode" | "cursor" | "terminal";
export type OpenInMode = "folder" | "worktree";

interface OpenInAppInput {
  directory: string;
  target: OpenInTarget;
}

interface LauncherSpec {
  binary: string;
  args: (directory: string) => string[];
  cwd?: (directory: string) => string | undefined;
  preserveInputCwd?: boolean;
}

interface OpenTicketInAppInput {
  target: OpenInTarget;
  mode: OpenInMode;
  folderId?: number;
  workspaceId?: number;
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

interface TicketWorkspaceCandidate {
  id: number;
  ticketId: number;
  projectFolderId: number;
  branchName: string;
  baseBranch: string | null;
  role: string;
  worktreePath: string | null;
  createdByBoroda: boolean;
  lastOpenedAt: string | null;
  projectFolder: {
    id: number;
    projectId: number;
    label: string;
    path: string;
    defaultBranch: string | null;
    project: {
      id: number;
      name: string;
      slug: string;
    };
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

function findLinkedProjectFolder(links: PreferredFolderCandidate[], folderId: number) {
  for (const link of links) {
    const folder = link.project.folders.find((candidate) => candidate.id === folderId);
    if (folder) {
      return folder;
    }
  }

  return null;
}

function slugifyPathSegment(input: string) {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "workspace";
}

function getManagedWorkspacePath(params: {
  ticketKey: string;
  projectSlug: string;
  folderLabel: string;
  branchName: string;
}) {
  return path.resolve(
    getConfig().worktreesPath,
    params.ticketKey,
    slugifyPathSegment(params.projectSlug),
    slugifyPathSegment(params.folderLabel),
    slugifyPathSegment(params.branchName)
  );
}

function findWorkspacesForFolder(workspaces: TicketWorkspaceCandidate[], folderId: number) {
  return workspaces.filter((workspace) => workspace.projectFolderId === folderId);
}

function isWslEnvironment() {
  return Boolean(process.env.WSL_DISTRO_NAME);
}

function toWindowsPath(input: string) {
  if (process.platform === "win32") {
    return input;
  }

  if (!isWslEnvironment()) {
    throw new AppError(501, "OPEN_TARGET_UNSUPPORTED", "Explorer is only supported on Windows or WSL");
  }

  const result = spawnSync("wslpath", ["-w", input], {
    encoding: "utf8"
  });

  const output = result.stdout.trim();

  if (result.status === 0 && output) {
    return output;
  }

  throw new AppError(501, "OPEN_TARGET_UNSUPPORTED", "Could not translate the project directory for Explorer");
}

function getTargetLabel(target: OpenInTarget) {
  switch (target) {
    case "explorer":
      return "File Explorer";
    case "vscode":
      return "VS Code";
    case "cursor":
      return "Cursor";
    case "terminal":
      return "Terminal";
  }
}

function isWindowsTerminalBinary(binary: string) {
  return /(^|[\\/])wt(?:\.exe)?$/i.test(binary);
}

function isExplicitBinaryPath(binary: string) {
  return binary.includes("/") || binary.includes("\\");
}

function shouldDetachOpenCommand() {
  return !process.execArgv.includes("--test");
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
      profiles?: { list?: WindowsTerminalProfile[] };
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

  return ["-w", "0", "nt", "-d", toWindowsPath(directory)];
}

function getLauncher(target: OpenInTarget): LauncherSpec {
  const config = getConfig();

  switch (target) {
    case "explorer":
      return {
        binary: config.explorerBinary,
        args: (directory: string) => [toWindowsPath(directory)],
        preserveInputCwd: true
      };
    case "vscode":
      return {
        binary: config.vscodeBinary,
        args: (directory: string) => [directory],
        preserveInputCwd: true
      };
    case "cursor":
      return {
        binary: config.cursorBinary,
        args: (directory: string) => [directory],
        preserveInputCwd: true
      };
    case "terminal":
      if (isWindowsTerminalBinary(config.terminalBinary)) {
        return {
          binary: config.terminalBinary,
          args: (directory: string) => buildWindowsTerminalArgs(directory),
          cwd: () => undefined
        };
      }

      return {
        binary: config.terminalBinary,
        args: (directory: string) => {
          if (process.platform === "win32" || isWslEnvironment()) {
            return ["-d", toWindowsPath(directory)];
          }

          return [];
        },
        cwd: (directory: string) => (process.platform === "win32" || isWslEnvironment() ? undefined : directory)
      };
  }
}

export async function openInApp(input: OpenInAppInput) {
  const launcher = getLauncher(input.target);

  if (isExplicitBinaryPath(launcher.binary) && !fs.existsSync(launcher.binary)) {
    throw new AppError(501, "OPEN_TARGET_NOT_AVAILABLE", `${getTargetLabel(input.target)} is not available on this machine`);
  }

  const resolvedCwd = launcher.cwd ? launcher.cwd(input.directory) : launcher.preserveInputCwd ? input.directory : undefined;
  const child = spawn(launcher.binary, launcher.args(input.directory), {
    cwd: resolvedCwd,
    detached: shouldDetachOpenCommand(),
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
    if (error instanceof Error && "code" in error && typeof error.code === "string" && error.code === "ENOENT") {
      throw new AppError(501, "OPEN_TARGET_NOT_AVAILABLE", `${getTargetLabel(input.target)} is not available on this machine`);
    }

    throw error;
  }

  return {
    ok: true as const,
    directory: input.directory,
    target: input.target
  };
}

async function resolveWorkspaceDirectory(
  app: FastifyInstance,
  ticket: Awaited<ReturnType<typeof getTicketOrThrow>>,
  folderId: number,
  workspace: TicketWorkspaceCandidate
) {
  const repoRoot = ensureGitRepo(workspace.projectFolder.path);
  const folderDefaultBranch = workspace.projectFolder.defaultBranch?.trim() || null;
  const detectedDefaultBranch = detectRemoteDefaultBranch(repoRoot);
  const baseBranch = workspace.baseBranch?.trim() || folderDefaultBranch;

  if (folderDefaultBranch && detectedDefaultBranch && folderDefaultBranch !== detectedDefaultBranch) {
    throw new AppError(409, "WORKSPACE_DEFAULT_BRANCH_INVALID", "The configured default branch does not match the repository default branch", {
      projectFolderId: folderId,
      configuredDefaultBranch: folderDefaultBranch,
      detectedDefaultBranch
    });
  }

  const worktreePath =
    workspace.worktreePath ??
    getManagedWorkspacePath({
      ticketKey: ticket.key,
      projectSlug: workspace.projectFolder.project.slug,
      folderLabel: workspace.projectFolder.label,
      branchName: workspace.branchName
    });
  await mkdir(path.dirname(worktreePath), { recursive: true });

  const ensuredPath = workspace.worktreePath
    ? validateWorkspaceWorktree({
        worktreePath,
        expectedBranch: workspace.branchName
      })
    : await ensureWorkspaceWorktree({
        repoPath: repoRoot,
        worktreePath,
        branchName: workspace.branchName,
        baseBranch
      });

  const now = new Date().toISOString();
  app.db
    .update(ticketWorkspaces)
    .set({
      worktreePath: ensuredPath,
      updatedAt: now,
      lastOpenedAt: now
    })
    .where(eq(ticketWorkspaces.id, workspace.id))
    .run();

  return ensuredPath;
}

export async function openTicketInApp(app: FastifyInstance, ticketId: number, input: OpenTicketInAppInput) {
  const ticket = await getTicketOrThrow(app, ticketId);
  const selectedFolder =
    input.folderId === undefined ? pickPreferredFolder(ticket.projectLinks) : findLinkedProjectFolder(ticket.projectLinks, input.folderId);

  if (input.folderId !== undefined && !selectedFolder) {
    throw new AppError(409, "TICKET_PROJECT_FOLDER_NOT_AVAILABLE", "The selected project folder is not available for this ticket");
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

  let directory = selectedFolder.path;

  if (input.mode === "worktree") {
    const matchingWorkspaces = findWorkspacesForFolder(ticket.workspaces ?? [], selectedFolder.id);
    let selectedWorkspace: TicketWorkspaceCandidate | null = null;

    if (input.workspaceId !== undefined) {
      selectedWorkspace = matchingWorkspaces.find((workspace) => workspace.id === input.workspaceId) ?? null;

      if (!selectedWorkspace) {
        throw new AppError(409, "TICKET_WORKSPACE_NOT_AVAILABLE", "The selected workspace is not available for this folder", {
          folderId: selectedFolder.id,
          workspaceId: input.workspaceId
        });
      }
    } else if (matchingWorkspaces.length > 1) {
      throw new AppError(409, "TICKET_WORKSPACE_SELECTION_REQUIRED", "Choose which ticket workspace to open for this folder", {
        folderId: selectedFolder.id,
        workspaces: matchingWorkspaces.map((workspace) => ({
          id: workspace.id,
          branchName: workspace.branchName,
          role: workspace.role,
          projectFolderId: workspace.projectFolderId
        }))
      });
    } else {
      selectedWorkspace = matchingWorkspaces[0] ?? null;
    }

    if (!selectedWorkspace) {
      throw new AppError(409, "TICKET_WORKSPACE_NOT_AVAILABLE", "No ticket worktree is available for this folder", {
        folderId: selectedFolder.id
      });
    }

    directory = await resolveWorkspaceDirectory(app, ticket, selectedFolder.id, selectedWorkspace);
  }

  return openInApp({
    directory,
    target: input.target
  });
}

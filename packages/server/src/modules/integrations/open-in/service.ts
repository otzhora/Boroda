import { spawn, spawnSync } from "node:child_process";
import type { FastifyInstance } from "fastify";
import { getConfig } from "../../../config";
import { AppError } from "../../../shared/errors";
import { getTicketOrThrow } from "../../tickets/service";

export type OpenInTarget = "explorer" | "vscode" | "cursor";

interface OpenInAppInput {
  directory: string;
  target: OpenInTarget;
}

interface OpenTicketInAppInput {
  target: OpenInTarget;
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
  }
}

function getLauncher(target: OpenInTarget) {
  const config = getConfig();

  switch (target) {
    case "explorer":
      return {
        binary: config.explorerBinary,
        args: (directory: string) => [toWindowsPath(directory)]
      };
    case "vscode":
      return {
        binary: config.vscodeBinary,
        args: (directory: string) => [directory]
      };
    case "cursor":
      return {
        binary: config.cursorBinary,
        args: (directory: string) => [directory]
      };
  }
}

export async function openInApp(input: OpenInAppInput) {
  const launcher = getLauncher(input.target);
  const child = spawn(launcher.binary, launcher.args(input.directory), {
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

  return openInApp({
    directory: selectedFolder.path,
    target: input.target
  });
}

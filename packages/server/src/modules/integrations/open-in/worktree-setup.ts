import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { z } from "zod";
import { AppError } from "../../../shared/errors";

const setupStepSchema = z.object({
  script: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).default({})
});

const worktreeSetupSchema = z.object({
  version: z.literal(1),
  onCreate: z.array(z.string().min(1)).default([]),
  steps: z.record(z.string(), setupStepSchema).default({})
});

interface CopyFileCommand {
  kind: "copy-file";
  sourcePath: string;
  targetPath: string;
}

function normalizeRelativeScriptPath(scriptPath: string) {
  return path.posix.normalize(scriptPath.replace(/\\/g, "/"));
}

function validateScriptPath(scriptPath: string) {
  const normalized = normalizeRelativeScriptPath(scriptPath);

  if (normalized.startsWith("/") || normalized === "." || normalized.startsWith("../")) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup scripts must stay within .boroda/scripts", {
      script: scriptPath
    });
  }

  if (!normalized.startsWith(".boroda/scripts/")) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup scripts must live under .boroda/scripts", {
      script: scriptPath
    });
  }

  return normalized;
}

function normalizeRepoRelativePath(filePath: string) {
  const normalized = path.posix.normalize(filePath.replace(/\\/g, "/"));
  const relativePath = normalized.startsWith("/") ? normalized.slice(1) : normalized;

  if (
    relativePath.length === 0 ||
    relativePath === "." ||
    relativePath === ".." ||
    relativePath.startsWith("../")
  ) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "copy-file paths must stay within the repository", {
      path: filePath
    });
  }

  return relativePath;
}

function parseCopyFileCommand(command: string): CopyFileCommand | null {
  const trimmed = command.trim();
  if (!trimmed.startsWith("copy-file(") || !trimmed.endsWith(")")) {
    return null;
  }

  const rawArgs = trimmed.slice("copy-file(".length, -1).trim();
  let args: unknown;

  try {
    args = JSON.parse(`[${rawArgs}]`);
  } catch (error) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Boroda could not parse copy-file(...) arguments", {
      command,
      reason: error instanceof Error ? error.message : "Invalid arguments"
    });
  }

  if (
    !Array.isArray(args) ||
    args.length < 1 ||
    args.length > 2 ||
    args.some((value) => typeof value !== "string" || value.trim().length === 0)
  ) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "copy-file(...) requires one or two string paths", {
      command
    });
  }

  const sourcePath = normalizeRepoRelativePath(args[0]);
  const targetPath = normalizeRepoRelativePath(args[1] ?? args[0]);

  return {
    kind: "copy-file",
    sourcePath,
    targetPath
  };
}

function resolvePathWithinRoot(rootPath: string, relativePath: string, errorDetails: Record<string, string>) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedPath = path.resolve(rootPath, relativePath);

  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup paths must stay within the repository", errorDetails);
  }

  return resolvedPath;
}

function loadWorktreeSetupConfig(repoPath: string) {
  const configPath = path.resolve(repoPath, ".boroda", "worktree.setup.json");

  if (!fs.existsSync(configPath)) {
    return null;
  }

  let rawConfig: unknown;
  try {
    rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Boroda could not parse .boroda/worktree.setup.json", {
      configPath,
      reason: error instanceof Error ? error.message : "Invalid JSON"
    });
  }

  const parsed = worktreeSetupSchema.safeParse(rawConfig);
  if (!parsed.success) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Boroda could not validate .boroda/worktree.setup.json", {
      configPath,
      issues: parsed.error.issues
    });
  }

  const config = parsed.data;
  for (const entry of config.onCreate) {
    if (config.steps[entry]) {
      continue;
    }

    if (parseCopyFileCommand(entry)) {
      continue;
    }

    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup references an unknown step", {
      configPath,
      step: entry
    });
  }

  for (const step of Object.values(config.steps)) {
    validateScriptPath(step.script);
  }

  return {
    configPath,
    config
  };
}

function resolveSetupScriptPath(repoPath: string, scriptPath: string) {
  const normalizedScript = validateScriptPath(scriptPath);
  const scriptRoot = path.resolve(repoPath, ".boroda", "scripts");
  const resolvedScriptPath = path.resolve(repoPath, normalizedScript);

  if (path.dirname(resolvedScriptPath) !== scriptRoot && !resolvedScriptPath.startsWith(`${scriptRoot}${path.sep}`)) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup scripts must stay within .boroda/scripts", {
      script: scriptPath
    });
  }

  if (!fs.existsSync(resolvedScriptPath)) {
    throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup script does not exist", {
      script: scriptPath
    });
  }

  return resolvedScriptPath;
}

function runCopyFileCommand(command: CopyFileCommand, params: { repoPath: string; worktreePath: string }) {
  const sourcePath = resolvePathWithinRoot(params.repoPath, command.sourcePath, {
    sourcePath: command.sourcePath
  });
  const targetPath = resolvePathWithinRoot(params.worktreePath, command.targetPath, {
    targetPath: command.targetPath
  });

  if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
    return;
  }

  if (fs.existsSync(targetPath)) {
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function runNamedSetupStep(
  stepName: string,
  step: z.infer<typeof setupStepSchema>,
  params: {
    worktreePath: string;
    ticketKey: string;
    branchName: string;
    repoPath: string;
  }
) {
  const scriptPath = resolveSetupScriptPath(params.repoPath, step.script);
  const env = {
    ...process.env,
    ...step.env,
    BORODA_TICKET_KEY: params.ticketKey,
    BORODA_BRANCH: params.branchName,
    BORODA_REPO_PATH: params.repoPath,
    BORODA_WORKTREE_PATH: params.worktreePath
  };

  const result = spawnSync(scriptPath, step.args, {
    cwd: params.worktreePath,
    env,
    encoding: "utf8"
  });

  if (result.error) {
    throw new AppError(409, "WORKTREE_SETUP_FAILED", "Boroda could not start the worktree setup script", {
      step: stepName,
      script: step.script,
      reason: result.error.message
    });
  }

  if (result.status !== 0) {
    throw new AppError(409, "WORKTREE_SETUP_FAILED", "Boroda worktree setup failed", {
      step: stepName,
      script: step.script,
      exitCode: result.status,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim()
    });
  }
}

function resolveOnCreateEntry(
  entry: string,
  stepMap: Record<string, z.infer<typeof setupStepSchema>>
) {
  const namedStep = stepMap[entry];
  if (namedStep) {
    return {
      kind: "step" as const,
      stepName: entry,
      step: namedStep
    };
  }

  const copyFileCommand = parseCopyFileCommand(entry);
  if (copyFileCommand) {
    return {
      kind: "copy-file" as const,
      command: copyFileCommand
    };
  }

  throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup references an unknown step", {
    step: entry
  });
}

export function runWorktreeSetup(params: {
  worktreePath: string;
  ticketKey: string;
  branchName: string;
  repoPath: string;
}) {
  const loaded = loadWorktreeSetupConfig(params.repoPath);
  if (!loaded || loaded.config.onCreate.length === 0) {
    return [];
  }

  const executedSteps: string[] = [];

  for (const entry of loaded.config.onCreate) {
    const resolvedEntry = resolveOnCreateEntry(entry, loaded.config.steps);

    if (resolvedEntry.kind === "step") {
      runNamedSetupStep(resolvedEntry.stepName, resolvedEntry.step, params);
    } else {
      runCopyFileCommand(resolvedEntry.command, params);
    }

    executedSteps.push(entry);
  }

  return executedSteps;
}

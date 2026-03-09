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
  steps: z.record(z.string(), setupStepSchema)
});

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
  for (const stepName of config.onCreate) {
    if (!config.steps[stepName]) {
      throw new AppError(409, "WORKTREE_SETUP_INVALID", "Worktree setup references an unknown step", {
        configPath,
        step: stepName
      });
    }
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

  for (const stepName of loaded.config.onCreate) {
    const step = loaded.config.steps[stepName];
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

    executedSteps.push(stepName);
  }

  return executedSteps;
}

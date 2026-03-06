import { mkdir } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getConfig } from "../../../config";
import { AppError } from "../../../shared/errors";

function runGit(repoPath: string, args: string[]) {
  const result = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8"
  });

  if (result.status === 0) {
    return result.stdout.trim();
  }

  throw new AppError(409, "GIT_COMMAND_FAILED", result.stderr.trim() || `git ${args.join(" ")} failed`, {
    repoPath,
    args
  });
}

function tryGit(repoPath: string, args: string[]) {
  const result = spawnSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8"
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };
}

function normalizeBranchRef(branchName: string) {
  return branchName.trim();
}

function branchCommitish(repoPath: string, branchName: string) {
  const branch = normalizeBranchRef(branchName);

  if (tryGit(repoPath, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]).ok) {
    return branch;
  }

  if (tryGit(repoPath, ["show-ref", "--verify", "--quiet", `refs/remotes/origin/${branch}`]).ok) {
    return `origin/${branch}`;
  }

  return null;
}

export function ensureGitRepo(repoPath: string) {
  const topLevel = tryGit(repoPath, ["rev-parse", "--show-toplevel"]);

  if (!topLevel.ok || !topLevel.stdout) {
    throw new AppError(409, "PROJECT_FOLDER_NOT_GIT_REPO", "The selected project folder is not a Git repository", {
      repoPath
    });
  }

  return topLevel.stdout;
}

export function detectRemoteDefaultBranch(repoPath: string) {
  const result = tryGit(repoPath, ["symbolic-ref", "refs/remotes/origin/HEAD"]);

  if (!result.ok || !result.stdout.startsWith("refs/remotes/origin/")) {
    return null;
  }

  return result.stdout.slice("refs/remotes/origin/".length);
}

export function ensureManagedWorktreePath(worktreePath: string) {
  const root = path.resolve(getConfig().worktreesPath);
  const resolvedPath = path.resolve(worktreePath);

  if (resolvedPath !== root && !resolvedPath.startsWith(`${root}${path.sep}`)) {
    throw new AppError(409, "WORKTREE_PATH_NOT_MANAGED", "The workspace path is outside Boroda-managed worktrees", {
      worktreePath: resolvedPath
    });
  }

  return resolvedPath;
}

export async function ensureWorkspaceWorktree(params: {
  repoPath: string;
  worktreePath: string;
  branchName: string;
  baseBranch: string | null;
}) {
  const repoRoot = ensureGitRepo(params.repoPath);
  const worktreePath = ensureManagedWorktreePath(params.worktreePath);

  if (fs.existsSync(worktreePath)) {
    return validateWorkspaceWorktree({
      worktreePath,
      expectedBranch: params.branchName
    });
  }

  await mkdir(path.dirname(worktreePath), { recursive: true });

  const localBranchExists = tryGit(repoRoot, [
    "show-ref",
    "--verify",
    "--quiet",
    `refs/heads/${params.branchName}`
  ]).ok;

  if (localBranchExists) {
    runGit(repoRoot, ["worktree", "add", worktreePath, params.branchName]);
    return worktreePath;
  }

  const remoteBranchExists = tryGit(repoRoot, [
    "show-ref",
    "--verify",
    "--quiet",
    `refs/remotes/origin/${params.branchName}`
  ]).ok;

  if (remoteBranchExists) {
    runGit(repoRoot, ["worktree", "add", worktreePath, "--track", "-b", params.branchName, `origin/${params.branchName}`]);
    return worktreePath;
  }

  const resolvedBaseBranch = params.baseBranch?.trim() || null;
  if (!resolvedBaseBranch) {
    throw new AppError(
      409,
      "WORKSPACE_DEFAULT_BRANCH_REQUIRED",
      "A default branch is required to create a new workspace branch",
      { branchName: params.branchName }
    );
  }

  const baseCommitish = branchCommitish(repoRoot, resolvedBaseBranch);
  if (!baseCommitish) {
    throw new AppError(
      409,
      "WORKSPACE_DEFAULT_BRANCH_INVALID",
      "The configured default branch does not exist for this repository",
      { branchName: resolvedBaseBranch }
    );
  }

  runGit(repoRoot, ["worktree", "add", worktreePath, "-b", params.branchName, baseCommitish]);
  return worktreePath;
}

export function validateWorkspaceWorktree(params: {
  worktreePath: string;
  expectedBranch: string;
}) {
  const worktreePath = ensureManagedWorktreePath(params.worktreePath);

  if (!fs.existsSync(worktreePath)) {
    throw new AppError(409, "WORKSPACE_MISSING", "The managed workspace path no longer exists", {
      worktreePath
    });
  }

  const topLevel = tryGit(worktreePath, ["rev-parse", "--show-toplevel"]);
  if (!topLevel.ok || path.resolve(topLevel.stdout) !== worktreePath) {
    throw new AppError(409, "WORKSPACE_INVALID", "The managed workspace is no longer a valid Git worktree", {
      worktreePath
    });
  }

  const branchName = tryGit(worktreePath, ["branch", "--show-current"]);
  if (!branchName.ok || !branchName.stdout) {
    throw new AppError(409, "WORKSPACE_DETACHED", "The managed workspace is not on a branch", {
      worktreePath
    });
  }

  if (branchName.stdout !== params.expectedBranch) {
    throw new AppError(409, "WORKSPACE_BRANCH_MISMATCH", "The managed workspace branch does not match the ticket workspace", {
      worktreePath,
      expectedBranch: params.expectedBranch,
      actualBranch: branchName.stdout
    });
  }

  return worktreePath;
}

export function isWorkspaceDirty(worktreePath: string) {
  const result = tryGit(worktreePath, ["status", "--porcelain"]);
  if (!result.ok) {
    throw new AppError(409, "WORKSPACE_INVALID", "The managed workspace is no longer a valid Git worktree", {
      worktreePath
    });
  }

  return result.stdout.length > 0;
}

export function removeWorkspaceWorktree(worktreePath: string) {
  const resolvedPath = ensureManagedWorktreePath(worktreePath);

  if (!fs.existsSync(resolvedPath)) {
    return;
  }

  const result = tryGit(path.dirname(resolvedPath), ["worktree", "remove", resolvedPath]);
  if (!result.ok) {
    throw new AppError(409, "WORKSPACE_REMOVE_FAILED", "Boroda could not remove the managed workspace", {
      worktreePath: resolvedPath,
      reason: result.stderr
    });
  }
}

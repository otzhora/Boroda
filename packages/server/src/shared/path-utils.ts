import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors";
import type { PathInfo } from "./types";

function isWindowsDrivePath(input: string) {
  return /^[A-Za-z]:[\\/]/.test(input);
}

function isUncPath(input: string) {
  return /^\\\\[^\\]+\\[^\\]+/.test(input);
}

function isWindowsAbsolutePath(input: string) {
  return isWindowsDrivePath(input) || isUncPath(input);
}

function isWslEnvironment() {
  return Boolean(process.env.WSL_DISTRO_NAME);
}

function translateWindowsPathForRuntime(input: string) {
  if (process.platform === "win32") {
    return path.win32.resolve(input);
  }

  if (!isWslEnvironment()) {
    return input;
  }

  const result = spawnSync("wslpath", ["-u", input], {
    encoding: "utf8"
  });
  const output = result.stdout.trim();

  if (result.status === 0 && output) {
    return path.posix.normalize(output);
  }

  return input;
}

function resolveAbsolutePath(input: string) {
  if (isWindowsAbsolutePath(input)) {
    const runtimePath = translateWindowsPathForRuntime(input);

    if (runtimePath !== input) {
      return path.posix.resolve(runtimePath);
    }

    return path.win32.resolve(input);
  }

  return path.posix.resolve(input);
}

export function normalizeWslPath(input: string): string {
  const trimmed = input.trim();

  if (isWindowsAbsolutePath(trimmed)) {
    return path.win32.normalize(trimmed);
  }

  return path.posix.normalize(trimmed);
}

export function validateAbsolutePath(input: string): boolean {
  if (isWindowsAbsolutePath(input)) {
    return path.win32.isAbsolute(input);
  }

  return path.posix.isAbsolute(input);
}

export async function resolvePathInfo(input: string): Promise<PathInfo> {
  const normalizedPath = normalizeWslPath(input);

  if (!validateAbsolutePath(normalizedPath)) {
    throw new AppError(400, "INVALID_PATH", "Path must be absolute");
  }

  const resolvedPath = resolveAbsolutePath(normalizedPath);

  try {
    const stats = await fs.stat(resolvedPath);
    return {
      path: normalizedPath,
      resolvedPath,
      exists: true,
      isDirectory: stats.isDirectory()
    };
  } catch {
    return {
      path: normalizedPath,
      resolvedPath,
      exists: false,
      isDirectory: false
    };
  }
}

import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "./errors";
import type { PathInfo } from "./types";

export function normalizeWslPath(input: string): string {
  return path.posix.normalize(input.trim());
}

export function validateAbsolutePath(input: string): boolean {
  return path.posix.isAbsolute(input);
}

export async function resolvePathInfo(input: string): Promise<PathInfo> {
  const normalizedPath = normalizeWslPath(input);

  if (!validateAbsolutePath(normalizedPath)) {
    throw new AppError(400, "INVALID_PATH", "Path must be absolute");
  }

  const resolvedPath = path.posix.resolve(normalizedPath);

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


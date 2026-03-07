import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { after, test } from "node:test";
import { normalizeWslPath, resolvePathInfo, validateAbsolutePath } from "./shared/path-utils";

const tempRoots: string[] = [];

after(async () => {
  await Promise.all(tempRoots.map((tempRoot) => rm(tempRoot, { recursive: true, force: true })));
});

test("normalizes Windows drive paths and UNC paths", () => {
  assert.equal(normalizeWslPath("C:/Users/example/project"), "C:\\Users\\example\\project");
  assert.equal(normalizeWslPath("\\\\server\\share\\folder\\..\\repo"), "\\\\server\\share\\repo");
});

test("recognizes Windows drive paths and UNC paths as absolute", () => {
  assert.equal(validateAbsolutePath("C:\\Users\\example\\project"), true);
  assert.equal(validateAbsolutePath("\\\\server\\share\\repo"), true);
  assert.equal(validateAbsolutePath("relative\\repo"), false);
});

test("resolves POSIX paths on disk", async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-path-utils-"));
  tempRoots.push(tempRoot);
  const projectPath = path.join(tempRoot, "repo");
  await mkdir(projectPath, { recursive: true });

  const result = await resolvePathInfo(projectPath);

  assert.equal(result.path, projectPath);
  assert.equal(result.exists, true);
  assert.equal(result.isDirectory, true);
});

test("accepts Windows-style absolute paths without rejecting them as invalid", async () => {
  const result = await resolvePathInfo("C:\\Users\\example\\missing-repo");

  assert.equal(result.path, "C:\\Users\\example\\missing-repo");
  assert.equal(result.exists, false);
  assert.equal(result.isDirectory, false);
  assert.ok(result.resolvedPath.length > 0);
});

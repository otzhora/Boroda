import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import { after, before, test } from "node:test";
import { AppError } from "./shared/errors";

let tempRoot = "";
const previousCursorBin = process.env.BORODA_CURSOR_BIN;

before(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), "boroda-open-in-app-"));
});

after(async () => {
  if (previousCursorBin === undefined) {
    delete process.env.BORODA_CURSOR_BIN;
  } else {
    process.env.BORODA_CURSOR_BIN = previousCursorBin;
  }

  await rm(tempRoot, { recursive: true, force: true });
});

test("openInApp returns 501 for an unavailable explicit binary path", async () => {
  process.env.BORODA_CURSOR_BIN = path.join(tempRoot, "missing-cursor");

  const { openInApp } = await import("./modules/integrations/open-in/service");

  await assert.rejects(
    () =>
      openInApp({
        directory: tempRoot,
        target: "cursor"
      }),
    (error: unknown) =>
      error instanceof AppError &&
      error.statusCode === 501 &&
      error.code === "OPEN_TARGET_NOT_AVAILABLE" &&
      error.message === "Cursor is not available on this machine"
  );
});

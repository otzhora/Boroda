import { spawn } from "node:child_process";
import fs from "node:fs";
import { AppError } from "../../../shared/errors";
import { withServerSpan } from "../../../shared/observability";
import { getOpenInProvider } from "./providers";
import type { OpenInAppInput, OpenInTarget } from "./types";

function getTargetLabel(target: OpenInTarget) {
  return getOpenInProvider({ target }).label;
}

function isExplicitBinaryPath(binary: string) {
  return binary.includes("/") || binary.includes("\\");
}

function shouldDetachOpenCommand() {
  return !process.execArgv.includes("--test");
}

export async function openInApp(input: OpenInAppInput) {
  return withServerSpan(
    console,
    "open_in.launch",
    {
      directory: input.directory,
      target: input.target
    },
    async () => {
      const provider = getOpenInProvider({ target: input.target });
      const launcher = provider.getLauncherSpec();

      if (isExplicitBinaryPath(launcher.binary) && !fs.existsSync(launcher.binary)) {
        throw new AppError(501, "OPEN_TARGET_NOT_AVAILABLE", `${getTargetLabel(input.target)} is not available on this machine`);
      }

      let child;

      try {
        const args = launcher.args(input.directory);
        const resolvedCwd = launcher.cwd ? launcher.cwd(input.directory) : launcher.preserveInputCwd ? input.directory : undefined;
        child = spawn(launcher.binary, args, {
          cwd: resolvedCwd,
          detached: shouldDetachOpenCommand(),
          stdio: "ignore"
        });
      } catch (error) {
        if (error instanceof Error && "code" in error && typeof error.code === "string" && error.code === "ENOENT") {
          throw new AppError(501, "OPEN_TARGET_NOT_AVAILABLE", `${getTargetLabel(input.target)} is not available on this machine`);
        }

        throw error;
      }

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
        target: provider.target
      };
    }
  );
}

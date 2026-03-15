import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const scopes = process.argv.slice(2);
const targetDirs = scopes.length > 0 ? scopes : ["apps/web", "packages/server"];
const allowedConsoleLogFiles = new Set([
  "packages/server/src/db/migrate.ts",
  "packages/server/src/db/seed.ts"
]);
const allowedExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirNames = new Set([".git", "coverage", "dist", "node_modules"]);
const findings = [];

for (const scope of targetDirs) {
  walk(scope);
}

if (findings.length > 0) {
  console.error("Quality gate failed:");

  for (const finding of findings) {
    console.error(`- ${finding}`);
  }

  process.exit(1);
}

function walk(relativeDir) {
  const absoluteDir = path.join(rootDir, relativeDir);
  const stat = statSync(absoluteDir, { throwIfNoEntry: false });

  if (!stat?.isDirectory()) {
    findings.push(`${relativeDir}: missing lint scope`);
    return;
  }

  for (const entry of readdirSync(absoluteDir, { withFileTypes: true })) {
    if (ignoredDirNames.has(entry.name)) {
      continue;
    }

    const nextRelativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      walk(nextRelativePath);
      continue;
    }

    if (!allowedExtensions.has(path.extname(entry.name))) {
      continue;
    }

    checkFile(nextRelativePath);
  }
}

function checkFile(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const source = readFileSync(absolutePath, "utf8");
  const lines = source.split("\n");
  const isTestFile = /\b(test|spec)\.[cm]?[jt]sx?$/.test(relativePath);
  const maxLines = isTestFile ? 1600 : 800;

  if (lines.length > maxLines) {
    findings.push(`${relativePath}: file has ${lines.length} lines (limit ${maxLines})`);
  }

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    if (line.includes("@ts-ignore")) {
      findings.push(`${relativePath}:${lineNumber} avoid @ts-ignore`);
    }

    if (line.includes("@ts-nocheck")) {
      findings.push(`${relativePath}:${lineNumber} avoid @ts-nocheck`);
    }

    if (line.includes("eslint-disable")) {
      findings.push(`${relativePath}:${lineNumber} avoid eslint-disable`);
    }

    if (line.includes("@ts-expect-error") && !/@ts-expect-error\s+--\s+\S+/.test(line)) {
      findings.push(`${relativePath}:${lineNumber} @ts-expect-error requires an inline rationale using \"-- reason\"`);
    }

    if (line.includes("console.log(") && !allowedConsoleLogFiles.has(relativePath)) {
      findings.push(`${relativePath}:${lineNumber} avoid console.log outside approved CLI entrypoints`);
    }

    if (line.includes("debugger")) {
      findings.push(`${relativePath}:${lineNumber} remove debugger statements`);
    }
  });
}

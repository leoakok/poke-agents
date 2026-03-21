#!/usr/bin/env node
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const run = join(root, "dist", "mcp", "run.js");

const rawArgs = process.argv.slice(2);
const wantBuild = rawArgs.includes("--build");
const childArgs = rawArgs.filter((a) => a !== "--build");

function runBuild() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const b = spawnSync(npm, ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (b.error) {
    console.error(b.error);
    process.exit(1);
  }
  if (b.status !== 0) {
    process.exit(b.status ?? 1);
  }
}

if (wantBuild) {
  runBuild();
}

if (!existsSync(run)) {
  console.error(
    "poke-agents-mcp: missing dist/. Run `npm run build` in agents/, or pass `--build` once."
  );
  process.exit(1);
}

const r = spawnSync(process.execPath, [run, ...childArgs], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);

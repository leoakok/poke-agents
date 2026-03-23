#!/usr/bin/env node
/**
 * Compatibility launcher for users who still run:
 *   npx @leokok/poke-agents
 *
 * Delegates to the canonical package:
 *   npm exec --yes poke-agents@latest
 */
import { spawnSync } from "node:child_process";

const rawArgs = process.argv.slice(2);

console.error(
  "[poke-agents] `@leokok/poke-agents` is now a compatibility shim. Redirecting to `npx poke-agents@latest`...\n[poke-agents] Tip: you can run `npx poke-agents` directly next time.",
);

// `npm exec` is more reliable than recursively spawning `npx`,
// especially on Windows/PowerShell where `spawnSync npx.cmd` can throw EINVAL.
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const r = spawnSync(
  npmCmd,
  ["exec", "--yes", "poke-agents@latest", "--", ...rawArgs],
  {
    stdio: "inherit",
    env: process.env,
  },
);

if (r.error) {
  console.error(
    `[poke-agents] Failed to run delegated launcher: ${r.error.message}`,
  );
  process.exit(1);
}

process.exit(r.status ?? 1);

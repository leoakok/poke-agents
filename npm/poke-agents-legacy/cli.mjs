#!/usr/bin/env node
/**
 * Compatibility launcher for users who still run:
 *   npx @leokok/poke-agents
 *
 * Delegates to the canonical package:
 *   npx poke-agents@latest
 */
import { spawnSync } from "node:child_process";

const rawArgs = process.argv.slice(2);

console.error(
  "[poke-agents] `@leokok/poke-agents` is now a compatibility shim. Redirecting to `npx poke-agents@latest`...",
);

const npmCmd = process.platform === "win32" ? "npx.cmd" : "npx";
const r = spawnSync(
  npmCmd,
  ["-y", "poke-agents@latest", ...rawArgs],
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

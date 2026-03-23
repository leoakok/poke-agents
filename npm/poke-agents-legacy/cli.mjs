#!/usr/bin/env node
/**
 * Compatibility launcher for users who still run:
 *   npx @leokok/poke-agents
 *
 * Delegates to the canonical package:
 *   npm exec --yes poke-agents@latest
 */
import { spawnSync } from "node:child_process";
import https from "node:https";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rawArgs = process.argv.slice(2);
const __dirname = dirname(fileURLToPath(import.meta.url));

function checkForUpdates() {
  const req = https.get(
    "https://registry.npmjs.org/poke-agents/latest",
    { timeout: 3000 },
    (res) => {
      let data = "";
      res.on("data", (d) => {
        data += d;
      });
      res.on("end", () => {
        try {
          const latest = JSON.parse(data).version;
          if (latest) {
            console.error(`Poke 🌴 guide: https://github.com/leoakok/poke-agents`);
            console.error(`Use latest: npx poke-agents@${latest}`);
            console.error("");
          }
        } catch {}
      });
    },
  );
  req.on("error", () => {});
  req.on("timeout", () => req.destroy());
}

if (rawArgs.includes("--help") || rawArgs.includes("-h")) {
  console.error(`Poke 🌴 / Agents (legacy shim)

Usage:
  npx @leokok/poke-agents [...args]

Options:
  -h, --help      show help
  -v, --version   show shim version

Guide:
  https://github.com/leoakok/poke-agents
`);
  process.exit(0);
}

if (rawArgs.includes("--version") || rawArgs.includes("-v")) {
  const v = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf8")).version;
  console.error(v);
  process.exit(0);
}

console.error(
  "Poke 🌴: `@leokok/poke-agents` is a compatibility shim.\nRedirecting to `npx poke-agents@latest`...",
);
console.error("Quick start: use `npx poke-agents@latest` directly next time.\n");
checkForUpdates();

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

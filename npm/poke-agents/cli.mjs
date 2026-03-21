#!/usr/bin/env node
/**
 * @leokok/poke-agents — clone / update repo, npm install + build, then MCP + Next + tunnel.
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import readline from "node:readline/promises";
import { stdin as input, stderr as output } from "node:process";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATA_SUBDIR = "poke-agents";
const autoYes =
  process.argv.includes("-y") ||
  process.argv.includes("--yes") ||
  process.env.POKE_AGENTS_YES === "1";

const color =
  process.stdout.isTTY && !process.env.NO_COLOR
    ? {
        dim: (s) => `\x1b[2m${s}\x1b[0m`,
        bold: (s) => `\x1b[1m${s}\x1b[0m`,
        green: (s) => `\x1b[32m${s}\x1b[0m`,
        cyan: (s) => `\x1b[36m${s}\x1b[0m`,
        red: (s) => `\x1b[31m${s}\x1b[0m`,
      }
    : {
        dim: (s) => s,
        bold: (s) => s,
        green: (s) => s,
        cyan: (s) => s,
        red: (s) => s,
      };

function line(msg = "") {
  console.error(msg);
}

function pkgVersion() {
  try {
    return JSON.parse(
      readFileSync(join(__dirname, "package.json"), "utf8"),
    ).version;
  } catch {
    return "0.0.0";
  }
}

function gitRemoteUrl() {
  return (
    process.env.POKE_AGENTS_REPO?.trim() ||
    "https://github.com/leoakok/poke-agents.git"
  );
}

function githubRepoUrl() {
  let u = gitRemoteUrl().replace(/\.git$/, "");
  if (u.startsWith("git@github.com:")) {
    u = `https://github.com/${u.slice("git@github.com:".length)}`;
  }
  return u.replace(/^ssh:\/\/git@github.com\//, "https://github.com/");
}

function printBanner() {
  line(color.dim("  ─────────────────────────────────────────"));
  line(`  ${color.bold("@leokok/poke-agents")}  ${color.dim(`v${pkgVersion()}`)}`);
  line(color.dim("  ─────────────────────────────────────────"));
  line("");
}

function printStarCta() {
  line(color.dim("  ─────────────────────────────────────────"));
  line(`  ${color.cyan("Repo:")} ${color.green(githubRepoUrl())}`);
  line(color.dim("  ─────────────────────────────────────────"));
  line("");
}

function dataDir() {
  const base =
    process.env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  const dir = join(base, DATA_SUBDIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function markerPath(repoDir) {
  return join(repoDir, "scripts", "poke-run.mjs");
}

function gitHead(repoDir) {
  const r = spawnSync("git", ["-C", repoDir, "rev-parse", "HEAD"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return r.status === 0 ? r.stdout.trim() : "";
}

function resolveSyncBranch(repoDir) {
  const sym = spawnSync(
    "git",
    ["-C", repoDir, "symbolic-ref", "-q", "refs/remotes/origin/HEAD"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  if (sym.status === 0) {
    const m = /refs\/remotes\/origin\/(.+)/.exec(sym.stdout.trim());
    if (m) return m[1];
  }
  const remote = spawnSync(
    "git",
    ["-C", repoDir, "ls-remote", "--symref", "origin", "HEAD"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
  const rm = /ref: refs\/heads\/(\S+)/.exec(remote.stdout || "");
  return rm ? rm[1] : "main";
}

function pullCachedRepo(repoDir, repoUrl) {
  spawnSync("git", ["-C", repoDir, "remote", "set-url", "origin", repoUrl], {
    stdio: "pipe",
  });
  const before = gitHead(repoDir);
  let r = spawnSync("git", ["-C", repoDir, "pull", "--ff-only", "-q"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    const branch = resolveSyncBranch(repoDir);
    const f = spawnSync(
      "git",
      ["-C", repoDir, "fetch", "--depth", "1", "origin", branch],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (f.status !== 0) {
      return { ok: false, stderr: (f.stderr || r.stderr || "").trim() };
    }
    r = spawnSync(
      "git",
      ["-C", repoDir, "merge", "--ff-only", "-q", "FETCH_HEAD"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  }
  if (r.status !== 0) {
    return { ok: false, stderr: (r.stderr || "").trim() };
  }
  const after = gitHead(repoDir);
  const updated = Boolean(before && after && before !== after);
  return { ok: true, updated };
}

function ensureGitRepo(repoDir, repoUrl) {
  const marker = markerPath(repoDir);
  if (existsSync(join(repoDir, ".git"))) {
    const pulled = pullCachedRepo(repoDir, repoUrl);
    if (!pulled.ok) {
      return {
        ok: false,
        code: "pull_fail",
        message:
          "Could not fast-forward the cached repo (network, divergent history, or permissions).",
        stderr: pulled.stderr,
        cacheParent: dirname(repoDir),
      };
    }
    if (pulled.updated) {
      line(color.dim("  Updated cached poke-agents from git."));
    }
    if (!existsSync(marker)) {
      return {
        ok: false,
        code: "bad_cache",
        message:
          "Cached repo is missing scripts/poke-run.mjs (wrong or outdated cache).",
        cacheParent: dirname(repoDir),
      };
    }
    return { ok: true };
  }

  line(color.dim("  Cloning poke-agents (first run, shallow clone)…"));
  mkdirSync(dirname(repoDir), { recursive: true });
  const r = spawnSync("git", ["clone", "--depth", "1", repoUrl, repoDir], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (r.status !== 0) {
    return {
      ok: false,
      code: "clone_fail",
      stderr: r.stderr,
      cacheParent: dirname(repoDir),
    };
  }
  if (!existsSync(marker)) {
    return {
      ok: false,
      code: "no_marker",
      message: "Clone missing scripts/poke-run.mjs — check POKE_AGENTS_REPO.",
      cacheParent: dirname(repoDir),
    };
  }
  line(color.dim("  …cloned."));
  line("");
  return { ok: true };
}

async function yesNo(question, defaultYes) {
  if (autoYes) return defaultYes;
  if (!input.isTTY) return false;
  const rl = readline.createInterface({ input, output });
  try {
    const hint = defaultYes ? "Y/n" : "y/N";
    const ans = await rl.question(`${question} (${hint}) `);
    const t = ans.trim().toLowerCase();
    if (!t) return defaultYes;
    return t === "y" || t === "yes";
  } finally {
    rl.close();
  }
}

async function ensureGitRepoInteractive(repoDir, repoUrl) {
  for (;;) {
    const res = ensureGitRepo(repoDir, repoUrl);
    if (res.ok) return true;
    if (res.code === "bad_cache" || res.code === "no_marker") {
      line(color.red(`  ${res.message || "Repository layout looks wrong."}`));
    } else if (res.code === "pull_fail") {
      line(color.red(`  ${res.message || "Git update failed."}`));
      if (res.stderr?.trim()) line(color.dim(res.stderr.trim()));
    } else {
      line(color.red("  Could not clone the repository."));
      if (res.stderr?.trim()) line(color.dim(res.stderr.trim()));
    }
    line("");
    const wipe = await yesNo(
      `Delete cache at ${res.cacheParent} and try again?`,
      true,
    );
    if (!wipe) {
      printStarCta();
      return false;
    }
    try {
      rmSync(res.cacheParent, { recursive: true, force: true });
    } catch (e) {
      line(color.red(`  Could not remove: ${e.message}`));
      printStarCta();
      return false;
    }
    line(color.dim("  Cache cleared. Retrying…"));
    line("");
  }
}

function requireNode20() {
  const m = /^v(\d+)/.exec(process.version);
  const major = m ? Number(m[1]) : 0;
  if (major < 20) {
    line(color.red(`  Need Node.js >= 20 (you have ${process.version}).`));
    printStarCta();
    process.exit(1);
  }
}

function requireGit() {
  const r = spawnSync("git", ["--version"], { stdio: "pipe", encoding: "utf8" });
  if (r.status !== 0) {
    line(color.red("  git is required but was not found on PATH."));
    printStarCta();
    process.exit(1);
  }
}

async function main() {
  printBanner();
  requireNode20();
  requireGit();

  const root = dataDir();
  const repoDir = join(root, "repo");
  const repoUrl = gitRemoteUrl();

  const ok = await ensureGitRepoInteractive(repoDir, repoUrl);
  if (!ok) process.exit(1);

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";

  line(color.dim("  npm install…"));
  const ins = spawnSync(npm, ["install"], {
    cwd: repoDir,
    stdio: "inherit",
    env: process.env,
  });
  if (ins.status !== 0) {
    line(color.red("  npm install failed."));
    printStarCta();
    process.exit(ins.status ?? 1);
  }

  line(color.dim("  npm run build…"));
  const bd = spawnSync(npm, ["run", "build"], {
    cwd: repoDir,
    stdio: "inherit",
    env: process.env,
  });
  if (bd.status !== 0) {
    line(color.red("  npm run build failed (native modules like better-sqlite3 need a compiler)."));
    printStarCta();
    process.exit(bd.status ?? 1);
  }

  line("");
  line(color.green("  Starting MCP + dashboard + tunnel…"));
  line("");

  const run = spawn(npm, ["run", "start:poke"], {
    cwd: repoDir,
    stdio: "inherit",
    env: process.env,
  });
  run.on("error", (err) => {
    line(color.red(`  Could not start: ${err.message}`));
    printStarCta();
    process.exit(1);
  });
  run.on("exit", (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

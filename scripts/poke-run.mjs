#!/usr/bin/env node
/**
 * Starts MCP HTTP + Next dashboard + Poke tunnel (same idea as poke-apple-music).
 * Picks free ports from configured preferences when the defaults are busy.
 */
import { spawn } from "node:child_process";
import { createConnection, createServer } from "node:net";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root (`agents/`), i.e. parent of `scripts/`. */
const root = fileURLToPath(new URL("..", import.meta.url));
const runJs = join(root, "dist", "mcp", "run.js");
const webDir = join(root, "web");

const skipWeb = process.env.POKE_AGENTS_SKIP_WEB === "1";
const skipTunnel = process.env.POKE_AGENTS_SKIP_TUNNEL === "1";

/** Human-readable label for Poke when using `poke tunnel … -n` (default: "Poke agents"). */
const pokeTunnelDisplayName =
  process.env.POKE_AGENTS_TUNNEL_NAME?.trim() || "Poke agents";
const strictPorts = process.env.POKE_AGENTS_STRICT_PORTS === "1";

const tty = process.stderr.isTTY && !process.env.NO_COLOR;
const c = tty
  ? {
      dim: (s) => `\x1b[2m${s}\x1b[0m`,
      bold: (s) => `\x1b[1m${s}\x1b[0m`,
      green: (s) => `\x1b[32m${s}\x1b[0m`,
      cyan: (s) => `\x1b[36m${s}\x1b[0m`,
      red: (s) => `\x1b[31m${s}\x1b[0m`,
      yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    }
  : {
      dim: (s) => s,
      bold: (s) => s,
      green: (s) => s,
      cyan: (s) => s,
      red: (s) => s,
      yellow: (s) => s,
    };

const bullet = tty ? "›" : ">";

function line(msg = "") {
  console.error(msg);
}

function step(msg) {
  line(`  ${c.dim(bullet)} ${msg}`);
}

function errLine(msg) {
  line(`  ${c.red(bullet)} ${msg}`);
}

function warnLine(msg) {
  line(`  ${c.yellow(bullet)} ${msg}`);
}

function labelPad(label, width) {
  return label.length >= width ? label : label + " ".repeat(width - label.length);
}

function printServiceBlock(mcpUrl, webPort, mcpHost, skipWeb_, skipTunnel_) {
  const w = 12;
  line("");
  line(`  ${c.bold("Services")}`);
  line(`  ${c.dim(labelPad("MCP", w))}  ${c.cyan(mcpUrl)}`);
  if (!skipTunnel_) {
    line(
      `  ${c.dim(labelPad("Poke name", w))}  ${c.dim(pokeTunnelDisplayName)}`,
    );
  }
  if (!skipWeb_) {
    line(
      `  ${c.dim(labelPad("Dashboard", w))}  ${c.cyan(`http://${mcpHost}:${webPort}`)}`,
    );
    line("");
    line(
      `  ${c.dim("The UI proxies /api to the MCP server; ports may differ each run if defaults are busy.")}`,
    );
  }
  line("");
}

function preferredMcpPort() {
  const n = Number(
    process.env.POKE_AGENTS_MCP_PORT || process.env.POKE_AGENTS_PORT,
  );
  return Number.isFinite(n) && n > 0 ? n : 8740;
}

function preferredWebPort() {
  const n = Number(process.env.POKE_AGENTS_WEB_PORT);
  return Number.isFinite(n) && n > 0 ? n : 3000;
}

/** Returns true if we could bind and release `port` on `host`. */
function tryBindPort(host, port) {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, host, () => {
      srv.close(() => resolve(true));
    });
  });
}

async function findFreePort(host, startPort, maxAttempts) {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (await tryBindPort(host, port)) {
      return port;
    }
  }
  throw new Error(
    `No free TCP port on ${host} from ${startPort} (tried ${maxAttempts}).`,
  );
}

async function allocatePort(host, preferred, label) {
  if (strictPorts) {
    const ok = await tryBindPort(host, preferred);
    if (!ok) {
      throw new Error(
        `${label}: port ${preferred} is in use (POKE_AGENTS_STRICT_PORTS=1).`,
      );
    }
    return preferred;
  }
  return findFreePort(host, preferred, 80);
}

/**
 * Opens the OS default browser. Skipped when `POKE_AGENTS_NO_OPEN=1` (SSH, CI).
 */
function openDefaultBrowser(url) {
  if (process.env.POKE_AGENTS_NO_OPEN === "1") return;
  const detached = { detached: true, stdio: "ignore" };
  try {
    let child;
    if (process.platform === "darwin") {
      child = spawn("open", [url], detached);
    } else if (process.platform === "win32") {
      child = spawn("cmd", ["/c", "start", "", url], {
        ...detached,
        windowsHide: true,
      });
    } else {
      child = spawn("xdg-open", [url], detached);
    }
    child.unref();
  } catch {
    // headless Linux or missing xdg-open — URL is still printed below
  }
}

function waitForPort(port, host, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    function attempt() {
      const socket = createConnection({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) {
          reject(
            new Error(
              `Timed out waiting for ${host}:${port} (firewall or startup error).`,
            ),
          );
          return;
        }
        setTimeout(attempt, 150);
      });
    }
    attempt();
  });
}

if (!existsSync(runJs)) {
  errLine("Missing dist/ — run npm run build from the repo root.");
  process.exit(1);
}
if (!skipWeb && !existsSync(join(webDir, "package.json"))) {
  errLine("Missing web/ application.");
  process.exit(1);
}

/** Avoid `npm run start`: on Ctrl+C npm prints a scary lifecycle error (code 130 = SIGINT). */
function resolveNextCli() {
  const candidates = [
    join(webDir, "node_modules", "next", "dist", "bin", "next"),
    join(root, "node_modules", "next", "dist", "bin", "next"),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

const children = [];
let shuttingDown = false;

function killAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c_ of children) {
    if (!c_.killed) {
      c_.kill("SIGTERM");
    }
  }
}

async function main() {
  const mcpHost = "127.0.0.1";
  const mcpWant = preferredMcpPort();
  const webWant = preferredWebPort();

  const mcpPort = await allocatePort(mcpHost, mcpWant, "MCP");
  const webPort = skipWeb
    ? null
    : await allocatePort(mcpHost, webWant, "Dashboard");

  if (mcpPort !== mcpWant) {
    warnLine(
      `MCP port ${mcpWant} busy — using ${mcpPort}. ${c.dim("Set POKE_AGENTS_STRICT_PORTS=1 to fail instead.")}`,
    );
  }
  if (!skipWeb && webPort !== webWant) {
    warnLine(
      `Dashboard port ${webWant} busy — using ${webPort}. ${c.dim("Set POKE_AGENTS_STRICT_PORTS=1 to fail instead.")}`,
    );
  }

  const mcpOrigin = `http://${mcpHost}:${mcpPort}`;
  const mcpUrl = `${mcpOrigin}/mcp`;
  printServiceBlock(mcpUrl, webPort, mcpHost, skipWeb, skipTunnel);

  const mcp = spawn(
    process.execPath,
    [runJs, "--http", String(mcpPort)],
    {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        POKE_AGENTS_PORT: String(mcpPort),
      },
    },
  );
  children.push(mcp);

  mcp.on("error", (err) => {
    errLine(`MCP process: ${err.message}`);
    process.exit(1);
  });
  mcp.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      errLine(`MCP stopped (${signal}).`);
      process.exit(1);
    }
    if (code !== 0 && code !== null) {
      errLine("MCP exited with an error.");
      process.exit(code ?? 1);
    }
  });

  await waitForPort(mcpPort, mcpHost, 45_000);

  if (!skipWeb) {
    const nextCli = resolveNextCli();
    const webEnv = {
      ...process.env,
      PORT: String(webPort),
      /** Server-only: Next route handlers proxy /api/* here (dynamic per run). */
      POKE_AGENTS_MCP_ORIGIN: mcpOrigin,
    };
    const web = nextCli
      ? spawn(
          process.execPath,
          [nextCli, "start", "-H", mcpHost, "-p", String(webPort)],
          {
            cwd: webDir,
            stdio: "inherit",
            env: webEnv,
          },
        )
      : spawn(
          process.platform === "win32" ? "npm.cmd" : "npm",
          ["run", "start", "--", "-H", mcpHost, "-p", String(webPort)],
          {
            cwd: webDir,
            stdio: "inherit",
            env: webEnv,
          },
        );
    if (!nextCli) {
      warnLine(
        "Next CLI not found next to web/ — using npm run start (install deps from repo root if needed).",
      );
    }
    children.push(web);
    web.on("error", (err) => {
      errLine(`Dashboard: ${err.message}`);
      killAll();
      process.exit(1);
    });
    web.on("exit", (code) => {
      if (shuttingDown) return;
      errLine("Dashboard exited.");
      killAll();
      process.exit(code ?? 0);
    });
    try {
      await waitForPort(webPort, mcpHost, 60_000);
    } catch (e) {
      errLine(e instanceof Error ? e.message : String(e));
      killAll();
      process.exit(1);
    }
    const dashboardUrl = `http://${mcpHost}:${webPort}/`;
    openDefaultBrowser(dashboardUrl);
    if (process.env.POKE_AGENTS_NO_OPEN === "1") {
      step(c.dim(`Dashboard ready — ${dashboardUrl} (browser open skipped)`));
    } else {
      step(c.green(`Opening dashboard — ${dashboardUrl}`));
    }
  }

  if (!skipTunnel) {
    step(c.dim("Starting Poke tunnel — leave this terminal open."));
    line("");
    const tunnel = spawn(
      "npx",
      [
        "--yes",
        "poke@latest",
        "tunnel",
        mcpUrl,
        "-n",
        pokeTunnelDisplayName,
      ],
      { stdio: "inherit", env: process.env },
    );
    children.push(tunnel);
    tunnel.on("error", (err) => {
      errLine(`Tunnel: ${err.message}`);
      if (err.code === "ENOENT") {
        line(c.dim("    Ensure Node is installed and npx is available."));
      }
      killAll();
      process.exit(1);
    });
    tunnel.on("exit", (code) => {
      killAll();
      process.exit(code ?? 0);
    });
  } else {
    step(c.dim("POKE_AGENTS_SKIP_TUNNEL=1 — tunnel not started."));
    step(
      c.dim(
        `Press Ctrl+C to stop${skipWeb ? "." : " MCP and dashboard."}`,
      ),
    );
    line("");
  }

  process.on("SIGINT", () => {
    killAll();
  });
  process.on("SIGTERM", () => {
    killAll();
  });
}

main().catch((e) => {
  errLine(e instanceof Error ? e.message : String(e));
  killAll();
  process.exit(1);
});

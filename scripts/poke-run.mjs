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
const strictPorts = process.env.POKE_AGENTS_STRICT_PORTS === "1";

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

function line(msg) {
  console.error(msg);
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
              `Timed out waiting for ${host}:${port}. Check firewall or logs.`,
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
  line("poke-agents: missing dist/. Run `npm run build` in the repo root.");
  process.exit(1);
}
if (!skipWeb && !existsSync(join(webDir, "package.json"))) {
  line("poke-agents: missing web/ app.");
  process.exit(1);
}

const children = [];
let shuttingDown = false;

function killAll() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (!c.killed) {
      c.kill("SIGTERM");
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
    line(
      `poke-agents: MCP port ${mcpWant} in use — using ${mcpPort} (set POKE_AGENTS_STRICT_PORTS=1 to forbid).`,
    );
  }
  if (!skipWeb && webPort !== webWant) {
    line(
      `poke-agents: dashboard port ${webWant} in use — using ${webPort} (set POKE_AGENTS_STRICT_PORTS=1 to forbid).`,
    );
  }

  const mcpOrigin = `http://${mcpHost}:${mcpPort}`;
  const mcpUrl = `${mcpOrigin}/mcp`;
  line("");
  line(`  MCP + API  ${mcpUrl}`);
  if (!skipWeb) {
    line(`  Dashboard  http://${mcpHost}:${webPort}`);
    line(
      `  (UI uses same-origin /api/* → proxied to ${mcpOrigin} — ports can change per run.)`,
    );
  }
  line("");

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
    line(`poke-agents: MCP process error: ${err.message}`);
    process.exit(1);
  });
  mcp.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) {
      line(`poke-agents: MCP stopped (${signal}).`);
      process.exit(1);
    }
    if (code !== 0 && code !== null) {
      line("poke-agents: MCP exited with an error.");
      process.exit(code ?? 1);
    }
  });

  await waitForPort(mcpPort, mcpHost, 45_000);

  if (!skipWeb) {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const web = spawn(
      npm,
      ["run", "start", "--", "-H", mcpHost, "-p", String(webPort)],
      {
        cwd: webDir,
        stdio: "inherit",
        env: {
          ...process.env,
          PORT: String(webPort),
          /** Server-only: Next route handlers proxy /api/* here (dynamic per run). */
          POKE_AGENTS_MCP_ORIGIN: mcpOrigin,
        },
      },
    );
    children.push(web);
    web.on("error", (err) => {
      line(`poke-agents: Next.js error: ${err.message}`);
      killAll();
      process.exit(1);
    });
    web.on("exit", (code) => {
      if (shuttingDown) return;
      line("poke-agents: Next.js exited.");
      killAll();
      process.exit(code ?? 0);
    });
    try {
      await waitForPort(webPort, mcpHost, 60_000);
    } catch (e) {
      line(`poke-agents: ${e instanceof Error ? e.message : String(e)}`);
      killAll();
      process.exit(1);
    }
  }

  if (!skipTunnel) {
    line("  Starting Poke tunnel (leave this terminal open)…");
    line("");
    const tunnel = spawn(
      "npx",
      ["--yes", "poke@latest", "tunnel", mcpUrl, "-n", "Poke agents"],
      { stdio: "inherit", env: process.env },
    );
    children.push(tunnel);
    tunnel.on("error", (err) => {
      line(`poke-agents: tunnel failed: ${err.message}`);
      if (err.code === "ENOENT") {
        line("  Install Node from https://nodejs.org/ and ensure npx works.");
      }
      killAll();
      process.exit(1);
    });
    tunnel.on("exit", (code) => {
      killAll();
      process.exit(code ?? 0);
    });
  } else {
    line("  POKE_AGENTS_SKIP_TUNNEL=1 — not starting poke tunnel.");
    line(
      "  Press Ctrl+C to stop the MCP" + (skipWeb ? "." : " and dashboard."),
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
  line(`poke-agents: ${e instanceof Error ? e.message : String(e)}`);
  killAll();
  process.exit(1);
});

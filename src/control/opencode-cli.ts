import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { SpawnResult } from "./types.js";
import { stripAnsi } from "./strip-ansi.js";

function agentTimeoutMs(): number {
  const raw = process.env.POKE_AGENTS_AGENT_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 600_000;
}

export function opencodeBin(): string {
  return process.env.POKE_AGENTS_OPENCODE_BIN?.trim() || "opencode";
}

function opencodeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };
}

/** Sync check that the OpenCode binary exists / can be spawned (e.g. ENOENT). Does not require a successful `--version`. */
export function opencodeSpawnCheck(cwd: string): { ok: true } | { ok: false; error: string } {
  const bin = opencodeBin();
  const r = spawnSync(bin, ["--version"], {
    cwd,
    encoding: "utf8",
    timeout: 15_000,
    env: opencodeEnv(),
  });
  if (r.error) {
    return { ok: false, error: r.error.message };
  }
  return { ok: true };
}

export async function spawnOpenCode(
  args: string[],
  options: { cwd: string; timeoutMs?: number },
): Promise<SpawnResult> {
  const bin = opencodeBin();
  const timeoutMs = options.timeoutMs ?? agentTimeoutMs();
  return new Promise((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (r: SpawnResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };
    const child = spawn(bin, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: opencodeEnv(),
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (c) => {
      stdout += c;
    });
    child.stderr?.on("data", (c) => {
      stderr += c;
    });
    timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000).unref();
    }, timeoutMs);
    child.on("error", (err) => {
      finish({
        code: 1,
        signal: null,
        stdout,
        stderr: `${stderr}\n${err instanceof Error ? err.message : String(err)}`,
        timedOut,
      });
    });
    child.on("close", (code, signal) => {
      finish({ code, signal, stdout, stderr, timedOut });
    });
  });
}

export async function openCodeVersionLine(cwd: string): Promise<string> {
  const r = await spawnOpenCode(["--version"], { cwd, timeoutMs: 30_000 });
  return stripAnsi((r.stdout + r.stderr).trim());
}

export async function openCodeAuthListText(cwd: string): Promise<string> {
  const r = await spawnOpenCode(["auth", "list"], { cwd, timeoutMs: 60_000 });
  return stripAnsi(r.stdout + (r.stderr ? `\n${r.stderr}` : ""));
}

export type OpenCodeRunParams = {
  cwd: string;
  prompt: string;
  /** OpenCode session id (`ses_…`), maps to `--session`. */
  sessionId?: string;
  continueSession?: boolean;
  /** `text` → default formatting; `json` / `stream-json` → `--format json` (NDJSON events). */
  outputFormat: "text" | "json" | "stream-json";
  model?: string;
  timeoutMs?: number;
};

function buildOpenCodeRunArgs(p: OpenCodeRunParams): string[] {
  const args: string[] = ["run"];
  if (p.outputFormat === "json" || p.outputFormat === "stream-json") {
    args.push("--format", "json");
  }
  if (p.sessionId) {
    args.push("--session", p.sessionId);
  }
  if (p.continueSession && !p.sessionId) {
    args.push("--continue");
  }
  if (p.model?.trim()) {
    args.push("--model", p.model.trim());
  }
  args.push(p.prompt);
  return args;
}

/** Spawn `opencode run` without waiting; caller owns streams and close events. */
export function startOpenCodeRunDetached(p: OpenCodeRunParams): {
  child: ChildProcess;
  clearRunTimeout: () => void;
  getTimedOut: () => boolean;
} {
  const bin = opencodeBin();
  const args = buildOpenCodeRunArgs(p);
  const timeoutMs = p.timeoutMs ?? agentTimeoutMs();
  const child = spawn(bin, args, {
    cwd: p.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: opencodeEnv(),
  });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 5000).unref();
  }, timeoutMs);
  return {
    child,
    clearRunTimeout: () => {
      clearTimeout(timer);
    },
    getTimedOut: () => timedOut,
  };
}

/** Last `sessionID` seen in NDJSON lines (OpenCode `run --format json`). */
export function extractLastOpenCodeSessionId(stdout: string): string | undefined {
  let last: string | undefined;
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as { sessionID?: string };
      if (typeof o.sessionID === "string" && o.sessionID.length > 0) {
        last = o.sessionID;
      }
    } catch {
      /* skip non-JSON lines */
    }
  }
  return last;
}

/** Count JSON object lines (for callback metadata). */
export function countOpenCodeJsonLines(stdout: string): number {
  let n = 0;
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      JSON.parse(t);
      n += 1;
    } catch {
      /* skip */
    }
  }
  return n;
}

export function resolveOpenCodeRunCwd(cwd: string, workspace?: string): string {
  const w = workspace?.trim();
  if (!w) return cwd;
  return path.resolve(cwd, w);
}

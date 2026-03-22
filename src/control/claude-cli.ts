import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { SpawnResult } from "./types.js";
import { stripAnsi } from "./strip-ansi.js";

function agentTimeoutMs(): number {
  const raw = process.env.POKE_AGENTS_AGENT_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 600_000;
}

export function claudeBin(): string {
  return process.env.POKE_AGENTS_CLAUDE_BIN?.trim() || "claude";
}

function claudeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };
}

/** Default on: `--bare` for faster scripted headless runs (see Anthropic headless docs). Set `POKE_AGENTS_CLAUDE_BARE=0` to omit. */
function claudeHeadlessUsesBare(): boolean {
  const v = process.env.POKE_AGENTS_CLAUDE_BARE?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

/** Sync check that the Claude Code CLI exists / can be spawned (e.g. ENOENT). */
export function claudeSpawnCheck(cwd: string): { ok: true } | { ok: false; error: string } {
  const bin = claudeBin();
  const r = spawnSync(bin, ["--version"], {
    cwd,
    encoding: "utf8",
    timeout: 20_000,
    env: claudeEnv(),
  });
  if (r.error) {
    return { ok: false, error: r.error.message };
  }
  return { ok: true };
}

export async function spawnClaude(
  args: string[],
  options: { cwd: string; timeoutMs?: number },
): Promise<SpawnResult> {
  const bin = claudeBin();
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
      env: claudeEnv(),
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

export async function claudeVersionLine(cwd: string): Promise<string> {
  const r = await spawnClaude(["--version"], { cwd, timeoutMs: 30_000 });
  return stripAnsi((r.stdout + r.stderr).trim());
}

/** `claude auth status` — JSON by default per CLI reference. */
export async function claudeAuthStatusText(cwd: string): Promise<string> {
  const r = await spawnClaude(["auth", "status"], { cwd, timeoutMs: 60_000 });
  return stripAnsi(r.stdout + (r.stderr ? `\n${r.stderr}` : ""));
}

export type ClaudeRunParams = {
  cwd: string;
  prompt: string;
  /** Session id or name for `--resume` (Claude Code). */
  sessionId?: string;
  /** Maps to `claude -c` (continue latest in cwd) when no sessionId. */
  continueSession?: boolean;
  outputFormat: "text" | "json" | "stream-json";
  model?: string;
  /** Maps to `--dangerously-skip-permissions` (use only in trusted environments). */
  force?: boolean;
  /** Optional extra working directory (resolved vs cwd). */
  workspace?: string;
  timeoutMs?: number;
};

function buildClaudePrintArgs(p: ClaudeRunParams): string[] {
  const args: string[] = [];
  if (claudeHeadlessUsesBare()) {
    args.push("--bare");
  }
  const ws = p.workspace?.trim();
  if (ws) {
    args.push("--add-dir", path.resolve(p.cwd, ws));
  }
  if (p.sessionId?.trim()) {
    args.push("--resume", p.sessionId.trim());
  } else if (p.continueSession) {
    args.push("--continue");
  }
  if (p.model?.trim()) {
    args.push("--model", p.model.trim());
  }
  if (p.force) {
    args.push("--dangerously-skip-permissions");
  }
  if (p.outputFormat === "json") {
    args.push("--output-format", "json");
  } else if (p.outputFormat === "stream-json") {
    args.push(
      "--output-format",
      "stream-json",
      "--include-partial-messages",
    );
  }
  args.push("-p", p.prompt);
  return args;
}

/** Spawn `claude -p …` without waiting; caller owns stdout/stderr and close events. */
export function startClaudePrintDetached(p: ClaudeRunParams): {
  child: ChildProcess;
  clearRunTimeout: () => void;
  getTimedOut: () => boolean;
} {
  const bin = claudeBin();
  const args = buildClaudePrintArgs(p);
  const timeoutMs = p.timeoutMs ?? agentTimeoutMs();
  const child = spawn(bin, args, {
    cwd: p.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: claudeEnv(),
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Best-effort session id from `--output-format json` / stream-json lines. */
export function extractLastClaudeSessionId(stdout: string): string | undefined {
  let last: string | undefined;
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as Record<string, unknown>;
      const candidates = [
        o.session_id,
        o.sessionId,
        o.sessionID,
        (o as { session?: { id?: string } }).session?.id,
      ];
      for (const c of candidates) {
        if (typeof c === "string" && UUID_RE.test(c)) {
          last = c.toLowerCase();
        }
      }
    } catch {
      /* skip */
    }
  }
  return last;
}

export function countClaudeJsonLines(stdout: string): number {
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

export function resolveClaudeRunCwd(cwd: string, workspace?: string): string {
  const w = workspace?.trim();
  if (!w) return cwd;
  return path.resolve(cwd, w);
}

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import type { SpawnResult } from "./types.js";
import { stripAnsi } from "./strip-ansi.js";

function agentTimeoutMs(): number {
  const raw = process.env.POKE_AGENTS_AGENT_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 600_000;
}

export function codexBin(): string {
  return process.env.POKE_AGENTS_CODEX_BIN?.trim() || "codex";
}

function codexEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };
}

/** Sync check that the Codex binary exists / can be spawned (e.g. ENOENT). */
export function codexSpawnCheck(cwd: string): { ok: true } | { ok: false; error: string } {
  const bin = codexBin();
  const r = spawnSync(bin, ["--version"], {
    cwd,
    encoding: "utf8",
    timeout: 15_000,
    env: codexEnv(),
  });
  if (r.error) {
    return { ok: false, error: r.error.message };
  }
  return { ok: true };
}

export async function spawnCodex(
  args: string[],
  options: { cwd: string; timeoutMs?: number },
): Promise<SpawnResult> {
  const bin = codexBin();
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
      env: codexEnv(),
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

export async function codexVersionLine(cwd: string): Promise<string> {
  const r = await spawnCodex(["--version"], { cwd, timeoutMs: 30_000 });
  return stripAnsi((r.stdout + r.stderr).trim());
}

export async function codexLoginStatusText(cwd: string): Promise<string> {
  const r = await spawnCodex(["login", "status"], { cwd, timeoutMs: 60_000 });
  return stripAnsi(r.stdout + (r.stderr ? `\n${r.stderr}` : ""));
}

export type CodexRunParams = {
  cwd: string;
  prompt: string;
  /** Codex thread/session id (uuid from JSONL `thread.started` or disk `composerId`). */
  sessionId?: string;
  /** Maps to `codex exec resume --last`. */
  continueSession?: boolean;
  outputFormat: "text" | "json" | "stream-json";
  model?: string;
  force?: boolean;
  sandbox?: "enabled" | "disabled";
  timeoutMs?: number;
};

function buildCodexExecArgs(p: CodexRunParams): string[] {
  const args: string[] = ["exec"];
  if (p.outputFormat === "json" || p.outputFormat === "stream-json") {
    args.push("--json");
  }
  args.push("--cd", p.cwd);
  if (p.model?.trim()) {
    args.push("-m", p.model.trim());
  }
  if (p.force) {
    args.push("--dangerously-bypass-approvals-and-sandbox");
  } else if (p.sandbox !== "enabled") {
    args.push("--full-auto");
  }
  if (process.env.POKE_AGENTS_CODEX_SKIP_GIT === "1") {
    args.push("--skip-git-repo-check");
  }

  if (p.sessionId?.trim()) {
    args.push("resume", p.sessionId.trim(), p.prompt);
  } else if (p.continueSession) {
    args.push("resume", "--last", p.prompt);
  } else {
    args.push(p.prompt);
  }
  return args;
}

/** Spawn `codex exec …` without waiting; caller owns streams and close events. */
export function startCodexRunDetached(p: CodexRunParams): {
  child: ChildProcess;
  clearRunTimeout: () => void;
  getTimedOut: () => boolean;
} {
  const bin = codexBin();
  const args = buildCodexExecArgs(p);
  const timeoutMs = p.timeoutMs ?? agentTimeoutMs();
  const child = spawn(bin, args, {
    cwd: p.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: codexEnv(),
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

/** Last `thread_id` from Codex exec JSONL (`type`: `thread.started`). */
export function extractLastCodexThreadId(stdout: string): string | undefined {
  let last: string | undefined;
  for (const line of stdout.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const o = JSON.parse(t) as { type?: string; thread_id?: string };
      if (o.type === "thread.started" && typeof o.thread_id === "string" && o.thread_id.length > 0) {
        last = o.thread_id;
      }
    } catch {
      /* skip non-JSON lines */
    }
  }
  return last;
}

export function countCodexJsonLines(stdout: string): number {
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

export function resolveCodexRunCwd(cwd: string, workspace?: string): string {
  const w = workspace?.trim();
  if (!w) return cwd;
  return path.resolve(cwd, w);
}

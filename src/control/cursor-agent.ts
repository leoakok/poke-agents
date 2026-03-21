import { spawn, type ChildProcess } from "node:child_process";
import type { SpawnResult } from "./types.js";
import { stripAnsi } from "./strip-ansi.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cursorAgentBin(): string {
  return process.env.POKE_AGENTS_CURSOR_AGENT_BIN?.trim() || "agent";
}

export function cursorAgentTimeoutMs(): number {
  const raw = process.env.POKE_AGENTS_AGENT_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 600_000;
}

function agentEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    CI: "1",
    NO_COLOR: "1",
    FORCE_COLOR: "0",
  };
}

export async function spawnCursorAgent(
  args: string[],
  options: {
    cwd: string;
    timeoutMs?: number;
  }
): Promise<SpawnResult> {
  const bin = cursorAgentBin();
  const timeoutMs = options.timeoutMs ?? cursorAgentTimeoutMs();
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
      env: agentEnv(),
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

/** `agent create-chat` → first UUID line on stdout */
export async function cursorCreateEmptyChat(cwd: string): Promise<
  | { ok: true; chat_id: string }
  | { ok: false; error: string; stdout: string; stderr: string }
> {
  const r = await spawnCursorAgent(["create-chat"], { cwd });
  const text = stripAnsi(r.stdout);
  const firstLine = text.split(/\n/).find((l) => l.trim())?.trim() ?? "";
  if (UUID_RE.test(firstLine)) {
    return { ok: true, chat_id: firstLine };
  }
  return {
    ok: false,
    error: r.timedOut
      ? "create-chat timed out"
      : "Could not parse chat id from create-chat output",
    stdout: r.stdout,
    stderr: r.stderr,
  };
}

export async function cursorAgentAbout(cwd: string): Promise<string> {
  const r = await spawnCursorAgent(["about"], {
    cwd,
    timeoutMs: 60_000,
  });
  return stripAnsi(r.stdout + (r.stderr ? `\n${r.stderr}` : ""));
}

export async function cursorAgentStatusText(cwd: string): Promise<string> {
  const r = await spawnCursorAgent(["status"], {
    cwd,
    timeoutMs: 60_000,
  });
  return stripAnsi(r.stdout + (r.stderr ? `\n${r.stderr}` : ""));
}

export type CursorRunHeadlessParams = {
  cwd: string;
  prompt: string;
  sessionId?: string;
  continueSession?: boolean;
  outputFormat: "text" | "json" | "stream-json";
  streamPartialOutput?: boolean;
  model?: string;
  mode?: "plan" | "ask";
  plan?: boolean;
  trust?: boolean;
  force?: boolean;
  approveMcps?: boolean;
  sandbox?: "enabled" | "disabled";
  cloud?: boolean;
  timeoutMs?: number;
};

/** `agent -p "..."` non-interactive run */
function buildCursorHeadlessArgs(p: CursorRunHeadlessParams): string[] {
  const args: string[] = ["-p", p.prompt];
  args.push("--output-format", p.outputFormat);
  if (p.streamPartialOutput && p.outputFormat === "stream-json") {
    args.push("--stream-partial-output");
  }
  const trust = p.trust ?? true;
  if (trust) args.push("--trust");
  if (p.force) args.push("--force");
  const approveMcps = p.approveMcps ?? true;
  if (approveMcps) args.push("--approve-mcps");
  if (p.cloud) args.push("--cloud");
  if (p.plan) args.push("--plan");
  if (p.mode) args.push("--mode", p.mode);
  if (p.model) args.push("--model", p.model);
  args.push("--sandbox", p.sandbox ?? "disabled");
  if (p.sessionId) args.push("--resume", p.sessionId);
  if (p.continueSession) args.push("--continue");
  return args;
}

export async function cursorRunHeadless(
  p: CursorRunHeadlessParams
): Promise<SpawnResult> {
  const args = buildCursorHeadlessArgs(p);
  return spawnCursorAgent(args, {
    cwd: p.cwd,
    timeoutMs: p.timeoutMs,
  });
}

/** Spawn `agent -p` without waiting; caller owns stdout/stderr and close events. */
export function startCursorRunHeadlessDetached(
  p: CursorRunHeadlessParams,
): {
  child: ChildProcess;
  clearRunTimeout: () => void;
  getTimedOut: () => boolean;
} {
  const bin = cursorAgentBin();
  const args = buildCursorHeadlessArgs(p);
  const timeoutMs = p.timeoutMs ?? cursorAgentTimeoutMs();
  const child = spawn(bin, args, {
    cwd: p.cwd,
    stdio: ["ignore", "pipe", "pipe"],
    env: agentEnv(),
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

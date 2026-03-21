import { randomUUID } from "node:crypto";

export type RunLifecycle =
  | "started"
  | "running"
  | "completed"
  | "failed"
  | "failed_to_start";

export type RunRecord = {
  run_id: string;
  status: RunLifecycle;
  created_at: string;
  updated_at: string;
  provider: string;
  cwd: string;
  prompt_preview: string;
  resume_uuid?: string;
  auto_created_cli_chat_uuid?: string;
  pid: number | null;
  exit_code: number | null;
  signal: string | null;
  timed_out: boolean;
  stdout: string;
  stderr: string;
  format: string;
  error?: string;
  /** Stored for background callback after process exit */
  poke_callback_url?: string;
  poke_callback_token?: string;
};

const runs = new Map<string, RunRecord>();

/** Max stored chars per stream per run (keep tail). */
const MAX_STREAM_CHARS = 2_000_000;
const MAX_RUNS = 500;

function trimTail(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(-max);
}

function appendBounded(buf: string, chunk: string): string {
  return trimTail(buf + chunk, MAX_STREAM_CHARS);
}

function evictIfNeeded(): void {
  while (runs.size >= MAX_RUNS) {
    const first = runs.keys().next().value;
    if (first === undefined) break;
    runs.delete(first);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

export function createRun(p: {
  provider: string;
  cwd: string;
  prompt: string;
  resume_uuid?: string;
  auto_created_cli_chat_uuid?: string;
  format: string;
  poke_callback_url?: string;
  poke_callback_token?: string;
}): RunRecord {
  evictIfNeeded();
  const run_id = `run_${randomUUID()}`;
  const rec: RunRecord = {
    run_id,
    status: "running",
    created_at: nowIso(),
    updated_at: nowIso(),
    provider: p.provider,
    cwd: p.cwd,
    prompt_preview:
      p.prompt.length > 500 ? `${p.prompt.slice(0, 500)}…` : p.prompt,
    resume_uuid: p.resume_uuid,
    auto_created_cli_chat_uuid: p.auto_created_cli_chat_uuid,
    pid: null,
    exit_code: null,
    signal: null,
    timed_out: false,
    stdout: "",
    stderr: "",
    format: p.format,
    poke_callback_url: p.poke_callback_url,
    poke_callback_token: p.poke_callback_token,
  };
  runs.set(run_id, rec);
  return rec;
}

export function getRun(run_id: string): RunRecord | undefined {
  return runs.get(run_id);
}

export function updateRun(
  run_id: string,
  patch: Partial<
    Pick<
      RunRecord,
      | "status"
      | "pid"
      | "exit_code"
      | "signal"
      | "timed_out"
      | "error"
      | "stdout"
      | "stderr"
    >
  >,
): void {
  const r = runs.get(run_id);
  if (!r) return;
  Object.assign(r, patch);
  r.updated_at = nowIso();
}

export function appendRunStdout(run_id: string, chunk: string): void {
  const r = runs.get(run_id);
  if (!r) return;
  r.stdout = appendBounded(r.stdout, chunk);
  r.updated_at = nowIso();
}

export function appendRunStderr(run_id: string, chunk: string): void {
  const r = runs.get(run_id);
  if (!r) return;
  r.stderr = appendBounded(r.stderr, chunk);
  r.updated_at = nowIso();
}

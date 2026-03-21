import type { ChildProcess } from "node:child_process";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import {
  resolveControlBackend,
  type ControlBackendId,
} from "./control-backend.js";
import {
  classifyCursorAgentFailure,
  type CursorAgentErrorClassification,
} from "./cursor-agent-classify.js";
import {
  cursorCreateEmptyChat,
  startCursorRunHeadlessDetached,
} from "./cursor-agent.js";
import { parseCursorStreamJsonStdout } from "../mcp/cursor-stream-json.js";
import { toolStructured } from "../mcp/tool-result.js";
import {
  codexSpawnCheck,
  countCodexJsonLines,
  extractLastCodexThreadId,
  resolveCodexRunCwd,
  startCodexRunDetached,
} from "./codex-cli.js";
import {
  countOpenCodeJsonLines,
  extractLastOpenCodeSessionId,
  opencodeSpawnCheck,
  resolveOpenCodeRunCwd,
  startOpenCodeRunDetached,
} from "./opencode-cli.js";
import { resolveControlAgentPromptWithTemplate } from "./control-agent-template.js";
import { resolvePokeCallbackFromToolArgs, sendPokeCallback } from "./poke-callback.js";
import {
  appendRunStderr,
  appendRunStdout,
  createRun,
  getRun,
  updateRun,
} from "./run-registry.js";

export type ControlAgentStartArgs = {
  prompt: string;
  /** Optional `id` from `agent_templates` — prepends that template's `promptPreamble` to `prompt`. */
  agent_template?: string;
  cwd?: string;
  workspace?: string;
  resume?: string;
  continue_chat?: boolean;
  format?: "text" | "json" | "stream-json";
  stream?: boolean;
  model?: string;
  mode?: "plan" | "ask";
  plan?: boolean;
  trust?: boolean;
  force?: boolean;
  approve_mcp?: boolean;
  sandbox?: "enabled" | "disabled";
  cloud?: boolean;
  poke_callback_url?: string;
  poke_callback_token?: string;
};

function resolveCwd(raw?: string): string {
  const w = raw?.trim();
  if (w) return w;
  return process.cwd();
}

async function sendFinalPokeCallback(
  runId: string,
  url: string | undefined,
  token: string | undefined,
  payload: Record<string, unknown>,
): Promise<void> {
  if (!url || !token) return;
  await sendPokeCallback({
    url,
    token,
    content: JSON.stringify(payload),
    hasMore: false,
  });
}

function attachBackgroundRun(
  runId: string,
  child: ChildProcess,
  opts: {
    clearRunTimeout: () => void;
    getTimedOut: () => boolean;
    fmt: "text" | "json" | "stream-json";
    pokeUrl?: string;
    pokeToken?: string;
    resumeAtStart: string | undefined;
    backend: ControlBackendId;
  },
): void {
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (c: string) => {
    appendRunStdout(runId, c);
  });
  child.stderr?.on("data", (c: string) => {
    appendRunStderr(runId, c);
  });

  const finalize = async (
    code: number | null,
    signal: NodeJS.Signals | null,
    spawnErr?: string,
  ) => {
    opts.clearRunTimeout();
    const timedOut = opts.getTimedOut();
    const rec = getRun(runId);
    const stdout = rec?.stdout ?? "";
    const stderr = rec?.stderr ?? "";

    let hint: string | undefined;
    let error_classification: CursorAgentErrorClassification | undefined;
    let cursor_stderr_message: string | undefined;
    const ok = !spawnErr && code === 0 && !timedOut;

    if (spawnErr) {
      updateRun(runId, {
        status: "failed",
        exit_code: 1,
        signal: null,
        timed_out: false,
        error: spawnErr,
      });
      await sendFinalPokeCallback(runId, opts.pokeUrl, opts.pokeToken, {
        run_id: runId,
        status: "failed",
        resume_uuid: opts.resumeAtStart ?? null,
        backend: opts.backend,
        error: spawnErr,
      });
      return;
    }

    if (!ok) {
      if (stderr.trim()) {
        if (opts.backend === "cursor") {
          const c = classifyCursorAgentFailure(stderr);
          hint = c.hint;
          error_classification = c.classification;
          cursor_stderr_message = c.primary_message;
        } else {
          const line = stderr.split("\n").find((l) => l.trim())?.trim();
          cursor_stderr_message =
            line ?? `Non-zero exit: code=${code ?? "?"}${
              timedOut ? " (timed out)" : ""
            }`;
          error_classification = timedOut ? "timeout" : "unknown";
        }
      } else {
        cursor_stderr_message = `Non-zero exit: code=${code ?? "?"}${
          timedOut ? " (timed out)" : ""
        }`;
        error_classification = timedOut ? "timeout" : "unknown";
      }
    }

    let resume_uuid: string | null = opts.resumeAtStart ?? null;
    if (opts.backend === "opencode") {
      const parsed = extractLastOpenCodeSessionId(stdout);
      if (parsed) resume_uuid = parsed;
    }
    if (opts.backend === "codex") {
      const parsed = extractLastCodexThreadId(stdout);
      if (parsed) resume_uuid = parsed;
    }

    let stream_json_truncated: boolean | undefined;
    let stream_json_event_count: number | undefined;
    if (opts.backend === "cursor" && opts.fmt === "stream-json" && stdout) {
      const streamParsed = parseCursorStreamJsonStdout(stdout);
      if (streamParsed) {
        stream_json_truncated = streamParsed.stream_json_truncated;
        stream_json_event_count = streamParsed.stream_json_events.length;
      }
    } else if (
      opts.backend === "opencode" &&
      stdout &&
      (opts.fmt === "json" || opts.fmt === "stream-json")
    ) {
      const n = countOpenCodeJsonLines(stdout);
      stream_json_event_count = Math.min(n, 800);
      stream_json_truncated = n > 800;
    } else if (
      opts.backend === "codex" &&
      stdout &&
      (opts.fmt === "json" || opts.fmt === "stream-json")
    ) {
      const n = countCodexJsonLines(stdout);
      stream_json_event_count = Math.min(n, 800);
      stream_json_truncated = n > 800;
    }

    updateRun(runId, {
      status: ok ? "completed" : "failed",
      exit_code: code,
      signal,
      timed_out: timedOut,
      error: ok ? undefined : cursor_stderr_message ?? "run failed",
    });

    await sendFinalPokeCallback(runId, opts.pokeUrl, opts.pokeToken, {
      run_id: runId,
      status: ok ? "completed" : "failed",
      resume_uuid,
      backend: opts.backend,
      exit_code: code,
      timed_out: timedOut,
      signal: signal ?? null,
      error_classification: error_classification ?? null,
      cursor_stderr_message: cursor_stderr_message ?? null,
      hint: hint ?? null,
      stream_json_truncated: stream_json_truncated ?? null,
      stream_json_event_count: stream_json_event_count ?? null,
      pull_stdout_stderr_via: "control_run_output_slice",
    });
  };

  child.on("error", (err) => {
    void finalize(null, null, err instanceof Error ? err.message : String(err));
  });

  child.on("close", (code, signal) => {
    void finalize(code, signal);
  });
}

export async function controlAgentStart(
  args: ControlAgentStartArgs,
): Promise<CallToolResult> {
  const resolved = resolveControlAgentPromptWithTemplate(
    args.agent_template,
    args.prompt,
  );
  if (!resolved.ok) {
    return toolStructured({
      ok: false,
      accepted: false,
      status: "failed_to_start" as const,
      backend: resolveControlBackend(),
      error: resolved.error,
    });
  }

  const execArgs: ControlAgentStartArgs = {
    ...args,
    prompt: resolved.effectivePrompt,
  };

  const templateFields: Record<string, string> =
    resolved.templateId !== undefined
      ? {
          agent_template: resolved.templateId,
          agent_template_title: resolved.templateTitle ?? resolved.templateId,
        }
      : {};

  const backend = resolveControlBackend();
  let inner: CallToolResult;
  if (backend === "cursor") {
    inner = await controlAgentStartCursor(execArgs);
  } else if (backend === "opencode") {
    inner = await controlAgentStartOpenCode(execArgs);
  } else {
    inner = await controlAgentStartCodex(execArgs);
  }

  if (Object.keys(templateFields).length === 0) {
    return inner;
  }
  const payload = inner.structuredContent;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    return toolStructured({ ...payload, ...templateFields });
  }
  return inner;
}

async function controlAgentStartCursor(
  args: ControlAgentStartArgs,
): Promise<CallToolResult> {
  const backend = "cursor" as const;
  const resolved = resolveCwd(args.cwd);
  let resume = args.resume?.trim() || undefined;
  let auto_created_cli_chat_uuid: string | undefined;

  const startNewCliSession = !resume && !args.continue_chat;

  if (startNewCliSession) {
    const created = await cursorCreateEmptyChat(resolved, {
      workspace: args.workspace,
    });
    if (!created.ok) {
      const blob = `${created.stderr}\n${created.error}`;
      const c = classifyCursorAgentFailure(blob);
      return toolStructured({
        ok: false,
        accepted: false,
        status: "failed_to_start" as const,
        backend,
        cwd: resolved,
        error: `new_cli_session: ${created.error}`,
        stdout: created.stdout,
        stderr: created.stderr,
        hint: c.hint,
        error_classification: c.classification,
        cursor_stderr_message: c.primary_message,
      });
    }
    resume = created.chat_id;
    auto_created_cli_chat_uuid = created.chat_id;
  }

  const fmt = args.format ?? "text";
  const cb = resolvePokeCallbackFromToolArgs({
    poke_callback_url: args.poke_callback_url,
    poke_callback_token: args.poke_callback_token,
  });

  const run = createRun({
    provider: backend,
    cwd: resolved,
    prompt: args.prompt,
    resume_uuid: resume,
    auto_created_cli_chat_uuid,
    format: fmt,
    poke_callback_url: cb.url,
    poke_callback_token: cb.token,
  });

  let detached: ReturnType<typeof startCursorRunHeadlessDetached>;
  try {
    detached = startCursorRunHeadlessDetached({
      cwd: resolved,
      workspace: args.workspace,
      prompt: args.prompt,
      sessionId: resume,
      continueSession: args.continue_chat,
      outputFormat: fmt,
      streamPartialOutput: args.stream,
      model: args.model,
      mode: args.mode,
      plan: args.plan,
      trust: args.trust ?? true,
      force: args.force,
      approveMcps: args.approve_mcp ?? true,
      sandbox: args.sandbox ?? "disabled",
      cloud: args.cloud,
    });
  } catch (e) {
    updateRun(run.run_id, {
      status: "failed_to_start",
      exit_code: 1,
      signal: null,
      timed_out: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return toolStructured({
      ok: false,
      accepted: false,
      status: "failed_to_start" as const,
      backend,
      cwd: resolved,
      run_id: run.run_id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const pid = detached.child.pid ?? null;
  updateRun(run.run_id, { pid, status: "running" });

  attachBackgroundRun(run.run_id, detached.child, {
    clearRunTimeout: detached.clearRunTimeout,
    getTimedOut: detached.getTimedOut,
    fmt,
    pokeUrl: cb.url,
    pokeToken: cb.token,
    resumeAtStart: resume,
    backend,
  });

  const hint =
    cb.url && cb.token
      ? "Background run started — completion callback when the CLI exits. Use `resume_uuid` as `resume` on the next `control_agent` call for the same chat."
      : "Background run started — set Poke callback headers or `poke_callback_url` + `poke_callback_token` for completion pings. Optional: `control_run_status` / `control_run_output_slice`. Use `resume_uuid` for the next turn.";

  return toolStructured({
    ok: true,
    accepted: true,
    status: "started" as const,
    run_id: run.run_id,
    callback_registered: Boolean(cb.url && cb.token),
    backend,
    cwd: resolved,
    resume_uuid: resume,
    auto_created_cli_chat_uuid,
    hint,
  });
}

async function controlAgentStartOpenCode(
  args: ControlAgentStartArgs,
): Promise<CallToolResult> {
  const backend = "opencode" as const;
  const resolved = resolveCwd(args.cwd);
  const runCwd = resolveOpenCodeRunCwd(resolved, args.workspace);
  let resume = args.resume?.trim() || undefined;

  const spawnOk = opencodeSpawnCheck(runCwd);
  if (!spawnOk.ok) {
    return toolStructured({
      ok: false,
      accepted: false,
      status: "failed_to_start" as const,
      backend,
      cwd: runCwd,
      error: spawnOk.error,
    });
  }

  const fmt = args.format ?? "text";
  const cb = resolvePokeCallbackFromToolArgs({
    poke_callback_url: args.poke_callback_url,
    poke_callback_token: args.poke_callback_token,
  });

  const run = createRun({
    provider: backend,
    cwd: runCwd,
    prompt: args.prompt,
    resume_uuid: resume,
    auto_created_cli_chat_uuid: undefined,
    format: fmt,
    poke_callback_url: cb.url,
    poke_callback_token: cb.token,
  });

  let detached: ReturnType<typeof startOpenCodeRunDetached>;
  try {
    detached = startOpenCodeRunDetached({
      cwd: runCwd,
      prompt: args.prompt,
      sessionId: resume,
      continueSession: Boolean(args.continue_chat) && !resume,
      outputFormat: fmt === "stream-json" ? "stream-json" : fmt,
      model: args.model,
    });
  } catch (e) {
    updateRun(run.run_id, {
      status: "failed_to_start",
      exit_code: 1,
      signal: null,
      timed_out: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return toolStructured({
      ok: false,
      accepted: false,
      status: "failed_to_start" as const,
      backend,
      cwd: runCwd,
      run_id: run.run_id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const pid = detached.child.pid ?? null;
  updateRun(run.run_id, { pid, status: "running" });

  attachBackgroundRun(run.run_id, detached.child, {
    clearRunTimeout: detached.clearRunTimeout,
    getTimedOut: detached.getTimedOut,
    fmt,
    pokeUrl: cb.url,
    pokeToken: cb.token,
    resumeAtStart: resume,
    backend,
  });

  const hint =
    cb.url && cb.token
      ? "Background OpenCode run — completion callback includes `resume_uuid` (session id) parsed from JSON stdout when present."
      : "Background OpenCode run — poll `control_run_status` / `control_run_output_slice`. After exit, read `resume_uuid` from the callback payload or from JSON lines in captured stdout.";

  return toolStructured({
    ok: true,
    accepted: true,
    status: "started" as const,
    run_id: run.run_id,
    callback_registered: Boolean(cb.url && cb.token),
    backend,
    cwd: runCwd,
    ...(resume !== undefined ? { resume_uuid: resume } : {}),
    hint,
  });
}

async function controlAgentStartCodex(
  args: ControlAgentStartArgs,
): Promise<CallToolResult> {
  const backend = "codex" as const;
  const resolved = resolveCwd(args.cwd);
  const runCwd = resolveCodexRunCwd(resolved, args.workspace);
  const resume = args.resume?.trim() || undefined;

  const spawnOk = codexSpawnCheck(runCwd);
  if (!spawnOk.ok) {
    return toolStructured({
      ok: false,
      accepted: false,
      status: "failed_to_start" as const,
      backend,
      cwd: runCwd,
      error: spawnOk.error,
    });
  }

  const fmt = args.format ?? "text";
  const cb = resolvePokeCallbackFromToolArgs({
    poke_callback_url: args.poke_callback_url,
    poke_callback_token: args.poke_callback_token,
  });

  const run = createRun({
    provider: backend,
    cwd: runCwd,
    prompt: args.prompt,
    resume_uuid: resume,
    auto_created_cli_chat_uuid: undefined,
    format: fmt,
    poke_callback_url: cb.url,
    poke_callback_token: cb.token,
  });

  let detached: ReturnType<typeof startCodexRunDetached>;
  try {
    detached = startCodexRunDetached({
      cwd: runCwd,
      prompt: args.prompt,
      sessionId: resume,
      continueSession: Boolean(args.continue_chat) && !resume,
      outputFormat: fmt === "stream-json" ? "stream-json" : fmt,
      model: args.model,
      force: args.force,
      sandbox: args.sandbox ?? "disabled",
    });
  } catch (e) {
    updateRun(run.run_id, {
      status: "failed_to_start",
      exit_code: 1,
      signal: null,
      timed_out: false,
      error: e instanceof Error ? e.message : String(e),
    });
    return toolStructured({
      ok: false,
      accepted: false,
      status: "failed_to_start" as const,
      backend,
      cwd: runCwd,
      run_id: run.run_id,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  const pid = detached.child.pid ?? null;
  updateRun(run.run_id, { pid, status: "running" });

  attachBackgroundRun(run.run_id, detached.child, {
    clearRunTimeout: detached.clearRunTimeout,
    getTimedOut: detached.getTimedOut,
    fmt,
    pokeUrl: cb.url,
    pokeToken: cb.token,
    resumeAtStart: resume,
    backend,
  });

  const hint =
    cb.url && cb.token
      ? "Background Codex run — completion callback includes `resume_uuid` (thread id) parsed from JSONL `thread.started` when present."
      : "Background Codex run — poll `control_run_status` / `control_run_output_slice`. After exit, read `resume_uuid` from the callback payload or from JSONL `thread.started` in captured stdout.";

  return toolStructured({
    ok: true,
    accepted: true,
    status: "started" as const,
    run_id: run.run_id,
    callback_registered: Boolean(cb.url && cb.token),
    backend,
    cwd: runCwd,
    ...(resume !== undefined ? { resume_uuid: resume } : {}),
    hint,
  });
}

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

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
import { resolvePokeCallbackFromToolArgs, sendPokeCallback } from "./poke-callback.js";
import {
  appendRunStderr,
  appendRunStdout,
  createRun,
  getRun,
  updateRun,
} from "./run-registry.js";

export type ControlAgentStartArgs = {
  provider: "cursor" | "opencode";
  prompt: string;
  cwd?: string;
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
  auto_chat?: boolean;
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
  child: ReturnType<typeof startCursorRunHeadlessDetached>["child"],
  opts: {
    clearRunTimeout: () => void;
    getTimedOut: () => boolean;
    fmt: "text" | "json" | "stream-json";
    pokeUrl?: string;
    pokeToken?: string;
    resume: string | undefined;
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
        resume_uuid: opts.resume ?? null,
        error: spawnErr,
      });
      return;
    }

    if (!ok) {
      if (stderr.trim()) {
        const c = classifyCursorAgentFailure(stderr);
        hint = c.hint;
        error_classification = c.classification;
        cursor_stderr_message = c.primary_message;
      } else {
        cursor_stderr_message = `Non-zero exit: code=${code ?? "?"}${
          timedOut ? " (timed out)" : ""
        }`;
        error_classification = timedOut ? "timeout" : "unknown";
      }
    }

    let stream_json_truncated: boolean | undefined;
    let stream_json_event_count: number | undefined;
    if (opts.fmt === "stream-json" && stdout) {
      const streamParsed = parseCursorStreamJsonStdout(stdout);
      if (streamParsed) {
        stream_json_truncated = streamParsed.stream_json_truncated;
        stream_json_event_count = streamParsed.stream_json_events.length;
      }
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
      resume_uuid: opts.resume ?? null,
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
  if (args.provider !== "cursor") {
    return toolStructured({
      ok: false,
      accepted: false,
      status: "failed_to_start" as const,
      provider: args.provider,
      error: "control_agent_start is not implemented for this provider yet",
    });
  }

  const resolved = resolveCwd(args.cwd);
  let resume = args.resume?.trim() || undefined;
  let auto_created_cli_chat_uuid: string | undefined;

  const useAutoChat =
    args.auto_chat !== false && !resume && !args.continue_chat;

  if (useAutoChat) {
    const created = await cursorCreateEmptyChat(resolved);
    if (!created.ok) {
      const blob = `${created.stderr}\n${created.error}`;
      const c = classifyCursorAgentFailure(blob);
      return toolStructured({
        ok: false,
        accepted: false,
        status: "failed_to_start" as const,
        provider: args.provider,
        cwd: resolved,
        error: `auto_chat: ${created.error}`,
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
    provider: args.provider,
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
      provider: args.provider,
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
    resume,
  });

  return toolStructured({
    ok: true,
    accepted: true,
    status: "started" as const,
    run_id: run.run_id,
    callback_registered: Boolean(cb.url && cb.token),
    provider: args.provider,
    cwd: resolved,
    resume_uuid: resume,
    auto_created_cli_chat_uuid,
    hint: "Poll `control_run_status` / `control_run_output_slice`; large output stays pull-based.",
  });
}

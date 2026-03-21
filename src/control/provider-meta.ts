import type { ControlProviderMeta } from "./types.js";
import { resolveControlBackend } from "./control-backend.js";
import { codexBin } from "./codex-cli.js";
import { cursorAgentBin } from "./cursor-agent.js";
import { opencodeBin } from "./opencode-cli.js";

const CURSOR_NOTES = [
  "Listing chats uses disk snapshots (same as `sessions`), not `agent ls` (TUI-only).",
  "Stop/interrupt is not exposed by the Cursor CLI; end the local `agent` process from the OS or terminal (see `session_stop` on `control_plan`).",
  "Requires `agent` on PATH or POKE_AGENTS_CURSOR_AGENT_BIN.",
  "`control_agent` runs `agent create-chat` when you omit `resume` and `continue_chat` (new CLI session), then starts `agent -p` in the background and returns `run_id` immediately.",
  "`control_agent` passes `--workspace` when `workspace` is set (resolved vs `cwd`); otherwise only spawn `cwd` is used.",
  "`create-chat` passes `--trust` by default; set `POKE_AGENTS_CURSOR_CREATE_CHAT_TRUST=0` to match older behavior without `--trust`.",
  "Headless `agent -p` maps MCP → CLI roughly as: `format` → `--output-format`; `stream` → `--stream-partial-output` (with `stream-json`); `resume`/`continue_chat` → `--resume`/`--continue`; `model`/`mode`/`plan`/`cloud`; `trust` → `--trust`; `force` → `--force` (`--yolo` is CLI alias of `--force`, not a separate MCP field); `approve_mcp` → `--approve-mcps`; `sandbox` → `--sandbox`; `workspace` → `--workspace`. Auth: set `CURSOR_API_KEY` in the environment (not an MCP argument).",
  "Default `control_agent` also passes `--sandbox disabled` (plus `trust` / `approve-mcps`) so headless runs are not stuck in Cursor’s network-restricted sandbox; set `sandbox: \"enabled\"` to isolate.",
  "The CLI cannot open a GUI browser — use Poke’s (or your orchestrator’s) own HTTP/search and pass excerpts into `control_agent.prompt`, or rely on shell/network inside the agent when sandbox is off.",
  "Failures include `error_classification`, `cursor_stderr_message` (verbatim line when possible), and `hint` — not only a generic “unavailable”.",
  "For `stream-json`, NDJSON lands in captured stdout — use `control_run_output_slice` after the run completes, or read `stream_json_event_count` from the Poke completion callback.",
  "If you see `permission_denied`, see `hint` and verify `cwd`/`workspace`, trust, sandbox, `approve_mcp`, and filesystem access.",
  "HTTP MCP (e.g. poke tunnel): each tool call is one HTTP round-trip; reverse proxies often time out (502) if the handler is slow. `control_agent` returns immediately — never wait on that response for CLI completion; use callback headers/args or `control_run_*`. For huge disk threads prefer `control_chat_slice` / `tail` / `around` over full `session`.",
];

const OPENCODE_NOTES = [
  "Headless control uses `opencode run` when `POKE_AGENTS_CONTROL=opencode` (see `active_control` on `control_plan`).",
  "Session ids look like `ses_…` — use as `resume` on the next `control_agent` call, or map from disk via `control_disk_to_cli` (`composerId`).",
  "`opencode run --format json` emits NDJSON; completion callbacks may include `stream_json_event_count` (capped).",
  "Configure providers with `opencode auth login` / keys in env (see OpenCode docs).",
];

const CODEX_NOTES = [
  "Headless control uses `codex exec` when `POKE_AGENTS_CONTROL=codex` (see `active_control` on `control_plan`).",
  "Thread ids are UUIDs — first event in `--json` mode is typically `thread.started` with `thread_id`; disk rows expose the same id as `composerId` for `control_disk_to_cli` → `resume`.",
  "`codex exec --json` emits JSONL to stdout; completion callbacks may include `stream_json_event_count` (capped).",
  "Authenticate with `codex login` / ChatGPT or API key flow (see OpenAI Codex docs). Unattended runs default to `--full-auto`; pass `force: true` for `--dangerously-bypass-approvals-and-sandbox` (use only in isolated environments).",
  "Non-git directories: set `POKE_AGENTS_CODEX_SKIP_GIT=1` to pass `--skip-git-repo-check`, or ensure the CLI cwd is inside a git repo.",
];

export function controlProviderMeta(): ControlProviderMeta[] {
  return [
    {
      id: "cursor",
      label: "Cursor (Cursor Agent CLI)",
      features: {
        create_empty_chat: true,
        run_headless_prompt: true,
        resume_chat_by_id: true,
        continue_previous_cli: true,
        cli_identity_status: true,
        disk_session_snapshot: true,
        stop_session_via_cli: false,
        list_chats_via_cli: false,
      },
      notes: CURSOR_NOTES,
    },
    {
      id: "opencode",
      label: "OpenCode",
      features: {
        create_empty_chat: true,
        run_headless_prompt: true,
        resume_chat_by_id: true,
        continue_previous_cli: true,
        cli_identity_status: true,
        disk_session_snapshot: true,
        stop_session_via_cli: false,
        list_chats_via_cli: false,
      },
      notes: OPENCODE_NOTES,
    },
    {
      id: "codex",
      label: "OpenAI Codex CLI",
      features: {
        create_empty_chat: true,
        run_headless_prompt: true,
        resume_chat_by_id: true,
        continue_previous_cli: true,
        cli_identity_status: true,
        disk_session_snapshot: true,
        stop_session_via_cli: false,
        list_chats_via_cli: false,
      },
      notes: CODEX_NOTES,
    },
  ];
}

export function controlCapabilitiesPayload(): Record<string, unknown> {
  return {
    providers: controlProviderMeta(),
    active_control: resolveControlBackend(),
    cursor_agent_binary: cursorAgentBin(),
    opencode_cli_binary: opencodeBin(),
    codex_cli_binary: codexBin(),
    orchestration: {
      http_mcp_and_tunnel:
        "Over HTTP (including poke tunnel), one MCP tool invocation maps to one HTTP request until the tool handler returns. Middleboxes and tunnels apply idle/total timeouts — a 502 often means the proxy gave up, not that poke-agents crashed.",
      control_agent:
        "Returns immediately with run_id while the headless CLI runs locally (Cursor agent, OpenCode run, or codex exec). Orchestrators must not classify this tool as blocking until the CLI finishes; use X-Poke-Callback-Url/Token (or stdio poke_callback_*) and/or poll control_run_status.",
      large_disk_transcripts:
        "session loads the full message list in one call — fine for small chats, but slow and timeout-prone for very large threads. Prefer control_chat_slice, control_chat_tail, or control_chat_around with modest limits.",
      network_bound_tools:
        "poke-agents does not expose web fetch/search — Poke handles those. Other tools here are mostly local disk/CLI; avoid huge `session` pulls over a short MCP HTTP deadline.",
    },
    session_ids: {
      disk:
        "Opaque id from `sessions`: source:base64url(JSON of on-disk chat row).",
      cli:
        "Cursor: uuid from `auto_created_cli_chat_uuid` / `resume_uuid` / `create-chat`. OpenCode: `ses_…`. Codex: thread uuid from JSONL `thread.started` or disk `composerId` → pass as `resume`.",
      bridge:
        "`control_disk_to_cli` with a disk `id` reads composerId when present.",
    },
    session_stop: {
      supported: false as const,
      note:
        "Headless CLIs do not expose cancel via these MCP tools; use OS signals or wait. See provider notes for details.",
    },
    env: {
      POKE_AGENTS_CONTROL:
        "`cursor` (default), `opencode`, or `codex` — which CLI backs `control_agent` / `control_agent_check`",
      POKE_AGENTS_CURSOR_AGENT_BIN: "Override path to Cursor `agent`",
      POKE_AGENTS_OPENCODE_BIN: "Override path to `opencode`",
      POKE_AGENTS_CODEX_BIN: "Override path to `codex` (OpenAI Codex CLI)",
      POKE_AGENTS_CODEX_SKIP_GIT:
        "Set to 1 to pass `--skip-git-repo-check` on `codex exec` (non-git cwd)",
      POKE_AGENTS_AGENT_TIMEOUT_MS: "Headless run timeout (default 600000)",
      CURSOR_API_KEY: "Optional — Cursor CLI auth when not using interactive login",
      POKE_AGENTS_CURSOR_CREATE_CHAT_TRUST:
        "Set to 0/false/off to omit `--trust` on `agent create-chat` (default: trust on)",
      POKE_AGENTS_TEMPLATES_PATH:
        "Optional absolute path for custom `agent_templates` JSON (default ~/.poke-agents/agent-templates.json)",
    },
  };
}

import type { ControlProviderId, ControlProviderMeta } from "./types.js";
import { cursorAgentBin } from "./cursor-agent.js";

const CURSOR_NOTES = [
  "Listing chats uses disk snapshots (same as `sessions`), not `agent ls` (TUI-only).",
  "Stop/interrupt is not exposed by the Cursor CLI; end the local `agent` process from the OS or terminal (see `session_stop` on `control_plan`).",
  "Requires `agent` on PATH or POKE_AGENTS_CURSOR_AGENT_BIN.",
  "Default `control_agent.auto_chat` runs `create-chat` when you omit `resume` and `continue_chat` (one-shot headless). Set `auto_chat: false` for legacy behavior.",
  "Default `control_agent` also passes `--sandbox disabled` (plus `trust` / `approve-mcps`) so headless runs are not stuck in Cursor’s network-restricted sandbox; set `sandbox: \"enabled\"` to isolate.",
  "The CLI cannot open a GUI browser — use this MCP’s `web_fetch` / `web_search` from the orchestrator and pass results into `control_agent.prompt`.",
  "Failures include `error_classification`, `cursor_stderr_message` (verbatim line when possible), and `hint` — not only a generic “unavailable”.",
  "For live-ish progress, use `format: stream-json` and `stream: true`; parsed events are in `stream_json_events`.",
];

const OPENCODE_NOTES = [
  "Control via CLI is not implemented yet; use read tools for local session data when opencode is in POKE_AGENTS_EDITORS.",
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
        create_empty_chat: false,
        run_headless_prompt: false,
        resume_chat_by_id: false,
        continue_previous_cli: false,
        cli_identity_status: false,
        disk_session_snapshot: true,
        stop_session_via_cli: false,
        list_chats_via_cli: false,
      },
      notes: OPENCODE_NOTES,
    },
  ];
}

export function controlCapabilitiesPayload(): Record<string, unknown> {
  return {
    providers: controlProviderMeta(),
    cursor_agent_binary: cursorAgentBin(),
    session_ids: {
      disk:
        "Opaque id from `sessions`: source:base64url(JSON of on-disk chat row).",
      cli:
        "Bare uuid from `control_chat_new`, `control_agent.auto_created_cli_chat_uuid`, or `agent create-chat` → pass as `resume` in `control_agent`.",
      bridge:
        "`control_disk_to_cli` with a disk `id` reads composerId when present.",
    },
    session_stop: {
      supported: false as const,
      note:
        "Neither Cursor nor OpenCode control tools can cancel an in-flight headless run via the CLI; use OS signals or wait. See provider notes for details.",
    },
    env: {
      POKE_AGENTS_CURSOR_AGENT_BIN: "Override path to `agent`",
      POKE_AGENTS_AGENT_TIMEOUT_MS: "Headless run timeout (default 600000)",
      POKE_AGENTS_BRAVE_API_KEY:
        "Optional — Brave Search for `web_search` (or use BRAVE_API_KEY)",
      BRAVE_API_KEY: "Optional — alias for Brave Search API token",
    },
  };
}

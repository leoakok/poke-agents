import type { ControlProviderId, ControlProviderMeta } from "./types.js";
import { cursorAgentBin } from "./cursor-agent.js";

const CURSOR_NOTES = [
  "Listing chats uses disk snapshots (same as list_sessions), not `agent ls` (TUI-only).",
  "Stop/interrupt is not exposed by the Cursor CLI; end the local `agent` process from the OS or terminal.",
  "Requires `agent` on PATH or POKE_AGENTS_CURSOR_AGENT_BIN.",
  "If `control_run_agent` fails with stderr like `[unavailable]`, that is Cursor cloud/auth/subscription — use `control_cli_status` and Cursor docs; poke-agents only spawns the CLI.",
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
      list_sessions:
        "Opaque MCP id: source:base64url(JSON.stringify(disk chat row)).",
      cursor_cli:
        "Bare UUID from `control_create_session` / `agent create-chat`, used as session_id for control_run_agent --resume.",
      bridge:
        "Use control_cursor_cli_chat_from_session with a list_sessions id to read composerId when present.",
    },
    env: {
      POKE_AGENTS_CURSOR_AGENT_BIN: "Override path to `agent`",
      POKE_AGENTS_AGENT_TIMEOUT_MS: "Headless run timeout (default 600000)",
    },
  };
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  RESOURCE_SESSION_IDS,
  RESOURCE_TOOLS_CONTROL,
  RESOURCE_TOOLS_READ,
} from "./guide-md.js";

const MIME = "text/markdown";

export function registerPokeAgentsPromptsAndResources(mcp: McpServer): void {
  mcp.registerResource(
    "guide-tools-read",
    "poke-agents://guide/tools-read",
    { mimeType: MIME, description: "Read-only tools: list connectors/sessions, load transcripts" },
    async () => ({
      contents: [
        {
          uri: "poke-agents://guide/tools-read",
          mimeType: MIME,
          text: RESOURCE_TOOLS_READ,
        },
      ],
    })
  );

  mcp.registerResource(
    "guide-tools-control",
    "poke-agents://guide/tools-control",
    { mimeType: MIME, description: "CLI control tools: Cursor agent, session mapping" },
    async () => ({
      contents: [
        {
          uri: "poke-agents://guide/tools-control",
          mimeType: MIME,
          text: RESOURCE_TOOLS_CONTROL,
        },
      ],
    })
  );

  mcp.registerResource(
    "guide-session-ids",
    "poke-agents://guide/session-ids",
    { mimeType: MIME, description: "Disk MCP id vs Cursor CLI UUID" },
    async () => ({
      contents: [
        {
          uri: "poke-agents://guide/session-ids",
          mimeType: MIME,
          text: RESOURCE_SESSION_IDS,
        },
      ],
    })
  );

  mcp.registerPrompt(
    "getting_started",
    {
      title: "How to use this MCP",
      description:
        "Orientation: read vs control tools, profile env, where docs live (resources + MCP_TOOLS.md).",
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "You have access to the **poke-agents** MCP server.",
              "",
              "**Read path (disk):** `list_connectors` → `list_sessions` → `get_session`. Respects `POKE_AGENTS_EDITORS` (default cursor + opencode).",
              "",
              "**Control path (CLI):** Only **provider=cursor** is implemented. Use `control_capabilities` first. Create CLI chats with `control_create_session`, run headless work with `control_run_agent` (`trust: true` recommended for unattended runs). Map disk sessions to CLI ids with `control_cursor_cli_chat_from_session` when possible.",
              "",
              "**Docs as resources:** Fetch markdown via MCP resources:",
              "- `poke-agents://guide/tools-read`",
              "- `poke-agents://guide/tools-control`",
              "- `poke-agents://guide/session-ids`",
              "",
              "Prefer `structuredContent` from tool results; it matches each tool's outputSchema.",
              "",
              "What should we do next with the user's coding agents?",
            ].join("\n"),
          },
        },
      ],
    })
  );

  mcp.registerPrompt(
    "workflow_inspect_saved_chats",
    {
      title: "Inspect saved Cursor/OpenCode chats",
      description:
        "Step-by-step: filter by source, list sessions, open one transcript.",
      argsSchema: {
        source: z
          .string()
          .optional()
          .describe("e.g. cursor, opencode — passed to list_sessions.source"),
        limit: z
          .number()
          .int()
          .positive()
          .max(500)
          .optional()
          .describe("Max sessions (default 50)"),
      },
    },
    async ({ source, limit }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Follow this workflow using poke-agents tools only:",
              "",
              "1. Call `list_connectors` and confirm the target adapter is `available`.",
              `2. Call \`list_sessions\` with source=${source ?? "(omit or user-specified)"} and limit=${limit ?? 50}.`,
              "3. Pick a `sessions[].id` and call `get_session` with that exact `session_id`.",
              "4. Summarize titles, recency, and key themes for the user.",
              "",
              "If `get_session` returns ok:false, explain the error and suggest checking POKE_AGENTS_EDITORS.",
            ].join("\n"),
          },
        },
      ],
    })
  );

  mcp.registerPrompt(
    "workflow_cursor_headless_task",
    {
      title: "Run Cursor Agent headlessly",
      description:
        "Check CLI auth, optionally create/resume chat, run agent -p with trust.",
      argsSchema: {
        goal: z
          .string()
          .min(1)
          .describe("What the agent should accomplish in one instruction"),
        workspace: z
          .string()
          .optional()
          .describe("Absolute project path for cwd"),
        cli_chat_id: z
          .string()
          .optional()
          .describe("UUID from control_create_session; omit for new context unless using --continue"),
        use_continue: z
          .boolean()
          .optional()
          .describe("If true, pass continue_session instead of session_id"),
      },
    },
    async ({ goal, workspace, cli_chat_id, use_continue }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Run a **Cursor Agent** task via poke-agents control tools (provider=cursor).",
              "",
              "1. Call `control_cli_status` to verify login (`about` / `status` text).",
              use_continue
                ? "2. Call `control_run_agent` with provider=cursor, the user's goal as `prompt`, `continue_session: true`, `trust: true`, and `workspace` if given."
                : cli_chat_id
                  ? `2. Call \`control_run_agent\` with provider=cursor, \`session_id\`="${cli_chat_id}", \`prompt\` describing the goal, \`trust: true\`, optional \`workspace\`.`
                  : "2. Optionally call `control_create_session` to obtain a `chat_id`, then `control_run_agent` with that `session_id`, `trust: true`, and the goal as `prompt`.",
              "",
              `Goal to execute: ${goal}`,
              workspace ? `Workspace: ${workspace}` : "",
              "",
              "3. Report exit_code, timed_out, and a short summary of stdout/stderr. Warn if ok is false.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        },
      ],
    })
  );

  mcp.registerPrompt(
    "workflow_bridge_disk_to_cli",
    {
      title: "Resume CLI chat from a saved disk session",
      description:
        "Use control_cursor_cli_chat_from_session then control_run_agent.",
      argsSchema: {
        list_sessions_id: z
          .string()
          .min(1)
          .describe("Exact id from list_sessions for a Cursor row"),
        follow_up_prompt: z
          .string()
          .min(1)
          .describe("What to tell the agent after resume"),
      },
    },
    async ({ list_sessions_id, follow_up_prompt }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Bridge a **disk** Cursor session to the **CLI** and continue work.",
              "",
              `1. Call \`control_cursor_cli_chat_from_session\` with session_id=\`${list_sessions_id}\`.`,
              "2. If `cli_chat_id` is non-null, call `control_run_agent` with provider=cursor, that value as `session_id`, `prompt` = the follow-up below, `trust: true`.",
              "3. If `cli_chat_id` is null, explain that this row has no composerId; suggest `control_create_session` instead or inspect `row_keys`.",
              "",
              `Follow-up prompt: ${follow_up_prompt}`,
            ].join("\n"),
          },
        },
      ],
    })
  );
}

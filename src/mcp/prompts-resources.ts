import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  RESOURCE_AGENT_STREAMING,
  RESOURCE_SESSION_IDS,
  RESOURCE_TOOLS_CONTROL,
  RESOURCE_TOOLS_READ,
} from "./guide-md.js";

const MIME = "text/markdown";

export function registerPokeAgentsPromptsAndResources(mcp: McpServer): void {
  mcp.registerResource(
    "guide-tools-read",
    "poke-agents://guide/tools-read",
    { mimeType: MIME, description: "Read tools: adapters, sessions, transcript" },
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
    { mimeType: MIME, description: "CLI control: plan, agent, bridge" },
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
    { mimeType: MIME, description: "Disk id vs CLI uuid" },
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

  mcp.registerResource(
    "guide-agent-streaming",
    "poke-agents://guide/agent-streaming",
    {
      mimeType: MIME,
      description: "stream-json + stream_json_events for live-ish agent output",
    },
    async () => ({
      contents: [
        {
          uri: "poke-agents://guide/agent-streaming",
          mimeType: MIME,
          text: RESOURCE_AGENT_STREAMING,
        },
      ],
    })
  );

  mcp.registerPrompt(
    "getting_started",
    {
      title: "How to use this MCP",
      description:
        "Orientation: read vs control tools, profile env, resources + MCP_TOOLS.md.",
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
              "**Read path (disk):** `adapters` → `sessions` → `session` (param `id`). Respects `POKE_AGENTS_EDITORS`.",
              "",
              "**Control path (CLI):** Only **provider=cursor** is implemented. Call `control_plan` once for the contract. **`control_agent`** is **synchronous** (blocks until the CLI exits). **`control_agent_start`** returns immediately with **`run_id`** and runs `agent -p` in the background — poll **`control_run_status`** / **`control_run_output_slice`**, or use Poke HTTP MCP headers **`X-Poke-Callback-Url`** + **`X-Poke-Callback-Token`** (or tool args `poke_callback_url` / `poke_callback_token` on stdio) for a small completion ping. Same defaults as sync: **`auto_chat: true`**, **`trust: true`**, **`approve_mcp: true`**, **`sandbox: \"disabled\"`**. Pass **`sandbox: \"enabled\"`** only when you want isolation. For follow-ups, pass `resume` or `continue_chat`. Map disk rows with `control_disk_to_cli`.",
              "",
              "**Transparency:** On failure read `error_classification`, `cursor_stderr_message`, and full `stderr` — not just `hint`.",
              "",
              "**Large transcripts:** Prefer `control_chat_slice`, `control_chat_tail`, or `control_chat_around` over loading the full `session` tool when threads are huge.",
              "",
              "**Streaming:** `control_agent` with `format: stream-json` and `stream: true` → `stream_json_events` for progressive CLI JSON lines. For async runs, pull stdout via `control_run_output_slice` and parse NDJSON locally. Resource: `poke-agents://guide/agent-streaming`.",
              "",
              "**Web:** You (the caller) use **`web_fetch`** / **`web_search`** on this MCP — do not expect the headless Cursor agent alone to “open a browser”. If a task needs a URL, fetch it here and pass excerpts into `control_agent.prompt`, or have the sub-agent use shell/tools after sandbox is off.",
              "",
              "**Resources:** `poke-agents://guide/tools-read`, `.../tools-control`, `.../session-ids`, `.../agent-streaming`.",
              "",
              "Prefer `structuredContent`; it matches each tool's outputSchema.",
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
      description: "Adapters → list sessions → open transcript.",
      argsSchema: {
        editor: z
          .string()
          .optional()
          .describe("Filter passed to sessions.editor (e.g. cursor, opencode)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(500)
          .optional()
          .describe("Max sessions (default 50)"),
      },
    },
    async ({ editor, limit }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Follow this workflow using poke-agents tools only:",
              "",
              "1. Call `adapters` and confirm the target row is `available`.",
              `2. Call \`sessions\` with editor=${editor ?? "(omit)"} and limit=${limit ?? 50}.`,
              "3. Pick `sessions[].id` and call `session` with that exact `id`.",
              "4. Summarize titles, recency, and key themes for the user.",
              "",
              "If `session` returns ok:false, explain the error and suggest checking POKE_AGENTS_EDITORS.",
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
      description: "Check CLI, then run agent -p with trust.",
      argsSchema: {
        goal: z.string().min(1).describe("Single instruction for the agent"),
        cwd: z.string().optional().describe("Absolute project path"),
        resume_uuid: z
          .string()
          .optional()
          .describe("CLI uuid from control_chat_new; omit unless resuming that chat"),
        use_continue: z
          .boolean()
          .optional()
          .describe("If true, pass continue_chat: true instead of resume"),
      },
    },
    async ({ goal, cwd, resume_uuid, use_continue }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Run a **Cursor Agent** task via poke-agents (`provider=cursor`).",
              "",
              "1. Call `control_agent_check` to verify login.",
              use_continue
                ? "2. Prefer `control_agent_start` with prompt = goal, continue_chat: true, optional cwd (same defaults), then poll `control_run_status` until terminal, and use `control_run_output_slice` for stdout/stderr. Alternatively use blocking `control_agent` if you need `stream_json_events` in one response."
                : resume_uuid
                  ? `2. Prefer \`control_agent_start\` with resume="${resume_uuid}", prompt = goal, optional cwd; poll status + output slices. Or use blocking \`control_agent\` for a single-shot result.`
                  : "2. Optionally `control_chat_new` for a uuid, then `control_agent_start` (or blocking `control_agent`) with that resume and the goal as prompt (same defaults).",
              "",
              `Goal: ${goal}`,
              cwd ? `cwd: ${cwd}` : "",
              "",
              "3. Report final status (async: from `control_run_status` / callback; sync: from `control_agent` response), timed_out, and a short output summary via slices or stderr. Warn if the run failed.",
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
      title: "Resume CLI from a saved disk session",
      description: "control_disk_to_cli then control_agent.",
      argsSchema: {
        disk_id: z
          .string()
          .min(1)
          .describe("Exact sessions[].id for a Cursor row"),
        follow_up_prompt: z.string().min(1),
      },
    },
    async ({ disk_id, follow_up_prompt }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Bridge disk → CLI for Cursor.",
              "",
              `1. Call \`control_disk_to_cli\` with id=\`${disk_id}\`.`,
              "2. If `uuid` is non-null, call `control_agent` with that `resume` and prompt = follow-up (defaults: trust + approve_mcp on, sandbox off).",
              "3. If `uuid` is null, explain no composerId; suggest `control_chat_new` or inspect `keys`.",
              "",
              `Follow-up: ${follow_up_prompt}`,
            ].join("\n"),
          },
        },
      ],
    })
  );
}

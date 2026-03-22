import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  RESOURCE_AGENT_STREAMING,
  RESOURCE_GUIDE_TUNNEL,
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

  mcp.registerResource(
    "guide-http-tunnel",
    "poke-agents://guide/http-tunnel",
    {
      mimeType: MIME,
      description: "HTTP MCP, poke tunnel, proxy timeouts / 502",
    },
    async () => ({
      contents: [
        {
          uri: "poke-agents://guide/http-tunnel",
          mimeType: MIME,
          text: RESOURCE_GUIDE_TUNNEL,
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
              "**Control path (CLI):** No `provider` on tools — set **`POKE_AGENTS_CONTROL`** to **`cursor`** (default, Cursor `agent -p`), **`opencode`** (`opencode run`), or **`codex`** (`codex exec`). Call **`control_plan`** for `active_control`, binaries, and env. **`control_agent`** **always** returns immediately with **`run_id`** — read **`poke_completion_notice`** and **`will_post_completion_to_poke`** in the structured result: Poke is **pinged when the CLI exits** if **`will_post_completion_to_poke`** is true (HTTP **`X-Poke-Callback-Url`** + **`X-Poke-Callback-Token`** or stdio **`poke_callback_*`**). Otherwise poll **`control_run_status`** / **`control_run_output_slice`**. Optional **`agent_template`**: template **`id`** from **`agent_templates`** (`list`) prepends **`promptPreamble`**. **Cursor:** **`trust`** (default) = workspace trust only; for prompts that must **run shell commands**, set **`force: true`**. **`approve_mcp`** = MCP servers, not shell. Omit **`mode`** / **`plan`** for normal coding. Codex: see `control_plan` for `sandbox`/`force`. Map disk → **`resume`** with **`control_disk_to_cli`**.",
              "",
              "**Agent templates:** **`agent_templates`** MCP tool (`list` / `upsert` / `delete`) and dashboard **`/templates`**. Custom data lives in **`~/.poke-agents/agent-templates.json`** (optional **`POKE_AGENTS_TEMPLATES_PATH`**) — it survives **`npx`** and package upgrades.",
              "",
              "**Transparency:** On failure read `error_classification`, `cursor_stderr_message`, and captured stderr via `control_run_output_slice` after the run ends — not just `hint`.",
              "",
              "**Large transcripts:** Prefer `control_chat_slice`, `control_chat_tail`, or `control_chat_around` over loading the full `session` tool when threads are huge.",
              "",
              "**HTTP / tunnel:** Each MCP tool call over HTTP must return before the client’s timeout. Proxies (e.g. poke tunnel) may return **502** if a handler is slow — **`control_agent` is not the culprit** (it returns immediately); watch **`session`** and **`control_session_meta` with count**. Resource: `poke-agents://guide/http-tunnel` or `poke_agents_guide` topic **`tunnel`**.",
              "",
              "**Streaming:** `format: stream-json` and `stream: true` → NDJSON on captured stdout; use `control_run_output_slice` after completion or read `stream_json_event_count` on the Poke callback. Resource: `poke-agents://guide/agent-streaming`.",
              "",
              "**HTTP / search:** Not on poke-agents — use **Poke’s** native fetch/search (or your orchestrator’s), then pass excerpts into **`control_agent.prompt`**. The headless Cursor CLI has no GUI browser; with sandbox off the agent may use shell or other MCPs.",
              "",
              "**Resources:** `poke-agents://guide/tools-read`, `.../tools-control`, `.../session-ids`, `.../agent-streaming`, `.../http-tunnel`. If the client cannot read resources/prompts, call **`poke_agents_guide`** (`topic`: `overview`, `control`, `tunnel`, `all`, …) for the same material as markdown in structured output.",
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
      title: "Run headless agent (Cursor, OpenCode, or Codex)",
      description: "Check CLI (active backend from POKE_AGENTS_CONTROL), then control_agent.",
      argsSchema: {
        goal: z.string().min(1).describe("Single instruction for the agent"),
        cwd: z.string().optional().describe("Absolute project path"),
        agent_template: z
          .string()
          .optional()
          .describe("Optional template id from agent_templates list (prepends promptPreamble)"),
        resume_uuid: z
          .string()
          .optional()
          .describe("CLI uuid from a prior control_agent resume_uuid; omit to start a new CLI chat"),
        use_continue: z
          .boolean()
          .optional()
          .describe("If true, pass continue_chat: true instead of resume"),
      },
    },
    async ({ goal, cwd, agent_template, resume_uuid, use_continue }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "Run a **headless agent** task via poke-agents. Active CLI: **`POKE_AGENTS_CONTROL`** (`cursor` = Cursor `agent`, `opencode` = `opencode run`, `codex` = `codex exec`).",
              "",
              "1. Call `control_plan` if needed; call `control_agent_check` to verify the CLI.",
              agent_template
                ? `Optional: confirm template via \`agent_templates\` list — you will use agent_template: "${agent_template}".`
                : "Optional: call `agent_templates` list if you want a persona via `agent_template` + `prompt`.",
              use_continue
                ? `2. Call \`control_agent\` with prompt = goal, continue_chat: true${agent_template ? `, agent_template: "${agent_template}"` : ""}, optional cwd. If the goal requires **running terminal commands** (Cursor), set \`force: true\`. Wait for the Poke callback or poll \`control_run_status\`; read output with \`control_run_output_slice\` — not the immediate \`control_agent\` response.`
                : resume_uuid
                  ? `2. Call \`control_agent\` with resume="${resume_uuid}", prompt = goal${agent_template ? `, agent_template: "${agent_template}"` : ""}, optional cwd; add \`force: true\` (Cursor) if shell execution is required. Then callback or poll + output slices.`
                  : `2. Call \`control_agent\` with prompt = goal${agent_template ? `, agent_template: "${agent_template}"` : ""} (omit \`resume\` / \`continue_chat\` for a new CLI session). Cursor: use \`force: true\` when the user wants real command execution. Poll \`control_run_status\` + \`control_run_output_slice\` for results.`,
              "",
              `Goal: ${goal}`,
              cwd ? `cwd: ${cwd}` : "",
              agent_template ? `agent_template: ${agent_template}` : "",
              "",
              "3. Report final status from the Poke callback or `control_run_status`, timed_out, and a short output summary via slices or stderr. Warn if the run failed.",
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
          .describe("Exact sessions[].id from sessions (any editor row with composerId)"),
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
              "3. If `uuid` is null, explain no composerId; suggest `control_agent` without `resume` to start a new CLI chat, or inspect `keys`.",
              "",
              `Follow-up: ${follow_up_prompt}`,
            ].join("\n"),
          },
        },
      ],
    })
  );
}

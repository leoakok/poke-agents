import * as z from "zod/v4";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const cwdOptional = z
  .string()
  .optional()
  .describe("Repo cwd for the CLI; default = MCP process cwd.");

/** Opaque id from `sessions` tool: `{source}:{base64url(JSON)}`. */
export const diskSessionId = z
  .string()
  .min(1)
  .describe("Exact `sessions[].id` (opaque disk ref).");

// ---------------------------------------------------------------------------
// Read tools — copy
// ---------------------------------------------------------------------------

export const READ = {
  adapters: {
    title: "Adapters (profile + health)",
    description:
      "Which storage adapters are enabled (`POKE_AGENTS_EDITORS`) and whether each can read local data now. Call before `sessions` if something looks misconfigured.",
  },
  sessions: {
    title: "Sessions (disk)",
    description:
      "Recent saved chats, newest first. `id` is opaque—pass unchanged to `session` or disk-aware control tools. Filter with `editor` and/or `folder` when needed.",
  },
  session: {
    title: "Transcript (disk)",
    description:
      "Full message list for one `sessions[].id`. On failure, `ok: false` and `error` explains invalid id or parse errors. **Orchestrators:** large threads can make this call slow — HTTP MCP clients (e.g. poke tunnel) may hit proxy timeouts; prefer `control_chat_slice` / `control_chat_tail` / `control_chat_around` for bounded windows.",
  },
  agent_templates: {
    title: "Agent templates (disk)",
    description:
      "List or mutate templates in ~/.poke-agents/agent-templates.json (merged with built-ins). Survives `npx` and package updates — only this file + optional POKE_AGENTS_TEMPLATES_PATH change. Poke and the dashboard use the same store. Upsert overrides a built-in when ids match. Delete removes a custom row or clears a built-in override.",
  },
} as const;

// ---------------------------------------------------------------------------
// Guide tool — copy (orchestrators without resources/prompts)
// ---------------------------------------------------------------------------

export const GUIDE = {
  poke_agents_guide: {
    title: "Orchestrator guide (markdown)",
    description:
      "How poke-agents tools fit together: read vs control, ids, streaming, templates, HTTP/tunnel timeouts, and MCP prompt names. Call first when the client cannot list MCP resources or prompts (e.g. Poke). Parameter `topic` selects a section; omit or `overview` for the index; `all` returns the full guide.",
  },
} as const;

export const pokeAgentsGuideInput = {
  topic: z
    .string()
    .optional()
    .describe(
      "Guide section: `overview` (default), `read`, `control`, `session_ids`, `streaming`, `tunnel`, `templates`, `prompts`, or `all` (full manual). Unknown values are treated as `overview`.",
    ),
};

export const pokeAgentsGuideOutputShape = {
  ok: z.literal(true),
  topic: z.string(),
  markdown: z.string(),
  topics: z
    .array(z.string())
    .describe("Valid `topic` values for follow-up `poke_agents_guide` calls."),
};

// ---------------------------------------------------------------------------
// Read — inputs
// ---------------------------------------------------------------------------

export const sessionsInput = {
  editor: z
    .string()
    .optional()
    .describe("Filter: `chat.source` or owning adapter name (e.g. cursor, opencode)."),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe("Max rows after merge (default 50, cap 500)."),
  folder: z
    .string()
    .optional()
    .describe("Substring match on workspace path when the adapter stores it."),
};

export const sessionInput = {
  id: diskSessionId,
};

// ---------------------------------------------------------------------------
// Read — outputs
// ---------------------------------------------------------------------------

const connectorRow = z.object({
  id: z.string(),
  display_name: z.string(),
  available: z.boolean(),
  detail: z.string().optional(),
});

const sessionRow = z.object({
  id: z.string().describe("Opaque: pass to `session` or disk control tools."),
  source: z.string(),
  title: z.string().optional(),
  last_updated_at: z.string().optional(),
  project_path: z.string().optional(),
});

const messageRow = z.object({
  role: z.enum(["user", "assistant", "system", "unknown"]),
  content: z.string(),
  model: z.string().optional(),
});

const sessionBlock = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string().optional(),
  project_path: z.string().optional(),
  last_updated_at: z.string().optional(),
});

export const adaptersOutput = {
  ok: z.literal(true),
  connectors: z.array(connectorRow),
  editors: z.array(z.string()).describe("Effective POKE_AGENTS_EDITORS list."),
};

export const sessionsOutput = {
  ok: z.literal(true),
  sessions: z.array(sessionRow),
};

export const sessionOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  session: sessionBlock.optional(),
  messages: z.array(messageRow).optional(),
};

// ---------------------------------------------------------------------------
// Control — copy
// ---------------------------------------------------------------------------

export const CONTROL = {
  plan: {
    title: "Integration contract",
    description:
      "**Read-only metadata** for orchestrators: no side effects, does not run the CLI or call Poke. Returns provider feature matrix, disk vs CLI id rules, env vars, `orchestration` (HTTP/tunnel timeouts, async `control_agent`, transcript pagination), and `session_stop` (CLI cannot cancel in-flight runs). Call once at startup or when wiring a client.",
  },
  agent: {
    title: "Headless agent",
    description:
      "Runs the configured headless CLI (**`POKE_AGENTS_CONTROL`**: `cursor` = Cursor `agent -p`, `opencode` = `opencode run`, `codex` = `codex exec`) and **always** returns immediately with `run_id`. No `provider` argument — switch backends with env only. Optional **`agent_template`**: `id` from **`agent_templates`** (action `list`) — prepends that template's `promptPreamble` to `prompt`. **Cursor new session:** omit `resume`/`continue_chat` → `create-chat` then background run. **OpenCode / Codex new session:** omit `resume`/`continue_chat` → fresh run; session/thread id appears in JSON stdout and/or the Poke completion callback after the CLI exits. **Completion:** Poke callback headers or `poke_callback_*` tool args; optional `control_run_status` / `control_run_output_slice`. Cursor-only defaults: `trust`, `approve_mcp`, `sandbox`. Codex: `sandbox`/`force` map to exec flags; see `control_plan.providers`. Auth: `CURSOR_API_KEY` (Cursor) / `opencode auth` (OpenCode) / `codex login` (Codex).",
  },
  agent_check: {
    title: "CLI check",
    description:
      "Sanity-check the active control CLI (`POKE_AGENTS_CONTROL`): Cursor → `agent about` + `agent status`; OpenCode → `opencode --version` + `opencode auth list`; Codex → `codex --version` + `codex login status`.",
  },
  session_meta: {
    title: "Disk session metadata",
    description:
      "Decode a `sessions[].id` without loading the full thread unless `count: true` (slow on huge chats). Adapter is inferred from the row.",
  },
  disk_to_cli: {
    title: "Disk id → headless resume id",
    description:
      "Reads `composerId` from the disk snapshot (Cursor, OpenCode, Codex, …) → pass as `control_agent.resume`. If null, start a new headless session without `resume` or inspect `keys`.",
  },
  run_status: {
    title: "Async run status",
    description: "Lifecycle and exit metadata for a `run_id` from `control_agent`.",
  },
  run_output_slice: {
    title: "Async run output slice",
    description:
      "Read a window of captured stdout/stderr for a `run_id` (bounded storage; tail preserved). Use offsets from prior `next_offset`.",
  },
  chat_slice: {
    title: "Transcript slice (disk)",
    description:
      "Paginate `session` messages by offset/limit without loading the full list in one tool result (still loads transcript server-side).",
  },
  chat_tail: {
    title: "Transcript tail (disk)",
    description: "Last N messages of a disk session transcript.",
  },
  chat_around: {
    title: "Transcript window around index (disk)",
    description:
      "Messages around a 0-based message index (same order as `session`).",
  },
} as const;

export const pokeCallbackFields = {
  poke_callback_url: z
    .string()
    .url()
    .optional()
    .describe(
      "Poke callback URL when not using HTTP MCP headers (e.g. stdio). Must pair with `poke_callback_token`.",
    ),
  poke_callback_token: z
    .string()
    .optional()
    .describe("Bearer token for `poke_callback_url`."),
};

export const controlAgentInput = {
  prompt: z
    .string()
    .min(1)
    .describe(
      "Instruction for the headless CLI (after any `agent_template` preamble). Active CLI is **`POKE_AGENTS_CONTROL`**: Cursor `agent -p`, OpenCode `opencode run`, or Codex `codex exec`.",
    ),
  agent_template: z
    .string()
    .optional()
    .describe(
      "Optional template `id` from **`agent_templates`** (`action: list`). Prepends that row's `promptPreamble` to `prompt` before running the CLI.",
    ),
  cwd: cwdOptional,
  workspace: z
    .string()
    .optional()
    .describe(
      "Cursor: `--workspace` (resolved vs `cwd`). OpenCode / Codex: subdirectory under `cwd` used as the run working directory (`--cd` for Codex).",
    ),
  resume: z
    .string()
    .optional()
    .describe(
      "Continue an existing headless session: Cursor uuid (`--resume`); OpenCode `ses_…` (`--session`); Codex thread uuid (`codex exec resume <id>`). **Omit** `resume` and `continue_chat` to start **new**. Map disk rows with `control_disk_to_cli`.",
    ),
  continue_chat: z
    .boolean()
    .optional()
    .describe(
      "Cursor: `--continue`. OpenCode: `--continue` (last session). Codex: `exec resume --last`. Ignored when `resume` is set.",
    ),
  format: z
    .enum(["text", "json", "stream-json"])
    .optional()
    .default("text")
    .describe(
      "Cursor: `--output-format`. OpenCode: `json` / `stream-json` → `--format json`. Codex: `json` / `stream-json` → `--json` (JSONL).",
    ),
  stream: z
    .boolean()
    .optional()
    .describe("Cursor only: with `stream-json`, `--stream-partial-output`."),
  model: z
    .string()
    .optional()
    .describe("Cursor: `--model`. OpenCode: `-m` provider/model. Codex: `-m`."),
  mode: z.enum(["plan", "ask"]).optional().describe("Cursor only: read-only modes."),
  plan: z.boolean().optional().describe("Cursor only: `--plan` when true."),
  trust: z
    .boolean()
    .optional()
    .default(true)
    .describe("Cursor only: `--trust` (default true)."),
  force: z
    .boolean()
    .optional()
    .describe("Cursor: `--force`. Codex: `--dangerously-bypass-approvals-and-sandbox`."),
  approve_mcp: z
    .boolean()
    .optional()
    .default(true)
    .describe("Cursor only: `--approve-mcps` (default true)."),
  sandbox: z
    .enum(["enabled", "disabled"])
    .optional()
    .default("disabled")
    .describe(
      "Cursor: `--sandbox` (default disabled). Codex: when disabled (default), passes `--full-auto`; when enabled, omits `--full-auto` / bypass for stricter defaults.",
    ),
  cloud: z.boolean().optional().describe("Cursor only: `--cloud`."),
  ...pokeCallbackFields,
};

export const controlRunStatusInput = {
  run_id: z.string().min(1).describe("`run_id` from `control_agent`."),
};

export const controlRunOutputSliceInput = {
  run_id: z.string().min(1),
  stream: z
    .enum(["stdout", "stderr"])
    .describe("Which captured stream to read."),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("Character offset into the captured stream."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500_000)
    .optional()
    .default(8_000)
    .describe("Max UTF-16 code units to return."),
};

export const controlChatSliceInput = {
  id: diskSessionId,
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe("0-based message index to start from."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("Max messages to return."),
};

export const controlChatTailInput = {
  id: diskSessionId,
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(30)
    .describe("Last N messages."),
};

export const controlChatAroundInput = {
  id: diskSessionId,
  index: z
    .number()
    .int()
    .min(0)
    .describe("0-based message index anchor (same order as `session`)."),
  before: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .default(5)
    .describe("Messages to include before anchor (not including anchor)."),
  after: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .default(5)
    .describe("Messages to include after anchor (including anchor at start of window)."),
};

export const controlAgentCheckInput = {
  cwd: cwdOptional,
};

export const controlSessionMetaInput = {
  id: diskSessionId,
  count: z
    .boolean()
    .optional()
    .describe("If true, load full transcript to compute `message_count`."),
};

export const controlDiskToCliInput = {
  id: diskSessionId.describe("`sessions[].id` — returns native session id for `control_agent.resume` when present."),
};

// ---------------------------------------------------------------------------
// Control — outputs
// ---------------------------------------------------------------------------

export const controlPlanOutputShape = {
  providers: z.array(z.unknown()),
  /** Which CLI `control_agent` uses (`POKE_AGENTS_CONTROL`, default `cursor`). */
  active_control: z.enum(["cursor", "opencode", "codex"]),
  cursor_agent_binary: z.string(),
  opencode_cli_binary: z.string(),
  codex_cli_binary: z.string(),
  orchestration: z
    .object({
      http_mcp_and_tunnel: z.string(),
      control_agent: z.string(),
      large_disk_transcripts: z.string(),
      network_bound_tools: z.string(),
    })
    .describe(
      "How to orchestrate without MCP HTTP timeouts (tunnel/proxy 502): async agent runs, paginated disk transcripts.",
    ),
  session_ids: z.record(z.string(), z.string()),
  env: z.record(z.string(), z.string()),
  session_stop: z
    .object({
      supported: z.literal(false),
      note: z.string(),
    })
    .describe("Stopping an in-flight headless CLI run is not exposed as an MCP feature."),
};

const cursorAgentErrorClassification = z.enum([
  "auth",
  "rate_limit",
  "network_tls",
  "network_unreachable",
  "cursor_unavailable",
  "session_headless",
  "timeout",
  "permission_denied",
  "unknown",
]);

export const controlAgentOutputShape = {
  ok: z.boolean(),
  accepted: z.boolean().optional(),
  status: z
    .enum(["started", "failed_to_start"])
    .optional()
    .describe("Immediate lifecycle for this call."),
  run_id: z.string().optional(),
  callback_registered: z
    .boolean()
    .optional()
    .describe(
      "True if a Poke callback URL+token was available for the completion ping.",
    ),
  backend: z.enum(["cursor", "opencode", "codex"]),
  cwd: z.string().optional(),
  resume_uuid: z
    .string()
    .optional()
    .describe("Session id for the next `resume` (Cursor uuid, OpenCode `ses_…`, or Codex thread uuid)."),
  auto_created_cli_chat_uuid: z
    .string()
    .optional()
    .describe("Cursor only: new chat id from `create-chat` (same as `resume_uuid` for that turn)."),
  error: z.string().optional(),
  hint: z.string().optional(),
  error_classification: cursorAgentErrorClassification.optional(),
  cursor_stderr_message: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  agent_template: z
    .string()
    .optional()
    .describe("Echoed when `agent_template` was applied."),
  agent_template_title: z
    .string()
    .optional()
    .describe("Human title for the applied template."),
};

export const controlRunStatusOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  run_id: z.string().optional(),
  status: z
    .enum(["started", "running", "completed", "failed", "failed_to_start"])
    .optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  backend: z.string().optional(),
  cwd: z.string().optional(),
  prompt_preview: z.string().optional(),
  resume_uuid: z.string().optional(),
  auto_created_cli_chat_uuid: z.string().optional(),
  pid: z.number().nullable().optional(),
  exit_code: z.number().nullable().optional(),
  signal: z.string().nullable().optional(),
  timed_out: z.boolean().optional(),
  stdout_length: z.number().optional(),
  stderr_length: z.number().optional(),
  format: z.string().optional(),
  run_error: z.string().optional(),
};

export const controlRunOutputSliceOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  run_id: z.string().optional(),
  stream: z.enum(["stdout", "stderr"]).optional(),
  offset: z.number().optional(),
  limit: z.number().optional(),
  total_length: z.number().optional(),
  next_offset: z.number().optional(),
  text: z.string().optional(),
  truncated: z.boolean().optional(),
};

export const controlChatSliceOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  session: sessionBlock.optional(),
  messages: z.array(messageRow).optional(),
  offset: z.number().optional(),
  total_count: z.number().optional(),
  truncated: z.boolean().optional(),
};

export const controlAgentCheckOutputShape = {
  ok: z.boolean(),
  backend: z.enum(["cursor", "opencode", "codex"]),
  cwd: z.string().optional(),
  binary: z.string().optional(),
  about: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
};

export const controlSessionMetaOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  adapter: z.string().optional(),
  session: sessionBlock.optional(),
  message_count: z.number().nullable().optional(),
  message_count_error: z.string().optional(),
};

export const controlDiskToCliOutputShape = {
  ok: z.boolean(),
  id: z.string().optional(),
  uuid: z
    .string()
    .nullable()
    .optional()
    .describe("CLI chat id for `control_agent.resume` when non-null."),
  keys: z.array(z.string()).optional(),
  hint: z.string().optional(),
  error: z.string().optional(),
};

const agentTemplateRow = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  promptPreamble: z.string(),
  pokeHint: z.string(),
  built_in: z.boolean().optional(),
  has_local_override: z
    .boolean()
    .optional()
    .describe("True when this id exists in the custom JSON file (custom-only or override of a built-in)."),
});

export const agentTemplatesInput = {
  action: z
    .enum(["list", "upsert", "delete"])
    .describe("list: merged templates; upsert: save custom; delete: remove custom by id."),
  template: agentTemplateRow
    .omit({ built_in: true })
    .optional()
    .describe("Required for upsert (id + fields)."),
  delete_id: z
    .string()
    .optional()
    .describe(
      "Required for delete. Removes the row from custom storage. For built-in ids, deletes your override only (reverts to the shipped default).",
    ),
};

export const agentTemplatesOutputShape = {
  ok: z.boolean(),
  templates: z.array(agentTemplateRow).optional(),
  storage_path: z.string().optional(),
  built_in_ids: z.array(z.string()).optional(),
  error: z.string().optional(),
};

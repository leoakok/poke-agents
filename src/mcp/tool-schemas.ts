import * as z from "zod/v4";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const providerParam = z.enum(["cursor", "opencode"]).describe(
  "`cursor`: runs the Agent CLI. `opencode`: control tools stub; disk reads still work when listed in POKE_AGENTS_EDITORS."
);

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
      "Full message list for one `sessions[].id`. On failure, `ok: false` and `error` explains invalid id or parse errors.",
  },
  agent_templates: {
    title: "Agent templates (disk)",
    description:
      "List or mutate custom agent persona templates stored in ~/.poke-agents/agent-templates.json (merged with built-ins). Poke can upsert templates for the dashboard.",
  },
} as const;

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
      "Feature matrix per provider, disk vs CLI id rules, env vars, and why in-flight runs cannot be stopped via CLI.",
  },
  chat_new: {
    title: "New CLI chat (Cursor)",
    description:
      "Empty chat via `agent create-chat` → `uuid` for `control_agent.resume`. Needs `agent` on PATH or POKE_AGENTS_CURSOR_AGENT_BIN.",
  },
  agent: {
    title: "Headless agent (Cursor)",
    description:
      "`agent -p` with optional `resume` (CLI uuid), `continue_chat` (--continue), model/mode/trust/MCP/sandbox flags. Default `auto_chat: true` runs `create-chat` when neither `resume` nor `continue_chat` is set (one-shot headless). Defaults: `trust: true`, `approve_mcp: true`, `sandbox: \"disabled\"` so headless runs are unattended and can use network/shell (set `sandbox: \"enabled\"` to isolate). Use `format: stream-json` + `stream: true` for progressive JSON lines in stdout and `stream_json_events`. Bounded by POKE_AGENTS_AGENT_TIMEOUT_MS. The parent MCP still has `web_fetch` / `web_search` for HTTP — the CLI cannot open a GUI browser.",
  },
  agent_check: {
    title: "CLI identity",
    description: "Non-interactive `agent about` + `agent status` before spending tokens.",
  },
  session_meta: {
    title: "Disk session metadata",
    description:
      "Decode a `sessions[].id` without loading the full thread unless `count: true` (slow on huge chats). `provider` must match the row’s adapter.",
  },
  disk_to_cli: {
    title: "Disk id → CLI resume uuid",
    description:
      "Cursor rows: read `composerId` when present → use as `control_agent.resume`. If null, `control_chat_new` or inspect `keys`.",
  },
  agent_start: {
    title: "Headless agent async start (Cursor)",
    description:
      "Same as `control_agent` but returns immediately with `run_id` while `agent -p` runs in the background. Poll `control_run_status` / `control_run_output_slice`. If Poke sends `X-Poke-Callback-Url` + `X-Poke-Callback-Token` (HTTP MCP) or you pass `poke_callback_url` + `poke_callback_token`, a final small JSON ping is sent when the run completes or fails.",
  },
  run_status: {
    title: "Async run status",
    description: "Lifecycle and exit metadata for a `run_id` from `control_agent_start`.",
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

export const WEB = {
  fetch: {
    title: "HTTP GET (dev)",
    description:
      "Fetch a URL with transparent errors (TLS, DNS, timeout). Body is UTF-8 text preview; many sites block server-side clients.",
  },
  search: {
    title: "Web search (Brave)",
    description:
      "Search the public web via Brave Search API. Requires POKE_AGENTS_BRAVE_API_KEY or BRAVE_API_KEY. Prefer this from the orchestrator (Poke); the headless Cursor CLI has no GUI browser — pair with `control_agent` after `sandbox: \"disabled\"` for shell/curl if needed.",
  },
} as const;

export const controlChatNewInput = {
  provider: providerParam,
  cwd: cwdOptional,
};

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
  provider: providerParam,
  prompt: z.string().min(1).describe("Instruction for `agent -p`."),
  cwd: cwdOptional,
  resume: z
    .string()
    .optional()
    .describe("CLI chat uuid (`--resume`). Not a disk `sessions[].id` unless it is literally a uuid."),
  continue_chat: z
    .boolean()
    .optional()
    .describe("`--continue`: reuse last CLI context (separate from `resume`)."),
  format: z
    .enum(["text", "json", "stream-json"])
    .optional()
    .default("text")
    .describe("`--output-format`."),
  stream: z
    .boolean()
    .optional()
    .describe("With stream-json: `--stream-partial-output`."),
  model: z.string().optional().describe("`--model`."),
  mode: z.enum(["plan", "ask"]).optional().describe("Read-only modes; omit for default edit-capable run."),
  plan: z.boolean().optional().describe("Shorthand `--plan` when true."),
  trust: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "`--trust` — default **true** for headless runs (no workspace trust prompt). Set **false** only if you rely on interactive trust.",
    ),
  force: z.boolean().optional().describe("`--force` / yolo where policy allows."),
  approve_mcp: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "`--approve-mcps` — default **true** so MCP servers are auto-approved in `-p` mode.",
    ),
  sandbox: z
    .enum(["enabled", "disabled"])
    .optional()
    .default("disabled")
    .describe(
      "`--sandbox` — default **disabled** so the agent can use network and shell (sandbox **enabled** is Cursor’s stricter mode and often blocks internet).",
    ),
  cloud: z.boolean().optional().describe("`--cloud`."),
  auto_chat: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "When true (default) and neither `resume` nor `continue_chat` is set, run `agent create-chat` first and pass the new uuid as `--resume` so one-shot headless runs work without `control_chat_new`. Set false to preserve legacy no-session behavior.",
    ),
};

export const controlAgentStartInput = {
  ...controlAgentInput,
  ...pokeCallbackFields,
};

export const controlRunStatusInput = {
  run_id: z.string().min(1).describe("`run_id` from `control_agent_start`."),
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
  provider: providerParam,
  cwd: cwdOptional,
};

export const controlSessionMetaInput = {
  provider: providerParam.describe("Must match the session row’s adapter (cursor vs opencode)."),
  id: diskSessionId,
  count: z
    .boolean()
    .optional()
    .describe("If true, load full transcript to compute `message_count`."),
};

export const controlDiskToCliInput = {
  id: diskSessionId.describe("Cursor `sessions[].id`."),
};

// ---------------------------------------------------------------------------
// Control — outputs
// ---------------------------------------------------------------------------

export const controlPlanOutputShape = {
  providers: z.array(z.unknown()),
  cursor_agent_binary: z.string(),
  session_ids: z.record(z.string(), z.string()),
  env: z.record(z.string(), z.string()),
  session_stop: z
    .object({
      supported: z.literal(false),
      note: z.string(),
    })
    .describe("Stopping an in-flight `agent -p` is not a CLI feature."),
};

export const controlChatNewOutputShape = {
  ok: z.boolean(),
  provider: z.enum(["cursor", "opencode"]),
  cwd: z.string().optional(),
  uuid: z
    .string()
    .optional()
    .describe("Pass as `resume` in `control_agent` when ok."),
  hint: z.string().optional(),
  binary: z.string().optional(),
  error: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
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
  provider: z.enum(["cursor", "opencode"]),
  cwd: z.string().optional(),
  exit_code: z.number().nullable().optional(),
  signal: z.string().nullable().optional(),
  timed_out: z.boolean().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  hint: z
    .string()
    .optional()
    .describe("Actionable context; also see `cursor_stderr_message` + `error_classification`."),
  error_classification: cursorAgentErrorClassification
    .optional()
    .describe("Structured bucket for stderr (auth, rate_limit, network, …)."),
  cursor_stderr_message: z
    .string()
    .optional()
    .describe("Primary error line from Cursor (verbatim when possible)."),
  stream_json_events: z
    .array(z.unknown())
    .optional()
    .describe("Parsed NDJSON lines when `format` was `stream-json`."),
  stream_json_truncated: z
    .boolean()
    .optional()
    .describe("True if more stream lines existed than returned."),
  auto_created_cli_chat_uuid: z
    .string()
    .optional()
    .describe("Set when `auto_chat` created a session for this run."),
  error: z.string().optional(),
};

export const controlAgentStartOutputShape = {
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
    .describe("True if a Poke callback URL+token was available for completion ping."),
  provider: z.enum(["cursor", "opencode"]),
  cwd: z.string().optional(),
  resume_uuid: z.string().optional(),
  auto_created_cli_chat_uuid: z.string().optional(),
  error: z.string().optional(),
  hint: z.string().optional(),
  error_classification: cursorAgentErrorClassification.optional(),
  cursor_stderr_message: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
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
  provider: z.string().optional(),
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
  provider: z.enum(["cursor", "opencode"]),
  cwd: z.string().optional(),
  binary: z.string().optional(),
  about: z.string().optional(),
  status: z.string().optional(),
  error: z.string().optional(),
};

export const controlSessionMetaOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  provider: z.enum(["cursor", "opencode"]).optional(),
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

export const webFetchInput = {
  url: z.string().url().describe("Absolute http(s) URL to GET."),
  max_bytes: z
    .number()
    .int()
    .min(256)
    .max(2_000_000)
    .optional()
    .describe("Cap stored body preview (default 500_000)."),
  timeout_ms: z
    .number()
    .int()
    .min(1000)
    .max(120_000)
    .optional()
    .describe("Abort after this many ms (default 25_000)."),
};

export const webFetchOutputShape = {
  ok: z.boolean(),
  url: z.string().optional(),
  status: z.number().optional(),
  status_text: z.string().optional(),
  content_type: z.string().optional(),
  bytes_returned: z.number().optional(),
  body_truncated: z.boolean().optional(),
  body_preview: z.string().optional(),
  error: z.string().optional(),
  error_name: z.string().optional(),
  error_classification: z.string().optional(),
};

const webSearchResult = z.object({
  title: z.string().nullable(),
  url: z.string().nullable(),
  description: z.string().nullable(),
});

export const webSearchInput = {
  query: z.string().min(1).describe("Search query."),
  count: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe("Max results (default 8, cap 20)."),
};

export const webSearchOutputShape = {
  ok: z.boolean(),
  query: z.string().optional(),
  provider: z.string().optional(),
  results: z.array(webSearchResult).optional(),
  status: z.number().optional(),
  error: z.string().optional(),
  setup: z.string().optional(),
  body_preview: z.string().optional(),
  error_classification: z.string().optional(),
};

const agentTemplateRow = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  promptPreamble: z.string(),
  pokeHint: z.string(),
  built_in: z.boolean().optional(),
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
    .describe("Required for delete. Built-in ids are rejected."),
};

export const agentTemplatesOutputShape = {
  ok: z.boolean(),
  templates: z.array(agentTemplateRow).optional(),
  storage_path: z.string().optional(),
  built_in_ids: z.array(z.string()).optional(),
  error: z.string().optional(),
};

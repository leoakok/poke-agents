import * as z from "zod/v4";

// ---------------------------------------------------------------------------
// Shared parameter primitives
// ---------------------------------------------------------------------------

export const providerParam = z.enum(["cursor", "opencode"]).describe(
  "`cursor`: Cursor Agent CLI (`agent`) powers control tools. `opencode`: control tools are stubs until OpenCode CLI is wired; disk read tools still work when `opencode` is in POKE_AGENTS_EDITORS."
);

export const workspaceDirOptional = z
  .string()
  .optional()
  .describe(
    "Absolute path to the repository or folder the agent should use as its working directory and cwd for subprocesses. If omitted, the MCP server’s current working directory is used."
  );

export const listSessionsSessionId = z
  .string()
  .min(1)
  .describe(
    "Exact `sessions[].id` value from `list_sessions`: `{source}:{base64url(JSON)}` encoding the on-disk chat row."
  );

// ---------------------------------------------------------------------------
// Read tools — titles & descriptions (long-form for LLM routing)
// ---------------------------------------------------------------------------

export const READ = {
  list_connectors: {
    title: "List enabled agent adapters",
    description: [
      "Discover which coding-agent **storage adapters** are active in this MCP process and whether each can read local data right now.",
      "Uses `POKE_AGENTS_EDITORS` (default `cursor,opencode`). Each row is one bundled `editor.name` (e.g. `cursor`, `opencode`).",
      "Use this before `list_sessions` when you need to know what is configured or why an adapter might be failing (see `detail`).",
    ].join(" "),
  },
  list_sessions: {
    title: "List recent chat sessions (disk)",
    description: [
      "Return a merged, reverse-chronological list of **saved** chat sessions whose adapters are in `POKE_AGENTS_EDITORS`.",
      "Data comes from local databases/files only (no live CLI). `sessions[].id` is opaque—pass it unchanged to `get_session` or control tools that accept disk session ids.",
      "Filter with `source` (matches `chat.source` or parent editor id) or `project_path` when the adapter stores a folder path.",
    ].join(" "),
  },
  get_session: {
    title: "Load full chat transcript (disk)",
    description: [
      "Fetch **all messages** for one session previously returned by `list_sessions`.",
      "On failure, `ok` is false and `error` explains invalid id, profile mismatch, or parse errors.",
      "Messages are normalized (`role`, `content`, optional `model`); very large threads may be heavy.",
    ].join(" "),
  },
} as const;

// ---------------------------------------------------------------------------
// Read tools — input schemas
// ---------------------------------------------------------------------------

export const listSessionsInput = {
  source: z
    .string()
    .optional()
    .describe(
      "Restrict rows to this `chat.source` string (e.g. `cursor`, `opencode`) or to sessions owned by the editor whose `editor.name` matches (e.g. `claude` vs `claude-code`). Omit to include every adapter in the profile."
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe(
      "Maximum sessions to return after merge and sort (default 50). Cap is 500."
    ),
  project_path: z
    .string()
    .optional()
    .describe(
      "Substring or path match against `project_path` / workspace folder when the adapter exposes it (e.g. Cursor workspace folder)."
    ),
};

export const getSessionInput = {
  session_id: listSessionsSessionId,
};

// ---------------------------------------------------------------------------
// Read tools — output schemas (structuredContent)
// ---------------------------------------------------------------------------

const connectorRow = z.object({
  id: z.string().describe("Adapter id (`editor.name`)."),
  display_name: z.string().describe("Human label for UI or logs."),
  available: z
    .boolean()
    .describe("True if a probe `getChats()`-style call succeeded for this adapter."),
  detail: z
    .string()
    .optional()
    .describe("Error or diagnostic text when `available` is false."),
});

const sessionRow = z.object({
  id: z
    .string()
    .describe("Opaque id: pass to `get_session` or bridge tools."),
  source: z.string().describe("Product-specific `chat.source` string."),
  title: z.string().optional().describe("Session title when stored."),
  last_updated_at: z
    .string()
    .optional()
    .describe("ISO-8601 or adapter-provided timestamp string when known."),
  project_path: z
    .string()
    .optional()
    .describe("Workspace or project directory when the adapter exposes it."),
});

const messageRow = z.object({
  role: z.enum(["user", "assistant", "system", "unknown"]),
  content: z.string(),
  model: z.string().optional().describe("Model id when the adapter recorded it."),
});

const sessionBlock = z.object({
  id: z.string(),
  source: z.string(),
  title: z.string().optional(),
  project_path: z.string().optional(),
  last_updated_at: z.string().optional(),
});

export const listConnectorsOutput = {
  ok: z.literal(true).describe("Always true for this tool when the handler completes."),
  connectors: z
    .array(connectorRow)
    .describe("One object per adapter in the current profile, in registry order."),
  profile_editors: z
    .array(z.string())
    .describe("Effective `POKE_AGENTS_EDITORS` list for this process."),
};

export const listSessionsOutput = {
  ok: z.literal(true),
  sessions: z
    .array(sessionRow)
    .describe("Merged sessions after filters; newest first where timestamps exist."),
};

/** When `ok` is true, `session` and `messages` are set. When false, `error` is set. */
export const getSessionOutputShape = {
  ok: z
    .boolean()
    .describe("True when the transcript was loaded; false on invalid id, profile, or parse errors."),
  error: z
    .string()
    .optional()
    .describe("Present only when ok is false."),
  session: sessionBlock
    .optional()
    .describe("Present when ok is true: summary fields for the chat."),
  messages: z
    .array(messageRow)
    .optional()
    .describe("Present when ok is true: ordered transcript."),
};

// ---------------------------------------------------------------------------
// Control tools — copy & inputs
// ---------------------------------------------------------------------------

export const CONTROL = {
  capabilities: {
    title: "Control plane: capability matrix",
    description: [
      "Return a **machine-readable contract**: which `provider` values support create/run/status/stop, how Cursor session ids relate to CLI UUIDs, and which environment variables apply.",
      "Call once when integrating a new client or debugging “not implemented” responses for `opencode`.",
    ].join(" "),
  },
  create_session: {
    title: "Create empty CLI chat (Cursor)",
    description: [
      "Start a **new empty** Cursor Agent CLI chat and return its **UUID** for subsequent `control_run_agent.session_id` (`--resume`).",
      "Runs `agent create-chat` with cwd = `workspace` (or server cwd). Requires `agent` on PATH or `POKE_AGENTS_CURSOR_AGENT_BIN`.",
      "`opencode` returns `ok: false` until implemented.",
    ].join(" "),
  },
  run_agent: {
    title: "Run Cursor Agent headlessly",
    description: [
      "Execute **`agent -p`** (print / headless mode) with optional **resume** (`--resume` + CLI UUID), **continue** (`--continue`), model, mode, trust, and safety flags.",
      "`session_id` must be the **bare CLI chat id** from `control_create_session`, not the encoded `list_sessions` id (use `control_cursor_cli_chat_from_session` to try to map).",
      "Long runs are bounded by `POKE_AGENTS_AGENT_TIMEOUT_MS` (default 10 minutes). Check `exit_code`, `timed_out`, and `stderr` on failure.",
      "`opencode` returns `ok: false` until implemented.",
    ].join(" "),
  },
  cli_status: {
    title: "Cursor CLI auth and build info",
    description: [
      "Run **`agent about`** and **`agent status`** with non-interactive environment variables so output is suitable for logs.",
      "Use to verify login, CLI build, and default model before spending tokens on `control_run_agent`.",
      "`opencode` returns `ok: false` until implemented.",
    ].join(" "),
  },
  session_status: {
    title: "Session snapshot from disk id",
    description: [
      "Decode a **`list_sessions` id** and return **metadata** from the embedded chat row without loading the full transcript (unless `include_message_count` is true).",
      "`provider` must match the session’s adapter (`cursor` vs `opencode`). Session must be allowed by `POKE_AGENTS_EDITORS`.",
      "Setting `include_message_count` true loads the full message list to count—**can be slow** on huge threads.",
    ].join(" "),
  },
  stop_session: {
    title: "Stop session — capability notice",
    description: [
      "Document that **stopping an in-flight** Cursor `agent -p` process is **not** exposed by the CLI; callers must use OS signals or wait for completion.",
      "Always returns `supported: false` with guidance text—useful for routing logic without guessing.",
    ].join(" "),
  },
  cli_chat_from_session: {
    title: "Map disk session id → Cursor CLI chat id",
    description: [
      "Given a **`list_sessions` id** for Cursor, extract **`composerId`** when the stored row includes it—this value is often usable as `control_run_agent.session_id` (`--resume`).",
      "If `cli_chat_id` is null, create a fresh CLI chat with `control_create_session` or inspect `row_keys` for debugging.",
    ].join(" "),
  },
} as const;

export const controlCreateSessionInput = {
  provider: providerParam,
  workspace: workspaceDirOptional,
};

export const controlRunAgentInput = {
  provider: providerParam,
  prompt: z
    .string()
    .min(1)
    .describe(
      "User instruction sent to the agent as the print-mode prompt (equivalent to typing into the CLI)."
    ),
  workspace: workspaceDirOptional,
  session_id: z
    .string()
    .optional()
    .describe(
      "Cursor **CLI** chat UUID only. Passed as `--resume`. Not the `list_sessions` encoded id unless it happens to be a raw UUID from `control_create_session`."
    ),
  continue_session: z
    .boolean()
    .optional()
    .describe(
      "When true, passes `--continue` to resume the CLI’s previous session context (distinct from `--resume <uuid>`)."
    ),
  output_format: z
    .enum(["text", "json", "stream-json"])
    .optional()
    .default("text")
    .describe(
      "`--output-format` for agent stdout parsing: `json` or `stream-json` for machine consumption."
    ),
  stream_partial_output: z
    .boolean()
    .optional()
    .describe(
      "When true with `stream-json`, passes `--stream-partial-output` for incremental JSON events."
    ),
  model: z
    .string()
    .optional()
    .describe("Explicit model id (e.g. `gpt-5`, `sonnet-4`); passed as `--model`."),
  mode: z
    .enum(["plan", "ask"])
    .optional()
    .describe(
      "`plan`: read-only planning; `ask`: Q&A read-only. Omit for default agent mode with file edits allowed."
    ),
  plan: z
    .boolean()
    .optional()
    .describe("Shorthand for plan mode when true (`--plan`)."),
  trust: z
    .boolean()
    .optional()
    .describe(
      "Maps to `--trust`. **Recommended true** for unattended runs so the agent can access the workspace without an interactive trust prompt."
    ),
  force: z
    .boolean()
    .optional()
    .describe(
      "Maps to `--force` / yolo: auto-approve command execution where policy allows."
    ),
  approve_mcps: z
    .boolean()
    .optional()
    .describe("When true, passes `--approve-mcps` to auto-approve MCP servers."),
  sandbox: z
    .enum(["enabled", "disabled"])
    .optional()
    .describe("Override sandbox mode explicitly (`--sandbox`)."),
  cloud: z
    .boolean()
    .optional()
    .describe("When true, passes `--cloud` for cloud handoff flows."),
};

export const controlCliStatusInput = {
  provider: providerParam,
  workspace: workspaceDirOptional,
};

export const controlSessionStatusInput = {
  provider: providerParam.describe(
    "Must match the on-disk adapter for this session: use `cursor` for Cursor-backed rows, `opencode` for OpenCode-backed rows."
  ),
  session_id: listSessionsSessionId,
  include_message_count: z
    .boolean()
    .optional()
    .describe(
      "When true, loads the full transcript to compute `message_count` (expensive for large chats)."
    ),
};

export const controlStopInput = {
  provider: providerParam,
};

export const controlCliChatFromSessionInput = {
  session_id: listSessionsSessionId.describe(
    "A Cursor session id from `list_sessions` (source typically `cursor`)."
  ),
};

// ---------------------------------------------------------------------------
// Control tools — output schemas (single object + optional fields for MCP SDK)
// ---------------------------------------------------------------------------

/** Mirrors `controlCapabilitiesPayload()`: providers, binary path, session id notes, env table. */
export const controlCapabilitiesOutputShape = {
  providers: z.array(z.unknown()).describe("Per-provider feature matrix and notes."),
  cursor_agent_binary: z.string().describe("Resolved `agent` executable name or path."),
  session_ids: z
    .record(z.string(), z.string())
    .optional()
    .describe("Explains MCP disk id vs CLI UUID conventions."),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe("Environment variables that affect control tools."),
};

/** Success: ok true + chat_id. Failure: ok false + error (and optional stdout/stderr from CLI). */
export const controlCreateSessionOutputShape = {
  ok: z.boolean(),
  provider: z.enum(["cursor", "opencode"]),
  cwd: z.string().optional(),
  chat_id: z
    .string()
    .optional()
    .describe("CLI UUID for `control_run_agent.session_id` when ok is true."),
  hint: z.string().optional(),
  binary: z.string().optional().describe("Agent binary when present on failure diagnostics."),
  error: z.string().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
};

/** Cursor run result, or stub error for opencode (`ok` false, short error only). */
export const controlRunAgentOutputShape = {
  ok: z
    .boolean()
    .describe("True only for cursor when exit_code===0 and not timed_out."),
  provider: z.enum(["cursor", "opencode"]),
  cwd: z.string().optional(),
  exit_code: z
    .number()
    .nullable()
    .optional()
    .describe("Agent process exit code (cursor only)."),
  signal: z
    .string()
    .nullable()
    .optional()
    .describe("Signal name if terminated by signal (cursor only)."),
  timed_out: z
    .boolean()
    .optional()
    .describe("Whether the run hit POKE_AGENTS_AGENT_TIMEOUT_MS (cursor only)."),
  stdout: z.string().optional().describe("Agent stdout (cursor only)."),
  stderr: z.string().optional().describe("Agent stderr (cursor only)."),
  hint: z
    .string()
    .optional()
    .describe(
      "When ok is false, optional diagnosis (e.g. Cursor `[unavailable]` → auth/plan/network)."
    ),
  error: z.string().optional().describe("Stub not-implemented or spawn error summary."),
};

export const controlCliStatusOutputShape = {
  ok: z.boolean(),
  provider: z.enum(["cursor", "opencode"]),
  cwd: z.string().optional(),
  binary: z.string().optional(),
  about: z
    .string()
    .optional()
    .describe("`agent about` text when ok is true."),
  status: z
    .string()
    .optional()
    .describe("`agent status` text when ok is true."),
  error: z.string().optional(),
};

export const controlSessionStatusOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  provider: z.enum(["cursor", "opencode"]).optional(),
  adapter: z
    .string()
    .optional()
    .describe("Bundled editor name that owns this session."),
  session: sessionBlock.optional(),
  message_count: z
    .number()
    .nullable()
    .optional()
    .describe("null if not requested; number if computed; omit if ok false."),
  message_count_error: z
    .string()
    .optional()
    .describe("Set when include_message_count was true but loading failed."),
};

export const controlStopOutputShape = {
  ok: z.literal(false),
  supported: z.literal(false),
  provider: z.enum(["cursor", "opencode"]),
  guidance: z
    .string()
    .describe("What the user can do instead of a CLI stop command."),
};

export const controlCliChatFromSessionOutputShape = {
  ok: z.boolean(),
  session_id: z.string().optional(),
  cli_chat_id: z
    .string()
    .nullable()
    .optional()
    .describe("Value to pass as control_run_agent.session_id when non-null."),
  hint: z.string().optional(),
  row_keys: z.array(z.string()).optional(),
  error: z.string().optional(),
};

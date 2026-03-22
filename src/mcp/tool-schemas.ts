import * as z from "zod/v4";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export const cwdOptional = z
  .string()
  .optional()
  .describe(
    "Directory the CLI uses as its process cwd (default: MCP server’s cwd). Use an **absolute** path to the user’s repo when probing or running agents elsewhere. **`control_agent_check`** only needs this if you want the probe to run in a specific folder.",
  );

/** Opaque id from `sessions` tool: `{source}:{base64url(JSON)}`. */
export const diskSessionId = z
  .string()
  .min(1)
  .describe(
    "Exact **`sessions[].id`** from **`sessions`** — opaque string, do not construct by hand. Same value for **`session`**, **`control_chat_*`**, **`control_session_meta`**, **`control_disk_to_cli`**. **Not** a Cursor/OpenCode/Codex/Claude CLI uuid (use **`control_disk_to_cli`** or **`control_agent.resume_uuid`** for that).",
  );

// ---------------------------------------------------------------------------
// Read tools — copy
// ---------------------------------------------------------------------------

export const READ = {
  adapters: {
    title: "Adapters (profile + health)",
    description:
      "**No parameters.** Always lists **cursor**, **opencode**, **codex**, and **claude** disk adapters first (with **`available`** / **`detail`** / **`server_enabled`**), then any other editors in **`POKE_AGENTS_EDITORS`**. **`server_enabled: false`** means that id is not merged into **`sessions`** until you add it to the env and restart. Call **before `sessions`** when debugging empty lists.",
  },
  sessions: {
    title: "Sessions (disk)",
    description:
      "Merged list of **saved** chats on disk (not live CLI runs). Newest first. Each **`id`** is opaque — copy **exactly** into **`session`** or **`control_chat_*`**. Use **`editor`** / **`folder`** / **`limit`** to narrow; omit filters to browse. Does **not** return headless **`run_id`** or CLI resume ids.",
  },
  session: {
    title: "Transcript (disk)",
    description:
      "Loads the **full** message list for one **`sessions[].id`**. **Risk:** huge threads hold the MCP request open and can cause **HTTP/proxy timeouts** (e.g. poke tunnel). Prefer **`control_chat_slice`**, **`control_chat_tail`**, or **`control_chat_around`** for pagination. On parse/unknown id, **`ok: false`** + **`error`**.",
  },
  agent_templates: {
    title: "Agent templates (disk)",
    description:
      "**`action`:** **`list`** (merged built-ins + custom, `built_in_ids`, `has_local_override`), **`upsert`** (requires **`template`** object), **`delete`** (requires **`delete_id`**). Storage: **`~/.poke-agents/agent-templates.json`** or **`POKE_AGENTS_TEMPLATES_PATH`** — survives **`npx`** and upgrades. Upsert with same **`id`** as a built-in = local override. Delete on built-in id = remove override only.",
  },
} as const;

// ---------------------------------------------------------------------------
// Guide tool — copy (orchestrators without resources/prompts)
// ---------------------------------------------------------------------------

export const GUIDE = {
  poke_agents_guide: {
    title: "Orchestrator guide (markdown)",
    description:
      "Returns long-form markdown (same as MCP **resources** `poke-agents://guide/...`) for clients that cannot **`resources/read`**. Use **`topic`** to avoid loading everything: **`overview`** = index + quick start; **`read`** / **`control`** / **`session_ids`** / **`streaming`** / **`tunnel`** / **`templates`** / **`prompts`**; **`all`** = full manual (large). Unknown **`topic`** → **`overview`**.",
  },
} as const;

export const pokeAgentsGuideInput = {
  topic: z
    .string()
    .optional()
    .describe(
      "Section key: **`overview`** (default), **`read`**, **`control`**, **`session_ids`**, **`streaming`**, **`tunnel`**, **`templates`**, **`prompts`**, or **`all`**. Response includes **`topics`** array — use it for follow-up calls. Typos / unknown values fall back to **`overview`**.",
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
    .describe(
      "Restrict to one editor: matches **`chat.source`** or adapter id (e.g. **`cursor`**, **`opencode`**). Omit to include every allowed editor.",
    ),
  limit: z
    .number()
    .int()
    .positive()
    .max(500)
    .optional()
    .describe(
      "Max sessions after merge (default **50**, max **500**). Lower this when listing over slow HTTP MCP.",
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .max(999_999)
    .optional()
    .describe(
      "Skip this many rows after merge/sort (default **0**). Use with **`limit`** to page **`sessions`** without loading the full list.",
    ),
  folder: z
    .string()
    .optional()
    .describe(
      "Case-sensitive **substring** filter on **`project_path`** when the adapter stored a path. Omit to skip path filtering.",
    ),
};

export const sessionInput = {
  id: diskSessionId,
};

// ---------------------------------------------------------------------------
// Read — outputs
// ---------------------------------------------------------------------------

const connectorRow = z.object({
  id: z.string().describe("Stable adapter id (e.g. cursor, opencode, codex, claude)."),
  display_name: z.string().describe("Human label for UI."),
  available: z
    .boolean()
    .describe("False when the adapter cannot read storage now (see **detail**)."),
  detail: z
    .string()
    .optional()
    .describe("Why **available** is false or extra health context."),
  server_enabled: z
    .boolean()
    .optional()
    .describe(
      "When false, this **id** is not in **`POKE_AGENTS_EDITORS`** on the server — **`sessions`** will not merge it until the env is updated. Core editors (**cursor**, **opencode**, **codex**, **claude**) are always listed for discovery.",
    ),
});

const sessionRow = z.object({
  id: z
    .string()
    .describe(
      "Opaque disk id — pass unchanged to **`session`**, **`control_chat_*`**, **`control_session_meta`**, **`control_disk_to_cli`**.",
    ),
  source: z
    .string()
    .describe("Editor/source tag for the row (may differ slightly from adapter **id**)."),
  title: z.string().optional().describe("Chat title when the adapter stored one."),
  last_updated_at: z.string().optional().describe("ISO-ish timestamp when known."),
  project_path: z
    .string()
    .optional()
    .describe("Workspace path when the adapter stored it — use with **`sessions.folder`** filter."),
});

const messageRow = z.object({
  role: z
    .enum(["user", "assistant", "system", "unknown"])
    .describe("Speaker role; **unknown** when the adapter could not classify."),
  content: z.string().describe("Plain text body (format varies by editor)."),
  model: z.string().optional().describe("Model name when the snapshot recorded it."),
});

const sessionBlock = z.object({
  id: z.string().describe("Same opaque id as **`sessions[].id`**."),
  source: z.string(),
  title: z.string().optional(),
  project_path: z.string().optional(),
  last_updated_at: z.string().optional(),
});

export const adaptersOutput = {
  ok: z.literal(true),
  connectors: z
    .array(connectorRow)
    .describe(
      "Disk session adapters: **cursor**, **opencode**, **codex**, and **claude** always appear first, then any other **`POKE_AGENTS_EDITORS`** entries. Each row includes **server_enabled** when present.",
    ),
  editors: z
    .array(z.string())
    .describe(
      "Effective **`POKE_AGENTS_EDITORS`** allowlist (comma env → array). Only these editors are merged into **`sessions`**.",
    ),
};

export const sessionsOutput = {
  ok: z.literal(true),
  sessions: z
    .array(sessionRow)
    .describe("Merged, newest-first list (length ≤ **`limit`**)."),
  total_count: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe("Rows matching filters before pagination — use with **`has_more`**."),
  offset: z.number().int().nonnegative().optional(),
  limit: z.number().int().positive().optional(),
  has_more: z
    .boolean()
    .optional()
    .describe("True when **`offset` + len(sessions) < total_count**."),
};

export const sessionOutputShape = {
  ok: z
    .boolean()
    .describe("False when **`id`** is invalid or transcript could not be loaded."),
  error: z.string().optional().describe("Present when **ok** is false."),
  session: sessionBlock.optional().describe("Metadata for the resolved chat."),
  messages: z
    .array(messageRow)
    .optional()
    .describe("Full transcript — can be very large; prefer **`control_chat_*`** when paginating."),
};

// ---------------------------------------------------------------------------
// Control — copy
// ---------------------------------------------------------------------------

export const CONTROL = {
  plan: {
    title: "Integration contract",
    description:
      "**No parameters.** Read-only: no CLI, no disk heavy reads. Returns **`active_control`** (which backend **`control_agent`** uses), binary paths, per-provider notes, **`session_ids`** legend (disk vs resume vs **run_id**), echoed **env** hints, **`orchestration`** (why **502** / timeouts happen and how to poll), and **`session_stop`** (in-flight runs are not cancellable via MCP). Call at **session start** or when switching machines.",
  },
  agent: {
    title: "Headless agent",
    description:
      "Runs the configured headless CLI (**`POKE_AGENTS_CONTROL`**: `cursor` = Cursor `agent -p`, `opencode` = `opencode run`, `codex` = `codex exec`, `claude` = Claude Code `claude -p`) and **always** returns immediately with **`run_id`** — the MCP response is **not** the agent’s final answer. On success, **`poke_completion_notice`** and **`will_post_completion_to_poke`** tell Poke whether a **completion HTTP POST** will fire when the CLI exits. Poll **`control_run_status`** / **`control_run_output_slice`** if no callback. No `provider` argument. Optional **`agent_template`**: `id` from **`agent_templates`** (`list`) prepends `promptPreamble` to `prompt`. **Cursor:** for prompts that must **run terminal commands** or fully automated edits, set **`force: true`**; **`trust`** (default true) only marks the workspace trusted and does not replace **`force`**. **Read-only Cursor:** `mode: \"plan\"` or `mode: \"ask\"`, or `plan: true`. **Normal edit+shell Cursor:** omit `mode` and `plan`. **OpenCode / Codex / Claude:** many Cursor-only fields are ignored; see `control_plan.providers`. Auth: env only (`CURSOR_API_KEY`, OpenCode auth, `codex login`, Claude Code `claude auth`).",
  },
  agent_check: {
    title: "CLI check",
    description:
      "Lightweight probe of the **active** CLI (**`POKE_AGENTS_CONTROL`**). **Cursor:** `about` + `status` text (auth). **OpenCode:** version + `auth list`. **Codex:** version + login status. **Claude Code:** `--version` + `auth status` text. Use **`cwd`** when the user’s project directory matters for the probe. Call **before** spending tokens on **`control_agent`** if you suspect missing binary or auth.",
  },
  session_meta: {
    title: "Disk session metadata",
    description:
      "Decode **`sessions[].id`** to **`session`** metadata **without** returning messages. Set **`count: true`** only when you need **`message_count`** — that **loads the full transcript** server-side and can **timeout** on huge threads over HTTP MCP. Prefer omitting **`count`** for a quick probe.",
  },
  disk_to_cli: {
    title: "Disk id → headless resume id",
    description:
      "Maps a **disk** **`sessions[].id`** to the native CLI session id (**`uuid`**) stored as **`composerId`** (Cursor uuid, OpenCode **`ses_…`**, Codex thread uuid, Claude Code session id when present). Pass **`uuid`** as **`control_agent.resume`** when non-null. If **`uuid`** is null, that disk chat has no CLI id yet — start a **new** headless session or inspect **`keys`** / **`hint`**.",
  },
  run_status: {
    title: "Async run status",
    description:
      "Poll **`run_id`** from **`control_agent`** for exit code, `timed_out`, `backend`, and errors. The **`control_agent`** call returns before the CLI finishes — this tool observes completion.",
  },
  run_output_slice: {
    title: "Async run output slice",
    description:
      "Read captured **stdout** or **stderr** for a **`run_id`** (bounded buffer; use `next_offset` for pagination). This is where transcripts and **`stream-json`** NDJSON appear — not in the immediate **`control_agent`** response.",
  },
  chat_slice: {
    title: "Transcript slice (disk)",
    description:
      "Bounded window of messages for a disk **`id`**: **`offset`** = 0-based start index, **`limit`** = max messages (≤200). Still reads the transcript on the server, but the **MCP response** stays small — use instead of **`session`** when threads are large or HTTP timeouts occur.",
  },
  chat_tail: {
    title: "Transcript tail (disk)",
    description:
      "Last **`limit`** messages (default 30, max 200) for a disk **`id`**. Best quick “what just happened” view without pulling the full thread into the tool result.",
  },
  chat_around: {
    title: "Transcript window around index (disk)",
    description:
      "Context window around message **`index`** (0-based, same order as **`session`**): **`before`** messages strictly before anchor, **`after`** messages after anchor (window includes anchor at start of the after segment). Use to jump to a known message position from **`control_chat_slice`**.`total_count` / UI hints.",
  },
} as const;

export const pokeCallbackFields = {
  poke_callback_url: z
    .string()
    .url()
    .optional()
    .describe(
      "When MCP is **stdio** (no **`X-Poke-Callback-Url`** header), pass Poke’s HTTPS URL here so poke-agents can **POST** a small JSON payload when the **`control_agent`** CLI **exits**. Must be paired with **`poke_callback_token`**. On HTTP MCP, prefer the **headers** instead.",
    ),
  poke_callback_token: z
    .string()
    .optional()
    .describe(
      "Bearer secret for **`poke_callback_url`** — sent as **`Authorization: Bearer …`** on completion. Required if **`poke_callback_url`** is set.",
    ),
};

export const controlAgentInput = {
  prompt: z
    .string()
    .min(1)
    .describe(
      "Instruction for the headless CLI (after any `agent_template` preamble). **`POKE_AGENTS_CONTROL`** picks the binary: Cursor `agent -p`, OpenCode `opencode run`, Codex `codex exec`, Claude Code `claude -p`. If the task needs **real shell execution** or non-interactive automation (Cursor), set **`force: true`** — otherwise the agent may answer without running commands. **Claude:** **`force: true`** maps to **`--dangerously-skip-permissions`** (trusted environments only).",
    ),
  agent_template: z
    .string()
    .optional()
    .describe(
      "Optional template `id` from **`agent_templates`** (`action: list`). Prepends that row's `promptPreamble` to `prompt` before invoking the CLI.",
    ),
  cwd: z
    .string()
    .optional()
    .describe(
      "Working directory for the CLI process (default: MCP server cwd). Use an absolute project path when the user’s task is repo-specific.",
    ),
  workspace: z
    .string()
    .optional()
    .describe(
      "Cursor: passed as `--workspace` (path resolved relative to `cwd`). OpenCode / Codex: subdirectory under `cwd` used as the run root (Codex: `--cd`). Claude Code: extra directory passed as `--add-dir` (resolved path).",
    ),
  resume: z
    .string()
    .optional()
    .describe(
      "Resume an existing headless session: Cursor → `--resume` uuid; OpenCode → `ses_…`; Codex → thread uuid for `codex exec resume`; Claude Code → `--resume` session id. **Omit** `resume` and `continue_chat` to start a **new** session. Never pass a disk `sessions[].id` here — map with **`control_disk_to_cli`**.",
    ),
  continue_chat: z
    .boolean()
    .optional()
    .describe(
      "Cursor: `--continue` previous headless session. OpenCode: `--continue`. Codex: `resume --last`. Claude Code: `--continue` with `-p`. Ignored when `resume` is set.",
    ),
  format: z
    .enum(["text", "json", "stream-json"])
    .optional()
    .default("text")
    .describe(
      "Captured stdout shape: Cursor `--output-format`; OpenCode/Codex use `json` or `stream-json` for machine-readable lines. **Final output is not in this tool’s return value** — read **`control_run_output_slice`** after the run completes.",
    ),
  stream: z
    .boolean()
    .optional()
    .describe(
      "Cursor only: with `format: stream-json`, maps to `--stream-partial-output` (incremental NDJSON deltas).",
    ),
  model: z
    .string()
    .optional()
    .describe(
      "Cursor: `--model` (e.g. `auto`, `gpt-5.3-codex`, `claude-4.6-opus-high-thinking` — see `cursor agent models`). OpenCode / Codex: `-m`. Omit to use the CLI default.",
    ),
  mode: z
    .enum(["plan", "ask"])
    .optional()
    .describe(
      "Cursor only: `--mode`. **`plan`** = read-only planning (no edits). **`ask`** = read-only Q&A. **Omit** `mode` (and leave `plan` false/unset) for normal agent behavior that may edit files and run shell. Do not send an empty string.",
    ),
  plan: z
    .boolean()
    .optional()
    .describe(
      "Cursor only: when true, `--plan` (same as `mode: plan`). Ignored if `cloud` is used. For “build” / coding agent, omit or false.",
    ),
  trust: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Cursor only: `--trust` (default **true**). Trusts the **workspace** for headless runs so the CLI does not block on “trust this folder?”. **Does not** grant automatic terminal execution — use **`force`** when commands must actually run.",
    ),
  force: z
    .boolean()
    .optional()
    .describe(
      "Cursor: `--force` (CLI alias `--yolo`; MCP has no separate `yolo` field). **Set true** when the prompt requires **executing terminal commands**, batch tooling, or the model otherwise refuses with “rejected” / approval-style messages. **Risky** on untrusted instructions. OpenCode: ignored. Codex: maps to `--dangerously-bypass-approvals-and-sandbox` (use only in isolated environments). Default if omitted: false.",
    ),
  approve_mcp: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      "Cursor only: `--approve-mcps` (default **true**). Auto-approves **MCP servers** the Cursor agent loads — separate from **`force`** (shell/command gating).",
    ),
  sandbox: z
    .enum(["enabled", "disabled"])
    .optional()
    .default("disabled")
    .describe(
      "Cursor: `--sandbox`. Default **disabled** so network/shell are usable in headless mode; use **enabled** to isolate. Codex: disabled (default) adds `--full-auto`; enabled omits that bypass.",
    ),
  cloud: z
    .boolean()
    .optional()
    .describe(
      "Cursor only: `--cloud` (cloud composer picker behavior). Usually omit for scripted runs.",
    ),
  ...pokeCallbackFields,
};

export const controlRunStatusInput = {
  run_id: z
    .string()
    .min(1)
    .describe(
      "Exact **`run_id`** returned by **`control_agent`** when **`accepted: true`**. Unknown/expired ids return **ok: false**.",
    ),
};

export const controlRunOutputSliceInput = {
  run_id: z
    .string()
    .min(1)
    .describe("Same **`run_id`** as **`control_run_status`**."),
  stream: z
    .enum(["stdout", "stderr"])
    .describe(
      "**stdout** = CLI captured standard output (including **`stream-json`** NDJSON). **stderr** = errors / Cursor hints — read after failures.",
    ),
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe(
      "Start offset in **UTF-16 code units** into the captured stream (use **`next_offset`** from the previous slice for pagination). **0** = from the beginning.",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500_000)
    .optional()
    .default(8_000)
    .describe(
      "Max **UTF-16 code units** per slice (default **8000**, max **500000**). Increase for bigger chunks; watch MCP payload size over HTTP.",
    ),
};

export const controlChatSliceInput = {
  id: diskSessionId,
  offset: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(0)
    .describe(
      "0-based index of the first message in the page (same ordering as **`session`**).",
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("Page size — max **200** messages per call."),
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
    .describe("How many **most recent** messages to return (max **200**)."),
};

export const controlChatAroundInput = {
  id: diskSessionId,
  index: z
    .number()
    .int()
    .min(0)
    .describe(
      "Anchor message index (0-based). Must be < message count; invalid index yields **ok: false**.",
    ),
  before: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .default(5)
    .describe("Count of messages **strictly before** **`index`** to include."),
  after: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .default(5)
    .describe(
      "Count of messages **from `index` onward** (anchor is the first message in this tail segment).",
    ),
};

export const controlAgentCheckInput = {
  cwd: cwdOptional,
};

export const controlSessionMetaInput = {
  id: diskSessionId,
  count: z
    .boolean()
    .optional()
    .describe(
      "**Default omit / false:** metadata only (fast). **true:** computes **`message_count`** by loading the **entire** transcript — can be **slow** and cause **HTTP MCP timeouts** on huge chats.",
    ),
};

export const controlDiskToCliInput = {
  id: diskSessionId.describe(
    "Disk **`sessions[].id`**. Output **`uuid`** is the value to pass as **`control_agent.resume`** when non-null.",
  ),
};

// ---------------------------------------------------------------------------
// Control — outputs
// ---------------------------------------------------------------------------

export const controlPlanOutputShape = {
  providers: z
    .array(z.unknown())
    .describe("Per-backend capability matrix + human notes (shape may evolve)."),
  /** Which CLI `control_agent` uses (`POKE_AGENTS_CONTROL`, default `cursor`). */
  active_control: z
    .enum(["cursor", "opencode", "codex", "claude"])
    .describe("Which CLI **`control_agent`** / **`control_agent_check`** use right now."),
  cursor_agent_binary: z
    .string()
    .describe("Resolved **`agent`** executable path or label for Cursor."),
  opencode_cli_binary: z.string().describe("Resolved **`opencode`** binary path or label."),
  codex_cli_binary: z.string().describe("Resolved **`codex`** binary path or label."),
  claude_cli_binary: z.string().describe("Resolved **`claude`** (Claude Code) binary path or label."),
  orchestration: z
    .object({
      http_mcp_and_tunnel: z.string(),
      control_agent: z.string(),
      large_disk_transcripts: z.string(),
      network_bound_tools: z.string(),
    })
    .describe(
      "Human-readable orchestration rules: **502**/timeouts, async **`control_agent`**, when to paginate disk transcripts.",
    ),
  session_ids: z
    .record(z.string(), z.string())
    .describe("Short glossary keys → explanations (disk id vs resume vs **run_id**)."),
  env: z
    .record(z.string(), z.string())
    .describe("Relevant env var names → short reminders (not secret values)."),
  session_stop: z
    .object({
      supported: z.literal(false),
      note: z.string(),
    })
    .describe(
      "**supported** is always false — cancel/interrupt headless runs via OS/process, not MCP.",
    ),
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
  ok: z
    .boolean()
    .describe("False when spawn failed (**failed_to_start**) or validation failed before run."),
  accepted: z
    .boolean()
    .optional()
    .describe("True only when the CLI process was started (**status: started**)."),
  status: z
    .enum(["started", "failed_to_start"])
    .optional()
    .describe("**started** = background run registered; **failed_to_start** = could not spawn."),
  run_id: z
    .string()
    .optional()
    .describe("Use with **`control_run_status`** / **`control_run_output_slice`**; unrelated to disk **`sessions[].id`**."),
  callback_registered: z
    .boolean()
    .optional()
    .describe(
      "Same as **`will_post_completion_to_poke`** — true when **X-Poke-Callback-Url** + **X-Poke-Callback-Token** (HTTP MCP) or **`poke_callback_url`** + **`poke_callback_token`** (stdio) were present.",
    ),
  will_post_completion_to_poke: z
    .boolean()
    .optional()
    .describe(
      "**Orchestrators (Poke):** when **true**, poke-agents will **POST JSON to your callback URL when the headless CLI exits** — you do **not** need to block on this MCP `tools/call` for the final result. When **false**, poll **`control_run_status`** / **`control_run_output_slice`** (see **`poke_completion_notice`**).",
    ),
  poke_completion_notice: z
    .string()
    .optional()
    .describe(
      "Human-readable reminder for Poke/models: this response is only the **start** of a background run; completion is delivered via callback or polling. Present when **`status` is `started`**.",
    ),
  backend: z.enum(["cursor", "opencode", "codex", "claude"]),
  cwd: z.string().optional(),
  resume_uuid: z
    .string()
    .optional()
    .describe("Session id for the next **`control_agent.resume`** (Cursor uuid, OpenCode **`ses_…`**, Codex thread uuid)."),
  auto_created_cli_chat_uuid: z
    .string()
    .optional()
    .describe("Cursor: new chat id from **`create-chat`** (usually equals **resume_uuid**)."),
  error: z.string().optional().describe("Human-readable failure (template id, spawn error, etc.)."),
  hint: z
    .string()
    .optional()
    .describe(
      "Shorter next-step note; **`poke_completion_notice`** repeats the Poke/orchestrator handoff in full when **`status` is `started`**.",
    ),
  error_classification: cursorAgentErrorClassification.optional(),
  cursor_stderr_message: z
    .string()
    .optional()
    .describe("Primary stderr line from Cursor CLI when classified (name kept for compatibility)."),
  stdout: z.string().optional().describe("Small spawn-time stdout when **failed_to_start** (rare)."),
  stderr: z.string().optional().describe("Small spawn-time stderr when **failed_to_start**."),
  agent_template: z
    .string()
    .optional()
    .describe("Echoes **`agent_template`** input when the preamble was applied."),
  agent_template_title: z
    .string()
    .optional()
    .describe("Template **title** for UIs when a template was applied."),
};

export const controlRunStatusOutputShape = {
  ok: z.boolean(),
  error: z.string().optional().describe("When **ok** is false (unknown **run_id**, etc.)."),
  run_id: z.string().optional(),
  status: z
    .enum(["started", "running", "completed", "failed", "failed_to_start"])
    .optional()
    .describe(
      "Lifecycle: **running** until CLI exits, then **completed** or **failed**; **failed_to_start** if spawn failed.",
    ),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  backend: z.string().optional().describe("Same meaning as **`control_agent`** backend."),
  cwd: z.string().optional(),
  prompt_preview: z.string().optional().describe("Shortened prompt for debugging."),
  resume_uuid: z
    .string()
    .optional()
    .describe("Use as **`control_agent.resume`** on the next turn when continuing this chat."),
  auto_created_cli_chat_uuid: z
    .string()
    .optional()
    .describe("Cursor: id from **create-chat** for this run (often same as **resume_uuid**)."),
  pid: z.number().nullable().optional().describe("OS process id while running, else null."),
  exit_code: z.number().nullable().optional().describe("Shell exit code when **completed**/**failed**."),
  signal: z.string().nullable().optional().describe("Signal name if terminated by signal."),
  timed_out: z
    .boolean()
    .optional()
    .describe("True if poke-agents killed the CLI after **POKE_AGENTS_AGENT_TIMEOUT_MS**."),
  stdout_length: z
    .number()
    .optional()
    .describe("Captured stdout length — pair with **`control_run_output_slice`**."),
  stderr_length: z.number().optional(),
  format: z.string().optional().describe("Output format requested (e.g. text, stream-json)."),
  run_error: z.string().optional().describe("Process error summary when **failed**."),
};

export const controlRunOutputSliceOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  run_id: z.string().optional(),
  stream: z.enum(["stdout", "stderr"]).optional(),
  offset: z.number().optional().describe("Start offset of this **`text`** window."),
  limit: z.number().optional().describe("Requested max length."),
  total_length: z.number().optional().describe("Full captured stream length."),
  next_offset: z
    .number()
    .optional()
    .describe("Pass as **`offset`** on the next call to continue reading (or equals **total_length** at end)."),
  text: z.string().optional().describe("Slice of stdout or stderr."),
  truncated: z
    .boolean()
    .optional()
    .describe("True if more data exists after **next_offset**."),
};

export const controlChatSliceOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  session: sessionBlock.optional(),
  messages: z.array(messageRow).optional().describe("This page only — not the full thread."),
  offset: z.number().optional().describe("Start index of **messages** in this response."),
  total_count: z.number().optional().describe("Total messages in the transcript."),
  truncated: z
    .boolean()
    .optional()
    .describe("True if **`offset` + len(messages) < total_count** — fetch next page with higher **offset**."),
};

export const controlAgentCheckOutputShape = {
  ok: z.boolean(),
  backend: z.enum(["cursor", "opencode", "codex", "claude"]),
  cwd: z.string().optional(),
  binary: z.string().optional().describe("Resolved CLI binary path when known."),
  about: z.string().optional().describe("Cursor **`about`** text; may be empty for other CLIs."),
  status: z
    .string()
    .optional()
    .describe("Auth / health text (Cursor **`status`**, OpenCode auth list, Codex login status)."),
  error: z.string().optional().describe("Spawn or parse failure."),
};

export const controlSessionMetaOutputShape = {
  ok: z.boolean(),
  error: z.string().optional(),
  adapter: z.string().optional().describe("Which adapter owns this disk row."),
  session: sessionBlock.optional(),
  message_count: z
    .number()
    .nullable()
    .optional()
    .describe("Only when **`count: true`** was requested; null if skipped."),
  message_count_error: z
    .string()
    .optional()
    .describe("Why **message_count** could not be computed."),
};

export const controlDiskToCliOutputShape = {
  ok: z.boolean(),
  id: z.string().optional().describe("Echo of input disk id."),
  uuid: z
    .string()
    .nullable()
    .optional()
    .describe("CLI resume id for **`control_agent.resume`** when non-null."),
  keys: z
    .array(z.string())
    .optional()
    .describe("Composer/session key names found in the snapshot (debugging)."),
  hint: z.string().optional().describe("What to do when **uuid** is null."),
  error: z.string().optional(),
};

const agentTemplateRow = z.object({
  id: z
    .string()
    .describe(
      "Stable slug (e.g. **tester**). Custom ids are free-form; matching a **built_in** id creates an override.",
    ),
  title: z.string().describe("Short display name."),
  summary: z
    .string()
    .describe("One-line description for lists (dashboard + **`agent_templates` list**)."),
  promptPreamble: z
    .string()
    .describe(
      "Prepended to **`control_agent.prompt`** when **`agent_template`** = this **id** (blank line between preamble and user prompt).",
    ),
  pokeHint: z
    .string()
    .describe("Optional orchestrator hint text (shown in UIs; keep actionable)."),
  built_in: z
    .boolean()
    .optional()
    .describe("True when the merged row comes from shipped defaults (not on disk alone)."),
  has_local_override: z
    .boolean()
    .optional()
    .describe(
      "True when this **id** appears in **`~/.poke-agents/agent-templates.json`** (custom row or built-in override).",
    ),
});

export const agentTemplatesInput = {
  action: z
    .enum(["list", "upsert", "delete"])
    .describe(
      "**list** — no other fields required; returns merged templates + **built_in_ids**. **upsert** — requires **template** (full row). **delete** — requires **delete_id**.",
    ),
  template: agentTemplateRow
    .omit({ built_in: true, has_local_override: true })
    .optional()
    .describe(
      "Required for **upsert**. Include **id**, **title**, **summary**, **promptPreamble**, **pokeHint** (can be empty string). Do not send **built_in** / **has_local_override** — those are output-only.",
    ),
  delete_id: z
    .string()
    .optional()
    .describe(
      "Required for **delete**. Removes that **id** from custom JSON. For built-in ids, only **your override** is removed (shipped default returns).",
    ),
};

export const agentTemplatesOutputShape = {
  ok: z.boolean(),
  templates: z
    .array(agentTemplateRow)
    .optional()
    .describe("Present on successful **list** or **upsert**."),
  storage_path: z
    .string()
    .optional()
    .describe("Absolute path to the custom JSON file on the poke-agents host."),
  built_in_ids: z
    .array(z.string())
    .optional()
    .describe("Ids that ship with the package (from **list** / **upsert**)."),
  error: z.string().optional().describe("Validation or IO error when **ok** is false."),
};

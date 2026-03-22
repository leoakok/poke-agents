/** Markdown bodies for MCP resources (embedded so dist/ needs no asset path). */

export const RESOURCE_GUIDE_OVERVIEW = `# poke-agents — orchestrator guide

**Use this content via the \`poke_agents_guide\` MCP tool** when your client cannot list MCP **resources** or **prompts** (e.g. Poke). Each \`topic\` returns markdown; \`all\` returns the full manual.

## \`poke_agents_guide\` topics

| \`topic\` | What you get |
|-----------|----------------|
| \`overview\` | This page (index + quick start) |
| \`read\` | Disk tools: \`adapters\`, \`sessions\`, \`session\` |
| \`control\` | Headless CLI control (\`POKE_AGENTS_CONTROL\`) + defaults |
| \`session_ids\` | Disk id vs CLI uuid vs \`run_id\` |
| \`streaming\` | \`stream-json\` / NDJSON / async runs |
| \`tunnel\` | HTTP MCP, poke tunnel, proxy 502 / timeouts |
| \`templates\` | \`agent_templates\` tool |
| \`prompts\` | MCP prompt names (for clients that *can* use prompts) |
| \`all\` | All sections concatenated (long) |

## Quick start

1. **Contract:** \`control_plan\` — providers, env vars, id rules, \`session_stop\`, \`orchestration\` (HTTP/tunnel timeouts).
2. **Disk transcripts:** \`adapters\` → \`sessions\` → \`session\` (\`id\` = opaque \`sessions[].id\`).
3. **Headless CLI:** \`control_agent\` — **always returns immediately** with \`run_id\`, **\`poke_completion_notice\`**, and **\`will_post_completion_to_poke\`** (whether Poke gets a completion POST). Poll \`control_run_status\` / \`control_run_output_slice\` only if no callback. **Cursor:** \`trust\` vs \`force\` as in \`topic: control\`. **Do not** wait on the MCP HTTP response for CLI completion (see \`topic: tunnel\`).
4. **Outputs:** Prefer **\`structuredContent\`** (matches each tool’s \`outputSchema\`); JSON is also mirrored in \`content[0].text\`.

## MCP resources (optional clients)

Same markdown as \`poke_agents_guide\` lives at URIs: \`poke-agents://guide/tools-read\`, \`.../tools-control\`, \`.../session-ids\`, \`.../agent-streaming\`, \`.../http-tunnel\`.
`;

export const RESOURCE_GUIDE_TEMPLATES = `# Agent templates (\`agent_templates\`)

Stored under ~/.poke-agents/agent-templates.json (override with \`POKE_AGENTS_TEMPLATES_PATH\`). Persists across \`npx\` and package updates — not inside the npm package tree.

| \`action\` | Behavior |
|------------|-----------|
| \`list\` | Merged templates + \`built_in_ids\` + \`has_local_override\` per row |
| \`upsert\` | Saves to custom JSON; same \`id\` as a built-in replaces the merged row (override) |
| \`delete\` | Removes a custom row; for built-in ids, removes your override only |

**With \`control_agent\`:** set optional \`agent_template\` to a template \`id\` from \`list\` — the server prepends \`promptPreamble\` to \`prompt\` before invoking the CLI.
`;

export const RESOURCE_GUIDE_PROMPTS = `# MCP prompts (reference)

Registered prompt **names** (usable only if the client exposes MCP prompts):

| Name | Title |
|------|--------|
| \`getting_started\` | How to use this MCP |
| \`workflow_inspect_saved_chats\` | Inspect saved Cursor/OpenCode chats |
| \`workflow_cursor_headless_task\` | Run headless agent (Cursor, OpenCode, Codex, or Claude Code) |
| \`workflow_bridge_disk_to_cli\` | Resume CLI from a saved disk session |

Each prompt expands to a user message with a concrete workflow. If prompts are unavailable, use \`poke_agents_guide\` with \`topic: "overview"\` or \`"control"\` instead.
`;

export const RESOURCE_TOOLS_READ = `# Poke agents — read tools (disk)

Local **saved** chat storage only (not live CLI). Respects \`POKE_AGENTS_EDITORS\` (default \`cursor,opencode,codex,claude\`).

| Tool | Parameters | Purpose |
|------|------------|---------|
| \`adapters\` | *(none)* | Allowlist + per-adapter **available** / **detail** — call when \`sessions\` is empty or wrong editor |
| \`sessions\` | \`editor?\`, \`folder?\`, \`limit?\` (1–500, default 50) | Newest-first list; each \`id\` is opaque |
| \`session\` | \`id\` = exact \`sessions[].id\` | **Full** transcript — **timeout risk** on huge threads; prefer \`control_chat_*\` |
| \`agent_templates\` | \`action\`: \`list\` \| \`upsert\` \| \`delete\`; \`template?\`; \`delete_id?\` | Disk personas merged with built-ins; \`upsert\` needs full \`template\` object |
| \`poke_agents_guide\` | \`topic?\` | Markdown manual when resources are unavailable |

**Returns:** \`structuredContent\` (+ mirrored JSON in \`content[0].text\`).

**Disk id:** Opaque from \`sessions\`: \`{source}:{base64url(JSON)}\`. **Not** a CLI uuid — map with \`control_disk_to_cli\` for \`control_agent.resume\`.
`;

export const RESOURCE_TOOLS_CONTROL = `# Poke agents — control tools (CLI)

**No resource access?** Call \`poke_agents_guide\` with \`topic: "control"\` (or \`"all"\`) for the same text.

**No \`provider\` parameters** — the active headless CLI is **\`POKE_AGENTS_CONTROL\`**: \`cursor\` (default → Cursor \`agent -p\`), \`opencode\` → \`opencode run\`, \`codex\` → \`codex exec\`, or \`claude\` → Claude Code \`claude -p\`. See \`control_plan.active_control\` and binary paths.

| Tool | When to use |
|------|-------------|
| \`control_plan\` | Contract: \`active_control\`, binaries, features, id rules, env, \`session_stop\`, \`orchestration\` |
| \`control_agent\` | **Async** — returns \`run_id\` + **\`poke_completion_notice\`** + **\`will_post_completion_to_poke\`** immediately. **Cursor:** omit \`resume\`/\`continue_chat\` → \`create-chat\` then run. **OpenCode/Codex/Claude:** omit both → new run. **Continue:** \`resume\` = native CLI id. Poke: \`X-Poke-Callback-Url\`/\`Token\` or \`poke_callback_*\`. |
| \`control_run_status\` | Lifecycle + exit metadata for a \`run_id\` (\`backend\` field). |
| \`control_run_output_slice\` | Bounded stdout/stderr window for a \`run_id\`. |
| \`control_chat_slice\` / \`tail\` / \`around\` | Paginate disk transcripts (same \`id\` as \`session\`). |
| \`control_agent_check\` | Cursor: \`about\` + \`status\`. OpenCode: \`--version\` + \`auth list\`. Codex: \`--version\` + \`login status\`. Claude Code: \`--version\` + \`auth status\`. |
| \`control_session_meta\` | Disk \`id\` metadata; optional \`count: true\` |
| \`control_disk_to_cli\` | Disk \`id\` → \`composerId\` as \`resume\` (Cursor uuid, OpenCode \`ses_…\`, Codex thread uuid, Claude session id when present) |

**Transparency:** \`error_classification\`, \`cursor_stderr_message\`, \`hint\`, and \`control_run_output_slice\` after failure.

**Streaming:** Cursor \`stream-json\` + \`stream\`; OpenCode \`json\` / \`stream-json\` → \`--format json\`; Codex → \`--json\`; Claude Code → \`--output-format\` (\`text\` / \`json\` / \`stream-json\`). See \`poke-agents://guide/agent-streaming\`.

**HTTP / search:** Use Poke’s tools, then pass text into \`control_agent.prompt\`.

**Three ids:** (1) Disk \`sessions[].id\`. (2) **Resume id** from \`control_agent\` / \`control_disk_to_cli\`. (3) **\`run_id\`** — not the same as \`resume\`.

**Env:** \`POKE_AGENTS_CONTROL\`, \`POKE_AGENTS_CURSOR_AGENT_BIN\`, \`POKE_AGENTS_OPENCODE_BIN\`, \`POKE_AGENTS_CODEX_BIN\`, \`POKE_AGENTS_CLAUDE_BIN\`, \`POKE_AGENTS_CLAUDE_BARE\`, \`POKE_AGENTS_CODEX_SKIP_GIT\`, \`POKE_AGENTS_AGENT_TIMEOUT_MS\`, \`CURSOR_API_KEY\`, \`POKE_AGENTS_CURSOR_CREATE_CHAT_TRUST\`. Optional \`workspace\` (Cursor \`--workspace\`; OpenCode/Codex run cwd under \`cwd\`; Claude \`--add-dir\`).

## \`control_agent\` fields (orchestrators / models)

| Field | Role |
|-------|------|
| \`prompt\` | Main instruction (after optional \`agent_template\` preamble). |
| \`cwd\` / \`workspace\` | Project paths; \`workspace\` → Cursor \`--workspace\`. |
| \`resume\` / \`continue_chat\` | Continue CLI session; omit both for **new** chat. |
| \`format\` / \`stream\` | Shape of **captured stdout** — read via \`control_run_output_slice\`, not the immediate tool response. |
| \`model\` | Cursor \`--model\` (\`auto\`, etc.); omit for CLI default. |
| \`mode\` / \`plan\` | Cursor **read-only** only (\`plan\`, \`ask\`). Omit both for normal agent (edits + shell). |
| \`trust\` | Cursor **workspace trust** (default true). Stops folder-trust prompts; **not** the same as shell approval. |
| \`force\` | Cursor **\`--force\`** — use when the task must **execute** terminal commands or automation otherwise stalls. **Unsafe** on malicious prompts. Codex: dangerous bypass flag. Claude Code: \`--dangerously-skip-permissions\`. |
| \`poke_callback_*\` / HTTP headers | Completion ping when the CLI exits. Response fields **\`will_post_completion_to_poke\`** and **\`poke_completion_notice\`** state this explicitly for Poke. |
| \`approve_mcp\` | Cursor **MCP server** auto-approval (default true); separate from \`force\`. |
| \`sandbox\` | Cursor isolation; default \`disabled\` for headless network/shell. |

**Successful start (always):** structured result includes **\`poke_completion_notice\`** (full handoff text) and **\`will_post_completion_to_poke\`** (boolean) — read these so Poke does not block on this MCP response waiting for the agent to finish.

**If it “did nothing”:** you may be looking at the wrong response — use \`run_id\` + slices. If the agent **refused** a command, try \`force: true\` (Cursor).
`;

export const RESOURCE_AGENT_STREAMING = `# Headless agent — JSON / stream-json stdout

## Cursor (\`POKE_AGENTS_CONTROL=cursor\`)

Use \`control_agent\` with:

- \`format: stream-json\`
- \`stream: true\` (maps to \`--stream-partial-output\`)

The CLI prints **line-delimited JSON** to stdout. poke-agents **captures** stdout for the \`run_id\`; parse NDJSON via \`control_run_output_slice\` (\`stream: "stdout"\`) after the run completes. The immediate \`control_agent\` response does not include parsed events. Inspect event \`type\` / fields your Cursor version emits (thinking, tool calls, deltas — schema is CLI-defined).

**Tip:** Defaults enable \`--trust\`, \`--approve-mcps\`, \`--sandbox disabled\`. Add \`force: true\` on \`control_agent\` when stdout should reflect **real** shell runs, not refusals. Omit \`resume\`/\`continue_chat\` on the first call so \`create-chat\` supplies a \`--resume\` uuid.

## OpenCode (\`POKE_AGENTS_CONTROL=opencode\`)

Use \`format: json\` or \`stream-json\` → \`opencode run --format json\`. Output is still captured to the run’s stdout buffer; read slices after completion the same way.

## Codex (\`POKE_AGENTS_CONTROL=codex\`)

Use \`format: json\` or \`stream-json\` → \`codex exec --json\`. JSONL includes \`thread.started\` with \`thread_id\` for the next \`resume\`.

## Claude Code (\`POKE_AGENTS_CONTROL=claude\`)

Use \`format: json\` or \`stream-json\` → \`claude -p\` with \`--output-format\`. Captured stdout is read the same way via \`control_run_output_slice\` after completion. Default adds \`--bare\` for scripted runs; set \`POKE_AGENTS_CLAUDE_BARE=0\` to disable.

**Limits (callback metadata):** Server-side JSON-line parsing caps at 800 events; \`stream_json_truncated\` may appear on the Poke completion callback.

**Completion:** Prefer the Poke callback (\`stream_json_event_count\`, etc.) or poll \`control_run_status\` then \`control_run_output_slice\`.
`;

export const RESOURCE_GUIDE_TUNNEL = `# HTTP MCP, poke tunnel, and timeouts

## What goes wrong

When poke-agents is reached over **HTTP** (e.g. \`poke tunnel\` to \`/mcp\`), each **tool call** is typically **one HTTP request** that must **finish** before the client gets JSON-RPC success. Reverse proxies and tunnels apply **timeouts**. If the server (or tool handler) does not respond in time, the client often sees **502** or a generic disconnect — not necessarily a bug in poke-agents.

## \`control_agent\` is already async

\`control_agent\` **returns immediately** with \`run_id\` while the headless CLI runs **locally** (\`agent -p\`, \`opencode run\`, \`codex exec\`, or Claude Code \`claude -p\`). The tool result includes **\`poke_completion_notice\`** and **\`will_post_completion_to_poke\`** so Poke knows whether a **completion POST** is coming. Orchestrators must:

- **Not** wait on the MCP HTTP response for CLI completion.
- If **\`will_post_completion_to_poke\`** is true, expect an outbound POST when the CLI exits; if false, poll **\`control_run_status\`** and read **\`control_run_output_slice\`**.

If your platform still has a “sync” vs “async” tool classification, **\`control_agent\` must be async** (fire-and-forget at the HTTP layer).

## Other tools can still be slow

| Risk | Mitigation |
|------|------------|
| **\`session\`** loads the **entire** disk transcript in one shot | Prefer **\`control_chat_slice\`**, **\`control_chat_tail\`**, or **\`control_chat_around\`** with small \`limit\` |
| **\`control_session_meta\` with \`count: true\`** reads the full thread to count | Omit \`count\` or use chat slice tools unless you need the count |

## Contract in \`control_plan\`

The **\`orchestration\`** object in **\`control_plan\`** repeats this guidance for machine-readable clients.

`;

export const RESOURCE_SESSION_IDS = `# Session identifiers

1. **Disk id** — From \`sessions[].id\`. Use with \`session\`, \`control_session_meta\`, \`control_disk_to_cli\`.

2. **Resume id** — Cursor: uuid from \`control_agent.resume_uuid\` / \`auto_created_cli_chat_uuid\`. OpenCode: \`ses_…\` from JSON/callback/disk. Codex: thread uuid from JSONL \`thread.started\`, callback, or \`control_disk_to_cli\`. Claude Code: session id from prior run, callback, or \`control_disk_to_cli\` when \`composerId\` is set. Pass as \`resume\` on the next \`control_agent\` call.

3. **run_id** — From each \`control_agent\` call. Use with \`control_run_status\` and \`control_run_output_slice\`. **Not** the same as \`resume\` or disk ids.

Use \`control_disk_to_cli\` to map disk \`sessions[].id\` → \`resume\` when \`composerId\` is present.
`;

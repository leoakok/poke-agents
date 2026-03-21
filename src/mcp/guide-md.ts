/** Markdown bodies for MCP resources (embedded so dist/ needs no asset path). */

export const RESOURCE_TOOLS_READ = `# Poke agents — read tools (disk)

Local chat storage only. Respects \`POKE_AGENTS_EDITORS\` (default \`cursor,opencode\`).

| Tool | Purpose |
|------|---------|
| \`adapters\` | Enabled adapters + health + \`editors\` allowlist |
| \`sessions\` | Recent chats; optional \`editor\`, \`folder\`, \`limit\` |
| \`session\` | Full transcript for one \`sessions[].id\` (\`id\` param) |

**Returns:** \`structuredContent\` (+ mirrored JSON in \`content[0].text\`). \`session\` may return \`ok: false\` + \`error\`.

**Disk id:** Opaque string from \`sessions\`: \`{source}:{base64url(JSON)}\`. Pass unchanged to \`session\`.
`;

export const RESOURCE_TOOLS_CONTROL = `# Poke agents — control tools (CLI)

All take \`provider\`: \`cursor\` | \`opencode\`. **Only Cursor** runs \`agent\` today.

| Tool | When to use |
|------|-------------|
| \`control_plan\` | Contract: features, id rules, env, \`session_stop\` |
| \`control_chat_new\` | New empty CLI chat → \`uuid\` for \`control_agent.resume\` |
| \`control_agent\` | Headless \`agent -p\` (**sync** — blocks until exit); defaults: \`trust\`, \`approve_mcp\` on; \`sandbox: "disabled"\` (network/shell). Override with \`sandbox: "enabled"\` to isolate. |
| \`control_agent_start\` | Same inputs as \`control_agent\`, but returns **immediately** with \`run_id\` while the CLI runs in the background. Poll \`control_run_status\` / \`control_run_output_slice\`. Optional Poke callback: HTTP MCP sends \`X-Poke-Callback-Url\` + \`X-Poke-Callback-Token\`, or pass \`poke_callback_url\` + \`poke_callback_token\` (e.g. stdio). |
| \`control_run_status\` | Lifecycle + exit metadata for a \`run_id\`. |
| \`control_run_output_slice\` | Bounded window of captured stdout/stderr for a \`run_id\`. |
| \`control_chat_slice\` / \`control_chat_tail\` / \`control_chat_around\` | Paginate disk transcripts by offset/tail/window (same \`id\` as \`session\`; still loads server-side per call). |
| \`control_agent_check\` | \`agent about\` + \`status\` |
| \`control_session_meta\` | Metadata for disk \`id\`; optional \`count: true\` for message_count |
| \`control_disk_to_cli\` | Cursor disk \`id\` → \`uuid\` (composerId) for \`resume\` |

**One-shot:** \`control_agent\` with default \`auto_chat: true\` creates a CLI chat when you omit \`resume\` and \`continue_chat\` (no manual \`control_chat_new\`).

**Transparency:** On failure, read \`error_classification\`, \`cursor_stderr_message\`, and \`stderr\` (full).

**Streaming:** \`format: stream-json\` + \`stream: true\` → NDJSON in stdout plus \`stream_json_events\` in structured output. See resource \`poke-agents://guide/agent-streaming\`.

**Web (MCP):** \`web_fetch\` (GET + clear transport errors), \`web_search\` (Brave API — set \`POKE_AGENTS_BRAVE_API_KEY\` or \`BRAVE_API_KEY\`). The **orchestrator** (Poke / the model calling this MCP) should run these — the Cursor CLI cannot open a GUI browser; with sandbox off it may still use \`curl\`/shell or tool-MCPs.

**Three ids:** (1) Disk \`sessions[].id\`. (2) CLI \`uuid\` from \`control_chat_new\` or \`auto_created_cli_chat_uuid\`. (3) **\`run_id\`** from \`control_agent_start\` — one per async invocation; not the same as \`resume\`. Bridge disk ↔ CLI with \`control_disk_to_cli\`.

**Async vs sync:** Prefer \`control_agent_start\` when the orchestrator should not block on the full CLI run; use \`control_agent\` when you want stdout/stderr in the same tool response.

**Env:** \`POKE_AGENTS_CURSOR_AGENT_BIN\`, \`POKE_AGENTS_AGENT_TIMEOUT_MS\`, optional Brave key for search.
`;

export const RESOURCE_AGENT_STREAMING = `# Cursor agent — stream-json / “thoughts”

Use \`control_agent\` with:

- \`format: stream-json\`
- \`stream: true\` (maps to \`--stream-partial-output\`)

The CLI prints **line-delimited JSON** to stdout. poke-agents parses each line and returns **\`stream_json_events\`** (array of objects) alongside raw \`stdout\` **when the run finishes** (stdout is buffered like any subprocess). For true live token streaming you’d need MCP streaming tool results or a separate watcher — not implemented here. Inspect event \`type\` / fields your Cursor version emits (thinking, tool calls, deltas — schema is CLI-defined).

**Tip:** Defaults already enable \`--trust\` and \`--approve-mcps\` and \`--sandbox disabled\` for unattended runs with network. Use \`auto_chat: true\` (default) so headless runs get a \`--resume\` uuid automatically.

**Limits:** Parsing caps at 800 events; \`stream_json_truncated: true\` if stdout had more JSON lines.

**Async (\`control_agent_start\`):** Structured \`stream_json_events\` are **not** inlined in the start response. When the run finishes, use \`control_run_output_slice\` on stdout and parse NDJSON lines client-side, or rely on \`stream_json_event_count\` in the optional Poke completion callback.
`;

export const RESOURCE_SESSION_IDS = `# Session identifiers

1. **Disk id** — From \`sessions[].id\`. Use with \`session\`, \`control_session_meta\`, \`control_disk_to_cli\`.

2. **CLI uuid** — From \`control_chat_new\` or \`control_agent.auto_created_cli_chat_uuid\` / \`control_agent_start\`. Pass as \`resume\` in \`control_agent\` / \`control_agent_start\`.

3. **run_id** — From \`control_agent_start\` only. Use with \`control_run_status\` and \`control_run_output_slice\`. It is **not** interchangeable with \`resume\` or disk ids.

Do not pass a disk id as \`resume\` unless it is literally a raw uuid (rare).
`;

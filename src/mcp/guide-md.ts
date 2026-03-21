/** Markdown bodies for MCP resources (embedded so dist/ needs no asset path). */

export const RESOURCE_TOOLS_READ = `# Poke agents — read tools (disk)

These tools scan **local** chat storage. They respect \`POKE_AGENTS_EDITORS\` (default \`cursor,opencode\`).

| Tool | Purpose |
|------|---------|
| \`list_connectors\` | Which adapters are enabled + health |
| \`list_sessions\` | Recent sessions; use \`source\` / \`project_path\` / \`limit\` |
| \`get_session\` | Full transcript for one \`sessions[].id\` |

**Returns:** Every tool fills MCP \`structuredContent\` (and mirrors JSON in \`content[0].text\`). Read tools use \`ok: true\` except \`get_session\` may return \`ok: false\` + \`error\`.

**Session id:** Opaque string from \`list_sessions\`: \`{source}:{base64url(JSON)}\`. Pass unchanged to \`get_session\`.
`;

export const RESOURCE_TOOLS_CONTROL = `# Poke agents — control tools (CLI)

All control tools take \`provider\`: \`cursor\` | \`opencode\`. **Only Cursor** runs the \`agent\` CLI today; OpenCode returns \`ok: false\` stubs.

| Tool | When to use |
|------|-------------|
| \`control_capabilities\` | First integration; feature matrix + env vars |
| \`control_create_session\` | New empty CLI chat → UUID for \`--resume\` |
| \`control_run_agent\` | Headless \`agent -p "..."\`; optional \`session_id\` (CLI UUID), \`continue_session\`, \`trust\`, \`model\`, etc. |
| \`control_cli_status\` | \`agent about\` + \`status\` (login / build) |
| \`control_session_status\` | Metadata for a **disk** \`list_sessions\` id; optional \`include_message_count\` |
| \`control_stop_session\` | Explains that CLI **cannot** stop an in-flight run |
| \`control_cursor_cli_chat_from_session\` | Map disk id → \`composerId\` for \`--resume\` when present |

**Two Cursor ids:** (1) Disk/MCP id from \`list_sessions\`. (2) CLI UUID from \`control_create_session\`. Bridge with \`control_cursor_cli_chat_from_session\` when possible.

**Env:** \`POKE_AGENTS_CURSOR_AGENT_BIN\`, \`POKE_AGENTS_AGENT_TIMEOUT_MS\` (default 600000 ms).
`;

export const RESOURCE_SESSION_IDS = `# Session identifiers (important)

1. **MCP / disk id** — From \`list_sessions[].id\`. Encoding: product \`source\` + base64url(JSON of on-disk chat row). Use with \`get_session\`, \`control_session_status\`, \`control_cursor_cli_chat_from_session\`.

2. **Cursor CLI chat id** — UUID from \`control_create_session\` / \`agent create-chat\`. Use as \`session_id\` in \`control_run_agent\` (maps to \`--resume\`).

Do not pass the encoded MCP id to \`control_run_agent.session_id\` unless it happens to be a raw UUID.
`;

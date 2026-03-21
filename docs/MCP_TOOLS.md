# MCP tools contract (`@leoakok/poke-agents`)

Stable **tool names** and **parameter keys** (snake_case) matter for clients and prompts.

## Prompts & resources (how models learn workflows)

Besides **tool descriptions/schemas**, this server exposes:

| Kind | What the client should do | Names / URIs |
|------|---------------------------|--------------|
| **Prompts** | Offer as user-visible templates; body is a **user** message that instructs the model which tools to call in order | `getting_started`, `workflow_inspect_saved_chats`, `workflow_cursor_headless_task`, `workflow_bridge_disk_to_cli` |
| **Resources** | `resources/read` for markdown playbooks | `poke-agents://guide/tools-read`, `poke-agents://guide/tools-control`, `poke-agents://guide/session-ids` |

**Repo skill (not MCP):** [`../SKILL.md`](../SKILL.md) — for Cursor-style project skills so local agents know when this package applies.

Many hosts hide prompts/resources unless enabled in settings; **tool list** remains the universal signal.

## Response envelope (`structuredContent` + `content`)

Every tool returns **MCP `structuredContent`** validated against its **`outputSchema`**, and a **duplicate JSON** string in `content[0].text` for human-readable logs.

### Read tools

| Tool | `ok` | Success fields | Error fields |
|------|------|----------------|--------------|
| `list_connectors` | always `true` | `connectors[]`, `profile_editors[]` | — |
| `list_sessions` | always `true` | `sessions[]` | — |
| `get_session` | `true` / `false` | `session`, `messages` | `error` |

### Control tools

| Tool | `ok` | Notes |
|------|------|--------|
| `control_capabilities` | *(no `ok` field)* | `providers`, `cursor_agent_binary`, `session_ids`, `env` |
| `control_create_session` | `true` / `false` | Success: `chat_id`, `cwd`, `hint`. Failure: `error`, optional `stdout`/`stderr` |
| `control_run_agent` | `true` / `false` | Cursor: `exit_code`, `signal`, `timed_out`, `stdout`, `stderr`. Stub: `error` only |
| `control_cli_status` | `true` / `false` | Success: `about`, `status`, `binary` |
| `control_session_status` | `true` / `false` | Success: `adapter`, `session`, `message_count` or `message_count_error` |
| `control_stop_session` | always `false` | `supported: false`, `guidance` |
| `control_cursor_cli_chat_from_session` | `true` / `false` | Success: `cli_chat_id`, `row_keys`, `hint` |

---

## Profile (`POKE_AGENTS_EDITORS`)

Only adapters listed here participate in **read** and **control_session_status** checks. Default: **`cursor,opencode`**.  
See [`SETUP_POKE_CURSOR_OPENCODE.md`](SETUP_POKE_CURSOR_OPENCODE.md).

`list_connectors.profile_editors` echoes the active allowlist.

---

## `list_connectors`

**Title:** List enabled agent adapters  

**Description:** See `tool-schemas.ts` → `READ.list_connectors` (discovery, health probe, profile).

**Parameters:** none.

**Returns (`outputSchema`):** `ok`, `connectors[]` (`id`, `display_name`, `available`, `detail?`), `profile_editors[]`.

---

## `list_sessions`

**Title:** List recent chat sessions (disk)  

**Parameters (`inputSchema`):**

| Name | Type | Description |
|------|------|-------------|
| `source` | string? | Filter by `chat.source` or parent editor id. |
| `limit` | number? | 1–500, default 50. |
| `project_path` | string? | Substring match on stored folder when present. |

**Returns:** `ok`, `sessions[]` (`id`, `source`, `title?`, `last_updated_at?`, `project_path?`).

---

## `get_session`

**Title:** Load full chat transcript (disk)  

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| `session_id` | string | Exact `sessions[].id` from `list_sessions`. |

**Returns:** `ok`. If `true`: `session`, `messages[]` (`role`, `content`, `model?`). If `false`: `error`.

---

## Control plane — `provider: cursor | opencode`

Shared **`provider`** enum (see `tool-schemas.ts` → `providerParam`). **Cursor** uses the **`agent`** CLI; **OpenCode** control handlers return **`ok: false`** stubs until implemented.

**Env:** `POKE_AGENTS_CURSOR_AGENT_BIN`, `POKE_AGENTS_AGENT_TIMEOUT_MS`.

### Session id shapes (Cursor)

| Kind | Use |
|------|-----|
| Disk / MCP | `list_sessions[].id` → `get_session`, `control_session_status`, bridge tool |
| CLI UUID | `control_create_session.chat_id` → `control_run_agent.session_id` |

### `control_capabilities`

**Parameters:** none. **Returns:** feature matrix, binary path, id conventions, env hints.

### `control_create_session`

**Parameters:** `provider`, `workspace?`  

**Returns:** `ok`, `provider`, `chat_id?`, `cwd?`, `hint?`, or failure diagnostics.

### `control_run_agent`

**Parameters:** `provider`, `prompt`, `workspace?`, `session_id?`, `continue_session?`, `output_format?`, `stream_partial_output?`, `model?`, `mode?`, `plan?`, `trust?`, `force?`, `approve_mcps?`, `sandbox?`, `cloud?`  

**Returns:** `ok`, `provider`, `cwd`, `exit_code`, `signal`, `timed_out`, `stdout`, `stderr` (Cursor), optional `hint` when stderr matches known Cursor issues (e.g. `[unavailable]`), or `error` (stub).

### `control_cli_status`

**Parameters:** `provider`, `workspace?`  

**Returns:** `ok`, `about`, `status`, `binary`, or `error`.

### `control_session_status`

**Parameters:** `provider`, `session_id`, `include_message_count?`  

**Returns:** `ok`, `adapter?`, `session?`, `message_count` (nullable), `message_count_error?`, or `error`.

### `control_stop_session`

**Parameters:** `provider`  

**Returns:** `ok: false`, `supported: false`, `guidance`.

### `control_cursor_cli_chat_from_session`

**Parameters:** `session_id`  

**Returns:** `ok`, `cli_chat_id?`, `row_keys?`, `hint?`, or `error`.

---

## Future

- OpenCode CLI parity on `control_*` tools.
- Search / MCP-config / usage tools when needed.

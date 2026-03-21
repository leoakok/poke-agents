# MCP tools contract (`@leoakok/poke-agents`)

**v0.2.0** — tool names and keys were tightened for Poke-style clients (shorter verbs, one vocabulary for ids).

## Prompts & resources

| Kind | Names / URIs |
|------|--------------|
| **Prompts** | `getting_started`, `workflow_inspect_saved_chats`, `workflow_cursor_headless_task`, `workflow_bridge_disk_to_cli` |
| **Resources** | `poke-agents://guide/tools-read`, `.../tools-control`, `.../session-ids`, `.../agent-streaming` |

**Repo skill:** [`../SKILL.md`](../SKILL.md).

**Smoke tests:** `npm run test:smoke` — in-process MCP client exercises every tool (see `src/smoke/mcp-tools-smoke.test.ts`). Same checks run in GitHub Actions on every PR and branch (`.github/workflows/ci-release.yml`).

## Response envelope

Every tool returns **MCP `structuredContent`** validated against **`outputSchema`**, plus duplicate JSON in `content[0].text`.

### Read tools

| Tool | `ok` | Success fields | Error |
|------|------|----------------|-------|
| `adapters` | always `true` | `connectors[]`, `editors[]` | — |
| `sessions` | always `true` | `sessions[]` | — |
| `session` | `true` / `false` | `session`, `messages` | `error` |
| `web_fetch` | `true` / `false` | HTTP preview or `error`, `error_classification` | transport / timeout |
| `web_search` | `true` / `false` | Brave `results[]` or `setup` when no API key | API / network |

### Control tools

| Tool | `ok` | Notes |
|------|------|--------|
| `control_plan` | *(no top-level `ok`)* | `providers`, `cursor_agent_binary`, `session_ids`, `session_stop`, `env` |
| `control_chat_new` | `true` / `false` | Success: `uuid`, `cwd`, `hint` |
| `control_agent` | `true` / `false` | Cursor: **blocking** run; `exit_code`, `signal`, `timed_out`, `stdout`, `stderr`, `error_classification?`, `cursor_stderr_message?`, `hint?`, `stream_json_events?`, `auto_created_cli_chat_uuid?` |
| `control_agent_start` | `true` / `false` | Immediate: `accepted`, `status` (`started` \| `failed_to_start`), `run_id?`, `callback_registered?`, `resume_uuid?`, …; background run — use `control_run_*` to pull output |
| `control_run_status` | `true` / `false` | `run_id`, lifecycle `status`, `pid`, `exit_code`, `stdout_length` / `stderr_length`, `run_error?` |
| `control_run_output_slice` | `true` / `false` | Window of captured `stdout` / `stderr` by char `offset` / `limit` |
| `control_chat_slice` | `true` / `false` | Paginated disk transcript: `messages[]`, `offset`, `total_count`, `truncated` |
| `control_chat_tail` | `true` / `false` | Last N messages (same shape as slice) |
| `control_chat_around` | `true` / `false` | Window around message `index` (same shape as slice) |
| `control_agent_check` | `true` / `false` | `about`, `status`, `binary` |
| `control_session_meta` | `true` / `false` | `adapter`, `session`, `message_count?`, `message_count_error?` |
| `control_disk_to_cli` | `true` / `false` | `uuid` (nullable), `keys`, `hint` |

---

## Profile (`POKE_AGENTS_EDITORS`)

Default **`cursor,opencode`**. See [`SETUP_POKE_CURSOR_OPENCODE.md`](SETUP_POKE_CURSOR_OPENCODE.md).

`adapters.editors` echoes the allowlist.

---

## `adapters`

**Parameters:** none.

**Returns:** `ok`, `connectors[]` (`id`, `display_name`, `available`, `detail?`), `editors[]`.

---

## `sessions`

| Param | Type | Description |
|-------|------|-------------|
| `editor` | string? | Filter: `chat.source` or adapter id. |
| `limit` | number? | 1–500, default 50. |
| `folder` | string? | Substring on stored workspace path. |

**Returns:** `ok`, `sessions[]` (`id`, `source`, `title?`, `last_updated_at?`, `project_path?`).

**HTTP:** `/api/sessions` accepts `editor`, `folder`, `limit` (legacy: `source`, `project_path`).

---

## `session`

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Exact `sessions[].id`. |

**Returns:** `ok`, `session?`, `messages?`, or `error`.

**HTTP:** `/api/session?id=…`

---

## Control plane — `provider: cursor | opencode`

**Env:** `POKE_AGENTS_CURSOR_AGENT_BIN`, `POKE_AGENTS_AGENT_TIMEOUT_MS`, optional `POKE_AGENTS_BRAVE_API_KEY` or `BRAVE_API_KEY` for `web_search`.

### Id shapes (Cursor)

| Kind | Use |
|------|-----|
| Disk | `sessions[].id` → `session`, `control_session_meta`, `control_disk_to_cli` |
| CLI | `control_chat_new.uuid` or `control_agent` / `control_agent_start` `auto_created_cli_chat_uuid` → `resume` |
| Run | `control_agent_start` → `run_id` → `control_run_status` / `control_run_output_slice` (not interchangeable with `resume`) |

**Callbacks (Poke):** On HTTP MCP, send `X-Poke-Callback-Url` and `X-Poke-Callback-Token`; completion posts small JSON (`hasMore: false`). For stdio, pass `poke_callback_url` + `poke_callback_token` on `control_agent_start`.

**Stopping runs:** not a CLI feature — see `control_plan.session_stop`.

### `control_plan`

No parameters. Returns contract + `session_stop: { supported: false, note }`.

### `control_chat_new`

`provider`, `cwd?` → `uuid` for `control_agent.resume`.

### `control_agent`

`provider`, `prompt`, `cwd?`, `resume?`, `continue_chat?`, `auto_chat?` (default **true** — runs `create-chat` when `resume` and `continue_chat` are both unset), `format?`, `stream?`, `model?`, `mode?`, `plan?`, `trust?` (default **true**), `force?`, `approve_mcp?` (default **true**), `sandbox?` (default **`disabled`** — avoids Cursor’s network-blocking sandbox; use **`enabled`** to isolate), `cloud?`

On failure, prefer `cursor_stderr_message` + `error_classification` over guessing from `[unavailable]`. With `format: stream-json` and `stream: true`, use `stream_json_events` for parsed NDJSON lines.

**Web:** The headless agent has no GUI browser. For HTTP/search, the **caller** uses `web_fetch` / `web_search` on this MCP and feeds excerpts into the next `control_agent` prompt.

### `control_agent_start`

Same parameters as `control_agent`, plus optional `poke_callback_url` / `poke_callback_token` when not using HTTP callback headers. Returns immediately with `run_id` (or `failed_to_start`). Does **not** return full stdout/stderr or `stream_json_events` — pull via `control_run_output_slice`.

### `control_run_status` / `control_run_output_slice`

`run_id` from `control_agent_start`. Output slice: `stream` (`stdout` \| `stderr`), `offset`, `limit`, `text`, `next_offset`, `truncated`.

### `control_chat_slice` / `control_chat_tail` / `control_chat_around`

`id` = disk `sessions[].id`. Paginate the transcript (`offset`/`limit`, tail `limit`, or `index` + `before`/`after`).

### `control_agent_check`

`provider`, `cwd?`

### `control_session_meta`

`provider`, `id`, `count?` (if true, loads transcript to count messages)

### `control_disk_to_cli`

`id` (disk Cursor row) → `uuid` nullable, `keys`

---

## Web tools

### `web_fetch`

`url`, `max_bytes?`, `timeout_ms?` — GET with `ok`, `status`, `body_preview`, or `error` + `error_classification` (`timeout`, `network_tls`, `network_unreachable`, …).

### `web_search`

`query`, `count?` — Brave Search API. Requires `POKE_AGENTS_BRAVE_API_KEY` or `BRAVE_API_KEY`. Returns `results[]` with `title`, `url`, `description` or structured setup instructions if the key is missing.

---

## Migration from 0.1.x

| Old | New |
|-----|-----|
| `list_connectors` | `adapters` |
| `list_sessions` (+ `source`, `project_path`) | `sessions` (+ `editor`, `folder`) |
| `get_session` (+ `session_id`) | `session` (+ `id`) |
| `profile_editors` / `list_connectors` output | `adapters.editors` |
| `control_capabilities` | `control_plan` |
| `control_create_session` (+ `workspace`) | `control_chat_new` (+ `cwd`) |
| `control_run_agent` | `control_agent` |
| `session_id` / `continue_session` / `output_format` / `stream_partial_output` / `approve_mcps` / `workspace` | `resume` / `continue_chat` / `format` / `stream` / `approve_mcp` / `cwd` |
| `chat_id` (create output) | `uuid` |
| `control_cli_status` | `control_agent_check` |
| `control_session_status` (+ `session_id`, `include_message_count`) | `control_session_meta` (+ `id`, `count`) |
| `control_stop_session` | *(removed — use `control_plan.session_stop`)* |
| `control_cursor_cli_chat_from_session` | `control_disk_to_cli` |
| `cli_chat_id`, `row_keys` (bridge) | `uuid`, `keys` |

---

## Future

- OpenCode CLI parity on control tools.

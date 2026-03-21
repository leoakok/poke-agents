# MCP tools contract (`@leoakok/poke-agents`)

**v0.2.0** — tool names and keys were tightened for Poke-style clients (shorter verbs, one vocabulary for ids).

## Prompts & resources

| Kind | Names / URIs |
|------|--------------|
| **Prompts** | `getting_started`, `workflow_inspect_saved_chats`, `workflow_cursor_headless_task`, `workflow_bridge_disk_to_cli` |
| **Resources** | `poke-agents://guide/tools-read`, `.../tools-control`, `.../session-ids`, `.../agent-streaming`, `.../http-tunnel` |
| **Tool (no resources?)** | **`poke_agents_guide`** — same guide text as structured `markdown`; `topic?`: `overview` (default), `read`, `control`, `session_ids`, `streaming`, `tunnel`, `templates`, `prompts`, `all` |

**Repo skill:** [`../SKILL.md`](../SKILL.md).

**Smoke tests:** `npm run test:smoke` — in-process MCP client exercises every tool (see `src/smoke/mcp-tools-smoke.test.ts`). Same checks run in GitHub Actions on every PR and branch (`.github/workflows/ci-release.yml`).

## Response envelope

Every tool returns **MCP `structuredContent`** validated against **`outputSchema`**, plus duplicate JSON in `content[0].text`.

### Read tools

| Tool | `ok` | Success fields | Error |
|------|------|----------------|-------|
| `poke_agents_guide` | always `true` | `topic`, `markdown`, `topics[]` | — |
| `adapters` | always `true` | `connectors[]`, `editors[]` | — |
| `sessions` | always `true` | `sessions[]` | — |
| `session` | `true` / `false` | `session`, `messages` | `error` |
| `agent_templates` | `true` / `false` | `templates[]` (`built_in`, `has_local_override`), `built_in_ids[]`, `storage_path?` | upsert/delete validation |

### Control tools

| Tool | `ok` | Notes |
|------|------|--------|
| `control_plan` | *(no top-level `ok`)* | **`active_control`**, `providers`, `cursor_agent_binary`, `opencode_cli_binary`, `codex_cli_binary`, **`orchestration`**, `session_ids`, `session_stop`, `env` |
| `control_agent` | `true` / `false` | **Async** — immediate `run_id` (etc.). Optional **`agent_template`** (`id` from `agent_templates`). Backend from **`POKE_AGENTS_CONTROL`**. No `provider` arg. Completion via Poke callback or `control_run_*` |
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

**HTTP:** `/api/sessions` accepts `editor`, `folder`, `limit`.

---

## `session`

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Exact `sessions[].id`. |

**Returns:** `ok`, `session?`, `messages?`, or `error`.

**Orchestrators (HTTP MCP / tunnel):** Very large transcripts keep the MCP request open until the full thread is read — use **`control_chat_*`** for bounded windows if you see timeouts.

**HTTP:** `/api/session?id=…`

---

## Control plane — env `POKE_AGENTS_CONTROL`

**`POKE_AGENTS_CONTROL`:** `cursor` (default), `opencode`, or `codex`. There is **no `provider` field** on control tools; switch backends only via this env and restart the MCP process if needed.

**Env (see `control_plan.env`):** `POKE_AGENTS_CURSOR_AGENT_BIN`, `POKE_AGENTS_OPENCODE_BIN`, `POKE_AGENTS_CODEX_BIN`, `POKE_AGENTS_CODEX_SKIP_GIT`, `POKE_AGENTS_AGENT_TIMEOUT_MS`, `CURSOR_API_KEY` (Cursor CLI auth), `POKE_AGENTS_CURSOR_CREATE_CHAT_TRUST`, etc.

### Id shapes

| Kind | Use |
|------|-----|
| Disk | `sessions[].id` → `session`, `control_session_meta`, `control_disk_to_cli` |
| Resume | **Cursor:** `resume_uuid` / `auto_created_cli_chat_uuid` → next `resume`. **OpenCode:** `ses_…` from JSON / callback / disk. **Codex:** thread uuid from JSONL `thread.started`, callback, or `control_disk_to_cli` |
| Run | `control_agent` → `run_id` → `control_run_status` / `control_run_output_slice` (**not** the same as `resume`) |

**Callbacks (Poke):** On HTTP MCP, send `X-Poke-Callback-Url` and `X-Poke-Callback-Token`; completion posts small JSON (`hasMore: false`). For stdio, pass `poke_callback_url` + `poke_callback_token` on `control_agent`.

**Stopping runs:** not a CLI feature — see `control_plan.session_stop`.

### `control_plan`

**What it is:** A **read-only snapshot** — **`active_control`**, per-provider capabilities, id conventions, **environment variables**, `session_stop` (in-flight CLI runs are not stopped via MCP), and **`orchestration`** for HTTP/tunnel clients. It does **not** start agents, touch disk sessions, or call Poke.

No parameters. Returns contract + `session_stop: { supported: false, note }` + **`orchestration`** (`http_mcp_and_tunnel`, `control_agent`, `large_disk_transcripts`, `network_bound_tools`) so HTTP clients (e.g. poke tunnel) can align tool classification and avoid proxy **502** timeouts.

### Poke callbacks — who calls whom

| Direction | What happens |
|-----------|----------------|
| **Poke → poke-agents** | Poke sends each MCP `tools/call` over HTTP (or stdio). Poke **waits** on that request until poke-agents returns the tool result (or times out). **poke-agents does not block waiting for Poke** during a normal tool handler. |
| **poke-agents → Poke** | After a **`control_agent`** background run **exits**, poke-agents **POSTs** JSON to **`X-Poke-Callback-Url`** with **`Authorization: Bearer`** `X-Poke-Callback-Token` (or the stdio `poke_callback_*` fields). That **outbound ping** tells Poke the run finished; large stdout/stderr stay on poke-agents for **`control_run_output_slice`**. |

**No other tool** sends the Poke completion callback — only the **`control_agent`** run lifecycle does (when URL+token were provided at start).

### `agent_templates`

`action`: **`list`** \| **`upsert`** \| **`delete`**. Custom JSON: **`~/.poke-agents/agent-templates.json`** (or **`POKE_AGENTS_TEMPLATES_PATH`**). **`upsert`** with a built-in `id` stores an **override**; **`delete`** on that `id` removes the override. See [`AGENT_TEMPLATES.md`](AGENT_TEMPLATES.md).

### `control_agent`

`prompt`, optional **`agent_template`** (template `id` — prepends `promptPreamble`), `cwd?`, `workspace?`, `resume?`, `continue_chat?`, `format?`, `stream?`, `model?`, `mode?`, `plan?`, `trust?`, `force?`, `approve_mcp?`, `sandbox?`, `cloud?`, optional `poke_callback_url` / `poke_callback_token` (stdio). Behavior depends on **`POKE_AGENTS_CONTROL`**. On success with a template, response includes **`agent_template`** and **`agent_template_title`**.

**Cursor (`cursor`):** Defaults: **`trust: true`**, **`approve_mcp: true`**, **`sandbox: "disabled"`** (avoids network-blocking sandbox; use **`enabled`** to isolate). **New session:** omit `resume` and `continue_chat` → `agent create-chat` (with `--trust` unless `POKE_AGENTS_CURSOR_CREATE_CHAT_TRUST=0`), then background `agent -p`; immediate `run_id`. **Continue:** `resume` = prior `resume_uuid` / `auto_created_cli_chat_uuid`, or `continue_chat: true` → `--continue`. `workspace` → `--workspace` (resolved vs `cwd`). Mapping: `format` → `--output-format`; `stream` → `--stream-partial-output` (with `stream-json`); `trust`, `force`, `approve_mcp`, `sandbox`, `model`, `mode`, `plan`, `cloud` as documented in `control_plan`. **`CURSOR_API_KEY`** is env-only.

**OpenCode (`opencode`):** **New session:** omit `resume` / `continue_chat` → `opencode run` in the background. **Continue:** pass the OpenCode session id (`ses_…`) as `resume`. `format` `json` / `stream-json` → `--format json` for machine-readable stdout. Cursor-only fields (`trust`, `plan`, `stream`, etc.) are ignored when the backend is OpenCode; see `control_plan.providers`.

**Codex (`codex`):** **New session:** omit `resume` / `continue_chat` → `codex exec` in the background. **Continue:** pass thread uuid as `resume` → `codex exec resume <uuid> <prompt>`. **`continue_chat`** without `resume` → `codex exec resume --last <prompt>`. `format` `json` / `stream-json` → `--json` (JSONL; `thread.started` → `thread_id`). **`force: true`** → `--dangerously-bypass-approvals-and-sandbox`. Default **`sandbox: "disabled"`** adds `--full-auto`; **`sandbox: "enabled"`** omits `--full-auto` / bypass. **`model`** → `-m`. **`POKE_AGENTS_CODEX_SKIP_GIT=1`** → `--skip-git-repo-check`. See `control_plan.providers`.

On failure to start, use `error_classification`, `cursor_stderr_message` (name kept for Poke compatibility), and `hint`. After completion, `control_run_output_slice`. **`control_run_status`** includes **`backend`**: `cursor` \| `opencode` \| `codex`.

**HTTP / search:** Not exposed on this MCP — use **Poke’s** (or your orchestrator’s) tools, then pass text into `control_agent.prompt`.

### `control_run_status` / `control_run_output_slice`

`run_id` from `control_agent`. `control_run_status` returns **`backend`** (`cursor` \| `opencode` \| `codex`). Output slice: `stream` (`stdout` \| `stderr`), `offset`, `limit`, `text`, `next_offset`, `truncated`.

### `control_chat_slice` / `control_chat_tail` / `control_chat_around`

`id` = disk `sessions[].id`. Paginate the transcript (`offset`/`limit`, tail `limit`, or `index` + `before`/`after`).

### `control_agent_check`

`cwd?` only — probes the active backend from **`POKE_AGENTS_CONTROL`**.

### `control_session_meta`

`id`, `count?` (if true, loads transcript to count messages). Works for any disk session row the adapters expose.

### `control_disk_to_cli`

`id` (disk session) → `uuid` nullable (same value as stored `composerId` — pass as `resume` when non-null), `keys`, `hint`

---

## Notes

- **Breaking vs older clients:** control tools no longer accept a `provider` argument; use **`POKE_AGENTS_CONTROL`**. Responses that previously said `provider` for the active run may use **`backend`** instead (see each tool’s `outputSchema`).

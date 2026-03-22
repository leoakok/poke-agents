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
| `control_agent` | `true` / `false` | **Async** — immediate `run_id` + **`poke_completion_notice`** + **`will_post_completion_to_poke`** (tells Poke whether a completion **POST** will fire). Optional **`agent_template`**. Backend **`POKE_AGENTS_CONTROL`**. Completion via callback or `control_run_*` |
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

Default **`cursor,opencode,codex`**. See [`SETUP_POKE_CURSOR_OPENCODE.md`](SETUP_POKE_CURSOR_OPENCODE.md).

`adapters.editors` echoes the allowlist.

---

## `poke_agents_guide`

| Param | Type | Description |
|-------|------|-------------|
| `topic` | string? | `overview` (default), `read`, `control`, `session_ids`, `streaming`, `tunnel`, `templates`, `prompts`, `all`. Unknown → `overview`. |

**Returns:** `ok`, `topic`, `markdown`, `topics[]` (valid keys for follow-up).

Use when the client cannot read MCP **resources** — same content as `poke-agents://guide/...`.

---

## `adapters`

**Parameters:** none.

**Returns:** `ok`, `connectors[]` (`id`, `display_name`, `available`, `detail?`, `server_enabled?`), `editors[]` (effective `POKE_AGENTS_EDITORS`). **cursor**, **opencode**, and **codex** are always listed first; `server_enabled: false` means that id is not in the env allowlist (no merged `sessions` rows until you add it and restart).

**When to call:** Before `sessions` if lists are empty, or to explain why an adapter is `available: false`.

---

## `sessions`

| Param | Type | Description |
|-------|------|-------------|
| `editor` | string? | Restrict to one editor (`cursor`, `opencode`, …) — matches `chat.source` / adapter id. |
| `limit` | number? | 1–500, default 50 — cap rows returned after merge. |
| `folder` | string? | Substring filter on `project_path` when stored. |

**Returns:** `ok`, `sessions[]` (`id` opaque, `source`, `title?`, `last_updated_at?`, `project_path?`).

**Note:** Does not return headless `run_id` or CLI resume ids.

**HTTP:** `/api/sessions` accepts `editor`, `folder`, `limit`.

---

## `session`

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Exact `sessions[].id` — do not guess or construct. |

**Returns:** `ok`, `session?`, `messages?`, or `error`.

**Orchestrators (HTTP MCP / tunnel):** Very large transcripts keep the MCP request open until the full thread is read — use **`control_chat_*`** for bounded windows if you see timeouts.

**HTTP:** `/api/session?id=…`

---

## `agent_templates`

| Param | Type | Description |
|-------|------|-------------|
| `action` | `"list"` \| `"upsert"` \| `"delete"` | **list** — merged rows + `built_in_ids`. **upsert** — requires `template`. **delete** — requires `delete_id`. |
| `template` | object? | For **upsert**: `{ id, title, summary, promptPreamble, pokeHint }` (no `built_in` / `has_local_override`). |
| `delete_id` | string? | For **delete**: id to remove from custom JSON; for built-ins, drops override only. |

**Returns:** `ok`, `templates[]` (with `built_in`, `has_local_override` when listed), `storage_path?`, `built_in_ids?`, or `error`.

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

### `agent_templates` (control section)

Same tool as **[Read tools → `agent_templates`](#agent_templates)** above — list/upsert/delete merged personas. Storage: **`~/.poke-agents/agent-templates.json`**. Details: [`AGENT_TEMPLATES.md`](AGENT_TEMPLATES.md).

### `control_agent`

**Returns immediately** with **`run_id`** — not the agent transcript. On **`status: started`**, always includes **`poke_completion_notice`** (explicit Poke/orchestrator handoff) and **`will_post_completion_to_poke`** (whether **`X-Poke-Callback-Url`** + token or **`poke_callback_*`** were present). Use **`control_run_status`** / **`control_run_output_slice`** when **`will_post_completion_to_poke`** is false.

`prompt`, optional **`agent_template`**, `cwd?`, `workspace?`, `resume?`, `continue_chat?`, `format?`, `stream?`, `model?`, `mode?`, `plan?`, `trust?`, `force?`, `approve_mcp?`, `sandbox?`, `cloud?`, optional `poke_callback_*` (stdio). On success with a template, response includes **`agent_template`** and **`agent_template_title`**.

**Orchestrators — important flags (Cursor):**

| Argument | Meaning |
|----------|---------|
| **`trust`** (default `true`) | Workspace trust (`--trust`). Stops “trust this folder?” blocking **headless** runs. **Does not** auto-run arbitrary shell. |
| **`force`** (default `false`) | `--force` (CLI `--yolo`). **Set `true`** when the task must **execute** terminal commands or automation; without it the model may refuse or only describe commands. **Unsafe** on untrusted prompts. |
| **`approve_mcp`** (default `true`) | `--approve-mcps` — approves **MCP servers** the agent uses, **not** the same as `force`. |
| **`mode` / `plan`** | Read-only only (`plan`, `ask`, or `plan: true`). **Omit** both for normal coding / shell (“no `build` enum — default is full agent”). |
| **`sandbox`** (default `disabled`) | Cursor sandbox; `disabled` typical for headless network/shell. |

**Cursor (`cursor`):** Defaults: **`trust: true`**, **`approve_mcp: true`**, **`sandbox: "disabled"`** (avoids network-blocking sandbox; use **`enabled`** to isolate). **New session:** omit `resume` and `continue_chat` → `agent create-chat` (with `--trust` unless `POKE_AGENTS_CURSOR_CREATE_CHAT_TRUST=0`), then background `agent -p`; immediate `run_id`. **Continue:** `resume` = prior `resume_uuid` / `auto_created_cli_chat_uuid`, or `continue_chat: true` → `--continue`. `workspace` → `--workspace` (resolved vs `cwd`). Mapping: `format` → `--output-format`; `stream` → `--stream-partial-output` (with `stream-json`); `trust`, `force`, `approve_mcp`, `sandbox`, `model`, `mode`, `plan`, `cloud` as documented in `control_plan`. **`CURSOR_API_KEY`** is env-only.

**OpenCode (`opencode`):** **New session:** omit `resume` / `continue_chat` → `opencode run` in the background. **Continue:** pass the OpenCode session id (`ses_…`) as `resume`. `format` `json` / `stream-json` → `--format json` for machine-readable stdout. Cursor-only fields (`trust`, `plan`, `stream`, etc.) are ignored when the backend is OpenCode; see `control_plan.providers`.

**Codex (`codex`):** **New session:** omit `resume` / `continue_chat` → `codex exec` in the background. **Continue:** pass thread uuid as `resume` → `codex exec resume <uuid> <prompt>`. **`continue_chat`** without `resume` → `codex exec resume --last <prompt>`. `format` `json` / `stream-json` → `--json` (JSONL; `thread.started` → `thread_id`). **`force: true`** → `--dangerously-bypass-approvals-and-sandbox`. Default **`sandbox: "disabled"`** adds `--full-auto`; **`sandbox: "enabled"`** omits `--full-auto` / bypass. **`model`** → `-m`. **`POKE_AGENTS_CODEX_SKIP_GIT=1`** → `--skip-git-repo-check`. See `control_plan.providers`.

On failure to start, use `error_classification`, `cursor_stderr_message` (name kept for Poke compatibility), and `hint`. After completion, `control_run_output_slice`. **`control_run_status`** includes **`backend`**: `cursor` \| `opencode` \| `codex`.

**HTTP / search:** Not exposed on this MCP — use **Poke’s** (or your orchestrator’s) tools, then pass text into `control_agent.prompt`.

### `control_run_status`

| Param | Type | Description |
|-------|------|-------------|
| `run_id` | string | From **`control_agent`** when the run was accepted. |

**Returns:** `ok`, `status` (`started` \| `running` \| `completed` \| `failed` \| `failed_to_start`), `backend`, `exit_code`, `timed_out`, `stdout_length` / `stderr_length`, `resume_uuid`, `run_error`, etc. Poll until terminal state, then read slices.

### `control_run_output_slice`

| Param | Type | Description |
|-------|------|-------------|
| `run_id` | string | Same as **`control_run_status`**. |
| `stream` | `"stdout"` \| `"stderr"` | **stdout** includes **`stream-json`** NDJSON; **stderr** has CLI errors. |
| `offset` | number? | UTF-16 offset (default 0); use **`next_offset`** from prior call to page. |
| `limit` | number? | Max UTF-16 units (default 8000, max 500000). |

**Returns:** `text`, `next_offset`, `truncated`, `total_length` — **this** is where the agent’s captured output lives, not in the immediate **`control_agent`** response.

### `control_chat_slice` / `control_chat_tail` / `control_chat_around`

All require disk **`id`** = exact **`sessions[].id`** (not `run_id`, not CLI uuid).

| Tool | Params | Use |
|------|--------|-----|
| `control_chat_slice` | `id`, `offset?` (default 0), `limit?` (default 50, max 200) | Forward pagination through messages |
| `control_chat_tail` | `id`, `limit?` (default 30, max 200) | Last N messages |
| `control_chat_around` | `id`, `index`, `before?`, `after?` | Window around a 0-based message index |

**Returns:** `messages[]`, `total_count`, `truncated` (slice tools) — same message shape as **`session`**, bounded.

### `control_agent_check`

| Param | Type | Description |
|-------|------|-------------|
| `cwd` | string? | Directory for the probe (default MCP cwd). |

**Returns:** `ok`, `backend`, `binary`, `about` / `status` text, `error` — use before **`control_agent`** when auth or binary path is uncertain.

### `control_session_meta`

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Disk **`sessions[].id`**. |
| `count` | boolean? | **true** = load **full** transcript to compute **`message_count`** (slow / timeout risk on huge threads). Omit or **false** for metadata only. |

### `control_disk_to_cli`

| Param | Type | Description |
|-------|------|-------------|
| `id` | string | Disk **`sessions[].id`**. |

**Returns:** `uuid` (nullable) — pass as **`control_agent.resume`** when non-null; `keys`, `hint` when mapping fails.

---

## Notes

- **Breaking vs older clients:** control tools no longer accept a `provider` argument; use **`POKE_AGENTS_CONTROL`**. Responses that previously said `provider` for the active run may use **`backend`** instead (see each tool’s `outputSchema`).

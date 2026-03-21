---
name: poke-agents-mcp
description: Use when the user connects Poke, Cursor, OpenCode, or Codex to the poke-agents MCP, or asks about local agent session history, headless CLI control, or POKE_AGENTS_EDITORS.
---

# Poke agents MCP — how to help

## Mental model

- **Read tools** (`adapters`, `sessions`, `session`) = **saved** chats on disk. Filter by `POKE_AGENTS_EDITORS` (default `cursor,opencode`).
- **Agent templates** — MCP tool **`agent_templates`** (list / upsert / delete); custom rows persist in **`~/.poke-agents/agent-templates.json`** (optional **`POKE_AGENTS_TEMPLATES_PATH`**). Dashboard **`/templates`**. Optional **`control_agent.agent_template`** = template **`id`** to prepend that template’s **`promptPreamble`** to **`prompt`**. Details: **`docs/AGENT_TEMPLATES.md`**.
- **Control tools** (`control_*`) = headless CLI via **`POKE_AGENTS_CONTROL`**: **`cursor`** (default → Cursor `agent -p`), **`opencode`** → `opencode run`, **`codex`** → `codex exec`. **No `provider` on tools** — switch backends with env only. **`control_plan`** includes **`active_control`**, binary paths, provider matrix, ids, env, **`orchestration`**. **`control_agent`** is **always async** (`run_id` immediately). Cursor: omit **`resume`** / **`continue_chat`** → `create-chat` then run. OpenCode / Codex: omit both → new run; session/thread id is in JSON stdout and/or the Poke callback after exit. Cursor defaults: **`trust`**, **`approve_mcp`**, **`sandbox: "disabled"`**. Codex: see **`control_plan`** for `sandbox` / `force`. Poke callbacks + optional **`control_run_*`**. **HTTP/search:** Poke’s tools, not poke-agents.

## Before you improvise

1. If the user needs **orientation**, suggest MCP **prompt** `getting_started`, read resource `poke-agents://guide/tools-read`, or call tool **`poke_agents_guide`** (`topic`: `overview` or `all`) when the client cannot list prompts/resources (e.g. Poke).
2. For **CLI runs**, run `control_agent_check` before burning tokens.
3. **Never** pass a disk `sessions[].id` as `control_agent.resume` unless it is already the **native resume id** (Cursor uuid, OpenCode `ses_…`, or Codex thread uuid). Map with `control_disk_to_cli` or use **`resume_uuid`** / **`auto_created_cli_chat_uuid`** (Cursor) from the previous `control_agent` run.
4. On **`control_agent`** failure to start, read **`error_classification`**, **`cursor_stderr_message`**, and **`hint`**. After the run finishes, use **`control_run_output_slice`** for stdout/stderr. With **`format: stream-json`** + **`stream: true`**, parse NDJSON from captured stdout slices or use **`stream_json_event_count`** on the Poke completion callback.

## Prompts exposed by this server (names)

| Prompt | Use case |
|--------|----------|
| `getting_started` | First turn / explain read vs control |
| `workflow_inspect_saved_chats` | List + open transcripts |
| `workflow_cursor_headless_task` | `agent -p` with resume (defaults: trust, MCP approve, sandbox off) |
| `workflow_bridge_disk_to_cli` | Disk id → CLI resume |

## Resources (markdown)

- `poke-agents://guide/tools-read`
- `poke-agents://guide/tools-control`
- `poke-agents://guide/session-ids`
- `poke-agents://guide/agent-streaming`

Full contract: `docs/MCP_TOOLS.md` in this package.

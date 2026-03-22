---
name: poke-agents-mcp
description: Use when the user connects Poke, Cursor, OpenCode, Codex, or Claude Code to the poke-agents MCP, or asks about local agent session history, headless CLI control, or POKE_AGENTS_EDITORS.
---

# Poke agents MCP — how to help

## Mental model

- **Read tools** (`adapters`, `sessions`, `session`) = **saved** chats on disk. Filter by `POKE_AGENTS_EDITORS` (default `cursor,opencode,codex,claude`).
- **Agent templates** — MCP tool **`agent_templates`** (list / upsert / delete); custom rows persist in **`~/.poke-agents/agent-templates.json`** (optional **`POKE_AGENTS_TEMPLATES_PATH`**). Dashboard **`/templates`**. Optional **`control_agent.agent_template`** = template **`id`** to prepend that template’s **`promptPreamble`** to **`prompt`**. Details: **`docs/AGENT_TEMPLATES.md`**.
- **Control tools** (`control_*`) = headless CLI via **`POKE_AGENTS_CONTROL`**: **`cursor`** (default → Cursor `agent -p`), **`opencode`** → `opencode run`, **`codex`** → `codex exec`, **`claude`** → Claude Code `claude -p`. **No `provider` on tools** — switch backends with env only. **`control_plan`** includes **`active_control`**, binary paths, provider matrix, ids, env, **`orchestration`**. **`control_agent`** returns **`run_id` immediately** plus **`poke_completion_notice`** and **`will_post_completion_to_poke`** — tell the user Poke will get a **completion POST** when true; otherwise poll **`control_run_*`**. Do not treat the tool return as the agent transcript. **Cursor:** **`trust`** vs **`force`** as in schema docs. **HTTP/search:** Poke’s tools, not poke-agents.

## Before you improvise

1. If the user needs **orientation**, suggest MCP **prompt** `getting_started`, read resource `poke-agents://guide/tools-read`, or call tool **`poke_agents_guide`** (`topic`: `overview` or `all`) when the client cannot list prompts/resources (e.g. Poke). Each tool’s **`inputSchema` / `outputSchema`** descriptions in **`tools/list`** are authoritative — read them when choosing parameters (`force`, `count`, `stream`, disk **`id`** vs **`run_id`**, etc.).
2. For **CLI runs**, run `control_agent_check` before burning tokens.
3. **Never** pass a disk `sessions[].id` as `control_agent.resume` unless it is already the **native resume id** (Cursor uuid, OpenCode `ses_…`, Codex thread uuid, or Claude Code session id). Map with `control_disk_to_cli` or use **`resume_uuid`** / **`auto_created_cli_chat_uuid`** (Cursor) from the previous `control_agent` run.
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

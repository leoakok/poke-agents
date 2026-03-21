---
name: poke-agents-mcp
description: Use when the user connects Poke, Cursor, or OpenCode to the poke-agents MCP, or asks about local agent session history, Cursor CLI agent runs, or POKE_AGENTS_EDITORS.
---

# Poke agents MCP — how to help

## Mental model

- **Read tools** (`adapters`, `sessions`, `session`) = **saved** chats on disk. Filter by `POKE_AGENTS_EDITORS` (default `cursor,opencode`).
- **Web tools** (`web_fetch`, `web_search`) = HTTP GET and Brave search (API key optional for search).
- **Control tools** (`control_*`) = **Cursor `agent` CLI** when `provider=cursor`. OpenCode control returns “not implemented” for now. **`control_agent`** (sync) and **`control_agent_start`** (async) share defaults: **`auto_chat: true`**, **`trust: true`**, **`approve_mcp: true`**, **`sandbox: "disabled"`** (set **`sandbox: "enabled"`** to isolate). Async runs: poll **`control_run_status`** / **`control_run_output_slice`** or use Poke **`X-Poke-Callback-Url`** + **`X-Poke-Callback-Token`** on HTTP MCP. The CLI has **no GUI browser** — use **`web_fetch` / `web_search`** from this MCP and pass text into prompts.

## Before you improvise

1. If the user needs **orientation**, suggest MCP **prompt** `getting_started` or read resource `poke-agents://guide/tools-read`.
2. For **CLI runs**, run `control_agent_check` (provider=cursor) before burning tokens.
3. **Never** pass a disk `sessions[].id` as `control_agent.resume` unless it is a **raw CLI uuid**. Map with `control_disk_to_cli`, use `control_chat_new`, or rely on **`auto_created_cli_chat_uuid`** from the previous `control_agent` run.
4. On **`control_agent`** / **`control_agent_start`** failure, read **`error_classification`**, **`cursor_stderr_message`**, and stderr/output slices — not only `hint`. For sync runs with progressive output use **`format: stream-json`** + **`stream: true`** and **`stream_json_events`**. For async runs, parse NDJSON from **`control_run_output_slice`** on stdout.

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

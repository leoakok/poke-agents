---
name: poke-agents-mcp
description: Use when the user connects Poke, Cursor, or OpenCode to the poke-agents MCP, or asks about local agent session history, Cursor CLI agent runs, or POKE_AGENTS_EDITORS.
---

# Poke agents MCP — how to help

## Mental model

- **Read tools** (`list_connectors`, `list_sessions`, `get_session`) = **saved** chats on disk. Filter by `POKE_AGENTS_EDITORS` (default `cursor,opencode`).
- **Control tools** (`control_*`) = **Cursor `agent` CLI** when `provider=cursor`. OpenCode control returns “not implemented” for now.

## Before you improvise

1. If the user needs **orientation**, suggest MCP **prompt** `getting_started` or read resource `poke-agents://guide/tools-read`.
2. For **CLI runs**, run `control_cli_status` (provider=cursor) before burning tokens.
3. **Never** pass a `list_sessions` encoded id to `control_run_agent.session_id` unless it is a **raw CLI UUID**. Map with `control_cursor_cli_chat_from_session` or use `control_create_session`.

## Prompts exposed by this server (names)

| Prompt | Use case |
|--------|----------|
| `getting_started` | First turn / explain read vs control |
| `workflow_inspect_saved_chats` | List + open transcripts |
| `workflow_cursor_headless_task` | `agent -p` with trust / resume |
| `workflow_bridge_disk_to_cli` | Disk id → CLI resume |

## Resources (markdown)

- `poke-agents://guide/tools-read`
- `poke-agents://guide/tools-control`
- `poke-agents://guide/session-ids`

Full contract: `docs/MCP_TOOLS.md` in this package.

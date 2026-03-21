# Poke Agents App Overview

This document is the fastest way for a new Cursor session (or engineer) to understand what this app is, what it can do, and where to look.

## 1) What this app is

`poke-agents` is a local-first **MCP server + HTTP API + dashboard** for working with coding-agent session data and running headless Cursor CLI tasks.

It has three layers:

1. **MCP tools** (primary interface for orchestrators like Poke)
2. **HTTP JSON API** (mirrors the MCP capabilities for the web UI)
3. **Next.js dashboard** (human interface for browsing sessions/live state/templates)

It is a **data + control plane**, not a full autonomous orchestrator runtime.

## 2) Core capabilities

### A. Session data (read path)

- Discover enabled adapters (`adapters`)
- List merged sessions (`sessions`)
- Read full transcript for one session (`session`)

Backed by vendored editor readers under `vendor/session-editors/`.

### B. Web helpers (orchestrator tools)

- `web_fetch`: robust HTTP GET with clear error classification
- `web_search`: Brave Search API lookup (requires API key)

Important: for headless Cursor runs, use these tools from the orchestrator side when browser-like access is needed.

### C. Cursor CLI control (control path)

- `control_plan`: provider feature/contract metadata
- `control_chat_new`: create empty Cursor chat UUID
- `control_agent`: run headless `agent -p` tasks
- `control_agent_check`: `agent about` + `agent status`
- `control_session_meta`: decode session metadata (+ optional count)
- `control_disk_to_cli`: map disk session id -> Cursor CLI resume UUID

Defaults for `control_agent` are tuned for unattended runs:

- `auto_chat: true`
- `trust: true`
- `approve_mcp: true`
- `sandbox: "disabled"` (to avoid network-restricted sandbox behavior)

### D. Agent templates

- Built-in templates: `tester`, `reviewer`, `planner`
- Custom templates persisted in `~/.poke-agents/agent-templates.json`
- Managed via MCP tool `agent_templates`
- Shown/edited in dashboard `/templates`

### E. Live runtime visibility + stop

- Process scan for active CLI `agent` runs
- Snapshot endpoint + SSE stream for refresh
- Optional stop endpoint sends `SIGINT` to matching PID
- Dashboard marks sessions that are currently tied to live CLI processes

## 3) Dashboard features

Routes:

- `/` - overview/entry
- `/sessions` - searchable saved session list (no full transcript)
- `/chat?s=<id>` - full-page transcript for selected session
- `/live` - active CLI process monitor (SSE)
- `/templates` - built-in + custom template management
- `/settings` - connector visibility/preferences

Behavior highlights:

- Legacy `/?s=<id>` redirects to `/chat?s=<id>` via `proxy.ts`
- Sidebar shows session list on `/sessions`, `/chat`, and `/live`
- “Running (CLI)” sessions are visually highlighted
- Archive/unarchive state is persisted in browser storage
- Transcript rendering hides/sanitizes noisy thinking blocks into toggles

## 4) IDs and mapping model (critical)

There are two different IDs:

1. **Disk session id** (`sessions[].id`)
   - Opaque token used for `session`, `control_session_meta`, etc.
2. **Cursor CLI UUID**
   - Used by `control_agent.resume` / `agent --resume`

Use `control_disk_to_cli` to bridge from disk session id to CLI resume UUID when possible.

## 5) Architecture map

- `src/mcp/*` - MCP tool registration, schemas, prompts/resources
- `src/http/*` - HTTP API routes and live runtime endpoints
- `src/control/*` - Cursor CLI spawn, classify, capability metadata
- `src/connectors/*` - merged adapter/session access
- `src/agent-templates-*.ts` - built-in + stored template logic
- `web/*` - Next.js dashboard + same-origin `/api/*` proxies
- `scripts/poke-run.mjs` - local launcher (MCP + web + tunnel)

## 6) Runtime and launch modes

From `agents/`:

```bash
npm install
npm run build
npm run start:poke
```

Launch options:

- `POKE_AGENTS_SKIP_WEB=1` -> run MCP/API without dashboard
- `POKE_AGENTS_SKIP_TUNNEL=1` -> skip Poke tunnel
- `POKE_AGENTS_STRICT_PORTS=1` -> fail if preferred ports are busy

Default ports:

- MCP/API: `127.0.0.1:8740`
- Dashboard: `127.0.0.1:3000`

If busy, launcher auto-selects next free port unless strict mode is enabled.

## 7) Agent-facing assets (for prompt quality)

This project exposes guidance to MCP clients in three ways:

1. Tool descriptions and schemas (`tools/list`)
2. MCP prompts:
   - `getting_started`
   - `workflow_inspect_saved_chats`
   - `workflow_cursor_headless_task`
   - `workflow_bridge_disk_to_cli`
3. MCP resources:
   - `poke-agents://guide/tools-read`
   - `poke-agents://guide/tools-control`
   - `poke-agents://guide/session-ids`
   - `poke-agents://guide/agent-streaming`

## 8) What this app does **not** do

- It does not run a full multi-agent orchestration engine internally.
- OpenCode control-path parity is not implemented yet (read-path works).
- It cannot stop every arbitrary in-flight agent run via provider-native CLI primitives.
- Headless Cursor CLI has no GUI browser; orchestrator should use `web_fetch` / `web_search`.

## 9) Troubleshooting checklist

1. **No sessions appear**
   - Check `POKE_AGENTS_EDITORS`
   - Run `adapters` and confirm connector `available`
2. **`control_agent` fails unexpectedly**
   - Inspect `error_classification`, `cursor_stderr_message`, full `stderr`
   - Run `control_agent_check` in the same cwd
3. **Need web context**
   - Use `web_fetch` / `web_search` first, then pass result excerpts into `control_agent.prompt`
4. **Live processes missing**
   - Confirm process actually contains agent CLI markers (`agent`, `--resume`, etc.)
   - Check same-user process visibility permissions
5. **Stopped stack shows npm code 130 noise**
   - This is usually SIGINT on Ctrl+C; launcher now prefers direct Next CLI spawn to reduce npm wrapper noise

## 10) Recommended first steps for any new Cursor session

1. Read this file (`docs/APP_OVERVIEW.md`)
2. Read `docs/MCP_TOOLS.md` for exact tool contract
3. Read `docs/ORCHESTRATION.md` to avoid architectural confusion
4. If touching UI, read `web/README.md`
5. If changing behavior, verify with:
   - `npm run build`
   - dashboard route smoke checks
   - a real `control_agent` run path

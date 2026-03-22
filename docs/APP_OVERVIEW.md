# Poke Agents App Overview

This document is the fastest way for a new Cursor session (or engineer) to understand what this app is, what it can do, and where to look.

## 1) What this app is

`poke-agents` is a local-first **MCP server + HTTP API + dashboard** for coding-agent session data and **headless CLI runs** (Cursor `agent`, OpenCode `opencode run`, or Codex `codex exec`, selected by **`POKE_AGENTS_CONTROL`**).

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

### B. Headless CLI control (control path)

Backend: **`POKE_AGENTS_CONTROL`** = `cursor` (default), `opencode`, or `codex`. Control tools have **no `provider` argument**.

- `control_plan`: read-only contract (`active_control`, binaries, `orchestration`); does not run agents
- `control_agent`: **async** — immediate `run_id`; Cursor: omit `resume`/`continue_chat` → `create-chat` then `agent -p`; OpenCode: omit both → `opencode run`; Codex: omit both → `codex exec`; optional Poke callback
- `control_agent_check`: probes the active backend (Cursor `about`/`status`, OpenCode version/auth, Codex version/`login status`)
- `control_session_meta`: disk session metadata (+ optional count)
- `control_disk_to_cli`: disk `sessions[].id` → `uuid` for `resume` when present

**Cursor-only defaults** (ignored or N/A for OpenCode): `trust: true`, `approve_mcp: true`, `sandbox: "disabled"`.

### C. Agent templates

- Built-in templates: `tester`, `reviewer`, `planner`
- Custom templates persisted in `~/.poke-agents/agent-templates.json`
- Managed via MCP tool `agent_templates`
- Shown/edited in dashboard `/templates`

### D. Live runtime visibility + stop

- Process scan heuristics target **Cursor** `agent` CLI patterns (OpenCode/Codex processes may not appear)
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

- Sidebar shows session list on `/sessions`, `/chat`, and `/live`
- “Running (CLI)” sessions are visually highlighted
- Archive/unarchive state is persisted in browser storage
- Transcript rendering hides/sanitizes noisy thinking blocks into toggles

## 4) IDs and mapping model (critical)

There are two different IDs:

1. **Disk session id** (`sessions[].id`)
   - Opaque token used for `session`, `control_session_meta`, etc.
2. **Resume id** (native CLI session)
   - **Cursor:** uuid for `control_agent.resume` / `agent --resume`
   - **OpenCode:** `ses_…` from prior `control_agent` / callback / JSON stdout, or `control_disk_to_cli.uuid`
   - **Codex:** thread uuid from JSONL `thread.started`, callback, or `control_disk_to_cli.uuid`

Use `control_disk_to_cli` to bridge disk → resume id when the row has a `composerId`.

## 5) Architecture map

- `src/mcp/*` - MCP tool registration, schemas, prompts/resources
- `src/http/*` - HTTP API routes and live runtime endpoints
- `src/control/*` - headless CLI spawn (Cursor, OpenCode, Codex), classify, capability metadata
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
- `POKE_AGENTS_TUNNEL_NAME` / `POKE_AGENTS_MCP_SERVER_NAME` -> Poke tunnel `-n` label and MCP server `name` (or `npx … --mcp-name "…"`)
- `POKE_AGENTS_NO_OPEN=1` -> do not auto-open the dashboard in a browser when the web app starts
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
- Live process scan is biased toward Cursor `agent` heuristics; OpenCode/Codex may not show up in `/live`.
- It cannot stop every arbitrary in-flight agent run via provider-native CLI primitives.
- Headless Cursor CLI has no GUI browser; orchestrator (Poke) should fetch URLs / search with **its own** tools, then pass text into `control_agent.prompt`.

## 9) Troubleshooting checklist

1. **No sessions appear**
   - Check `POKE_AGENTS_EDITORS`
   - Run `adapters` and confirm connector `available`
2. **`control_agent` fails unexpectedly**
   - Inspect `error_classification`, `cursor_stderr_message`, full `stderr`
   - Run `control_agent_check` (same `cwd` if you set one on `control_agent`)
3. **Need web context**
   - Use Poke’s (or your orchestrator’s) fetch/search, then pass result excerpts into `control_agent.prompt`
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

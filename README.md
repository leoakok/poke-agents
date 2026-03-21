# Poke agents MCP

**Poke** connects here: a **single MCP server** that **orchestrates other coding agents** by reading their **local session data**, plus an optional **Next.js dashboard** under [`web/`](web/).

## One command (published launcher)

Same idea as **`@leokok/poke-apple-music`**: clone/update a cache, install, build, then run **MCP HTTP + dashboard + `poke tunnel`**.

```bash
npx @leokok/poke-agents@latest
```

Flags / env: **`--yes`**, **`POKE_AGENTS_YES=1`**, **`POKE_AGENTS_REPO`**, **`POKE_AGENTS_SKIP_WEB`**, **`POKE_AGENTS_SKIP_TUNNEL`** — see [`npm/poke-agents/README.md`](npm/poke-agents/README.md).

The npm scope is **`@leokok`** (launcher only). This repo’s package name remains **`@leoakok/poke-agents`** for the full source tree.

## From a git checkout

```bash
cd agents   # repo root if this repo is only poke-agents
npm install
npm run build
npm test              # optional: MCP in-process smoke (every tool)
npm run start:poke
```

- **MCP:** `http://127.0.0.1:8740/mcp` by default; if that port (or the dashboard port) is busy, the next free port is used. Set **`POKE_AGENTS_STRICT_PORTS=1`** to require exact ports instead.
- **Dashboard:** `http://127.0.0.1:3000` by default (`POKE_AGENTS_WEB_PORT`). The UI calls **`/api/*`** on the dashboard origin and Next proxies to the real MCP URL (`POKE_AGENTS_MCP_ORIGIN` at runtime), so the page stays in sync when ports shift. Routes: **`/`** overview, **`/sessions`** (list), **`/chat?s=`** (full-page transcript), **`/live`**, **`/templates`**, **`/settings`**. Legacy **`/?s=`** redirects to **`/chat?s=`**.
- Stops tunnel only: `POKE_AGENTS_SKIP_TUNNEL=1 npm run start:poke`
- MCP only (no Next): `POKE_AGENTS_SKIP_WEB=1 npm run start:poke`

Start here for full product orientation: [`docs/APP_OVERVIEW.md`](docs/APP_OVERVIEW.md).  
More detail: [`docs/LOCAL_TEST.md`](docs/LOCAL_TEST.md).  
Maintainers: [`docs/GITHUB_READINESS.md`](docs/GITHUB_READINESS.md) · [`CONTRIBUTING.md`](CONTRIBUTING.md) · [`SECURITY.md`](SECURITY.md).

## Session editor modules (vendored)

Third-party **editor adapter** JavaScript lives in [`vendor/session-editors/`](vendor/session-editors/). **Legal attribution and license** for that subtree are in **[`NOTICE`](NOTICE)** only.

`src/connectors/registry.ts` wraps each module as an **`AgentConnector`** and uses **`getAllChats` / `getMessages(chat)`** from [`vendor/session-editors/index.js`](vendor/session-editors/index.js) for merged listing and dispatch.

**Adapter ids (`editor.name`):**  
`cursor`, `windsurf`, `antigravity`, `claude`, `vscode`, `zed`, `opencode`, `codex`, `gemini-cli`, `copilot-cli`, `cursor-agent`, `commandcode`, `goose`, `kiro`  
(Chat rows may use variant **`source`** strings; MCP **disk ids** use each row’s `source` prefix.)

## Product shape

- **MCP-first** — tools are the API ([`docs/MCP_TOOLS.md`](docs/MCP_TOOLS.md)); dashboard is a convenience UI on the same HTTP server (`/api/*`). Live **Cursor `agent` processes**: `GET /api/agent-runtime`, **SSE** `GET /api/agent-runtime/stream` (~2s ticks, macOS/Linux), **`POST /api/agent-runtime/stop`** `{ "pid": number }` sends **SIGINT** if that PID is in the latest scan (same user; local only).
- **Runtime:** Node **≥20**; **`better-sqlite3`** is required (native module used by several adapters).
- **Plan:** [`../docs/POKE_AGENT_PLAN.md`](../docs/POKE_AGENT_PLAN.md).

## Layout

| Path | Role |
|------|------|
| `web/` | Next.js + shadcn dashboard (npm workspace) |
| `scripts/poke-run.mjs` | Starts MCP + Next + optional `poke tunnel` |
| `npm/poke-agents/` | Thin **`@leokok/poke-agents`** package (publish to npm) |
| `vendor/session-editors/` | Vendored CommonJS editor readers (`package.json` sets `"type": "commonjs"`) |
| `src/connectors/registry.ts` | `allConnectors`, merged sessions, messages |
| `NOTICE` | Third-party copyright and ISC license text |
| `LICENSE` | MIT (repo; launcher is MIT in `npm/poke-agents/package.json`) |

## MCP-only (no UI)

```bash
npm start
# or HTTP:
npm run start:http
```

**Profile:** `POKE_AGENTS_EDITORS` defaults to **`cursor,opencode`**. Add more comma-separated `editor.name` values to enable other vendored adapters.

Editor wiring: [`docs/SETUP_POKE_CURSOR_OPENCODE.md`](docs/SETUP_POKE_CURSOR_OPENCODE.md).

## Tools (summary)

**Read (disk):** `adapters`, `sessions`, `session`.

**Web:** `web_fetch` (GET + clear errors), `web_search` (Brave — set `POKE_AGENTS_BRAVE_API_KEY` or `BRAVE_API_KEY`).

**Control (CLI):** `control_plan`, `control_chat_new`, `control_agent` (blocking) / **`control_agent_start`** (async `run_id` + `control_run_status` / `control_run_output_slice`; optional Poke callback headers or tool args), `control_agent_check`, `control_session_meta`, `control_disk_to_cli`, **`control_chat_slice`** / **`control_chat_tail`** / **`control_chat_around`** for large disk transcripts. Cursor is fully wired via the `agent` binary; OpenCode control is stubbed with the same tool shapes. In-flight runs cannot be stopped via CLI — see `control_plan.session_stop`. For URLs, use **`web_fetch` / `web_search`** from the orchestrator, not the GUI browser.

Details: [`docs/MCP_TOOLS.md`](docs/MCP_TOOLS.md).

## How the AI learns to use this MCP

1. **Tool metadata** — Each tool has a **title**, long **description**, **inputSchema** / **outputSchema** (Zod). Clients send this to the model in `tools/list`.
2. **MCP prompts** — Workflow templates: `getting_started`, `workflow_inspect_saved_chats`, `workflow_cursor_headless_task`, `workflow_bridge_disk_to_cli` (see `prompts/list` in clients that support prompts).
3. **MCP resources** — Short markdown guides at `poke-agents://guide/tools-read`, `.../tools-control`, `.../session-ids`, `.../agent-streaming` (`resources/list` + `resources/read`).
4. **Repo skill** — [`SKILL.md`](SKILL.md) is for editors that load project skills (e.g. Cursor); it tells the model when this stack applies and how read vs control differs.

Poke/Cursor still need to **enable** prompts and resources in the client UI if the host hides them by default.

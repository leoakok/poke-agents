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
npm run start:poke
```

- **MCP:** `http://127.0.0.1:8740/mcp` by default; if that port (or the dashboard port) is busy, the next free port is used. Set **`POKE_AGENTS_STRICT_PORTS=1`** to require exact ports instead.
- **Dashboard:** `http://127.0.0.1:3000` by default (`POKE_AGENTS_WEB_PORT`). The UI calls **`/api/*`** on the dashboard origin and Next proxies to the real MCP URL (`POKE_AGENTS_MCP_ORIGIN` at runtime), so the page stays in sync when ports shift.
- Stops tunnel only: `POKE_AGENTS_SKIP_TUNNEL=1 npm run start:poke`
- MCP only (no Next): `POKE_AGENTS_SKIP_WEB=1 npm run start:poke`

More detail: [`docs/LOCAL_TEST.md`](docs/LOCAL_TEST.md).

## Session editor modules (vendored)

Third-party **editor adapter** JavaScript lives in [`vendor/session-editors/`](vendor/session-editors/). **Legal attribution and license** for that subtree are in **[`NOTICE`](NOTICE)** only.

`src/connectors/registry.ts` wraps each module as an **`AgentConnector`** and uses **`getAllChats` / `getMessages(chat)`** from [`vendor/session-editors/index.js`](vendor/session-editors/index.js) for merged listing and dispatch.

**Adapter ids (`editor.name`):**  
`cursor`, `windsurf`, `antigravity`, `claude`, `vscode`, `zed`, `opencode`, `codex`, `gemini-cli`, `copilot-cli`, `cursor-agent`, `commandcode`, `goose`, `kiro`  
(Chat rows may use variant **`source`** strings; MCP **`session_id`** uses each row’s `source` prefix.)

## Product shape

- **MCP-first** — tools are the API ([`docs/MCP_TOOLS.md`](docs/MCP_TOOLS.md)); dashboard is a convenience UI on the same HTTP server (`/api/*`).
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

## MCP-only (no UI)

```bash
npm start
# or HTTP:
npm run start:http
```

**Profile:** `POKE_AGENTS_EDITORS` defaults to **`cursor,opencode`**. Add more comma-separated `editor.name` values to enable other vendored adapters.

Editor wiring: [`docs/SETUP_POKE_CURSOR_OPENCODE.md`](docs/SETUP_POKE_CURSOR_OPENCODE.md).

## Tools (summary)

**Read (disk):** `list_connectors`, `list_sessions`, `get_session`.

**Control (CLI):** `control_capabilities`, `control_create_session`, `control_run_agent`, `control_cli_status`, `control_session_status`, `control_stop_session`, `control_cursor_cli_chat_from_session`. Cursor is fully wired via the `agent` binary; OpenCode control is stubbed with the same tool shapes.

Details: [`docs/MCP_TOOLS.md`](docs/MCP_TOOLS.md).

## How the AI learns to use this MCP

1. **Tool metadata** — Each tool has a **title**, long **description**, **inputSchema** / **outputSchema** (Zod). Clients send this to the model in `tools/list`.
2. **MCP prompts** — Workflow templates: `getting_started`, `workflow_inspect_saved_chats`, `workflow_cursor_headless_task`, `workflow_bridge_disk_to_cli` (see `prompts/list` in clients that support prompts).
3. **MCP resources** — Short markdown guides at `poke-agents://guide/tools-read`, `.../tools-control`, `.../session-ids` (`resources/list` + `resources/read`).
4. **Repo skill** — [`SKILL.md`](SKILL.md) is for editors that load project skills (e.g. Cursor); it tells the model when this stack applies and how read vs control differs.

Poke/Cursor still need to **enable** prompts and resources in the client UI if the host hides them by default.

# Cursor + OpenCode + Poke (first step)

This MCP server reads **local sessions** from **Cursor** and **OpenCode** only by default. Other adapters stay in the tree but are off until you set `POKE_AGENTS_EDITORS`.

## 1. Build

From `agents/`:

```bash
npm install
npm run build
```


## 2. Cursor (stdio MCP)

Use an **absolute path** to `cli.mjs` (or to `dist/mcp/run.js` after build).

**Global MCP config** (typical): `~/.cursor/mcp.json` — shape matches Cursor’s docs; example:

```json
{
  "mcpServers": {
    "poke-agents": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/poke/agents/cli.mjs"],
      "env": {
        "POKE_AGENTS_EDITORS": "cursor,opencode"
      }
    }
  }
}
```

Restart Cursor. The server speaks **stdio** (default when you do not pass `--http`).

## 3. OpenCode (local MCP)

Per [OpenCode MCP docs](https://opencode.ai/docs/mcp-servers/), add a **local** server in `~/.config/opencode/opencode.json` or project `opencode.json`:

```json
{
  "mcp": {
    "poke-agents": {
      "type": "local",
      "command": ["node", "/ABSOLUTE/PATH/TO/poke/agents/cli.mjs"],
      "enabled": true,
      "environment": {
        "POKE_AGENTS_EDITORS": "cursor,opencode"
      }
    }
  }
}
```

Reload OpenCode so it picks up the config.

## 4. Poke (streamable HTTP + tunnel)

Poke needs an **HTTP** MCP endpoint, not stdio.

Terminal A — start the server (default port **8740**, override with `POKE_AGENTS_PORT` or `npm run mcp:http -- 8741`):

```bash
cd /path/to/poke/agents
node ./dist/mcp/run.js --http
```

Terminal B — tunnel (adjust flag spelling to your Poke CLI):

```bash
poke tunnel http://127.0.0.1:8740/mcp -n "Poke agents"

When using **`npm run start:poke`** / **`npx poke-agents`**, set **`POKE_AGENTS_TUNNEL_NAME`** or **`--mcp-name "…"`** so the tunnel uses your label (see `npm/poke-agents/README.md`).
```

Use the same `POKE_AGENTS_EDITORS` in the environment if you start the HTTP process manually.

## Headless control backend (`POKE_AGENTS_CONTROL`)

Read tools (`sessions`, `session`) follow **`POKE_AGENTS_EDITORS`**. **Control** tools (`control_agent`, etc.) follow **`POKE_AGENTS_CONTROL`** — no `provider` field on MCP tools.

| Value | Headless CLI |
|--------|----------------|
| `cursor` | Default. Cursor `agent` (`create-chat` + `-p`). |
| `opencode` | `opencode run` |
| `codex` | `codex exec` (OpenAI Codex CLI, e.g. `npm i -g @openai/codex`) |

Optional: **`POKE_AGENTS_OPENCODE_BIN`** / **`POKE_AGENTS_CODEX_BIN`** — absolute paths if the executables are not on `PATH`. **`POKE_AGENTS_CODEX_SKIP_GIT=1`** adds `--skip-git-repo-check` for non-git project dirs.

Set these in the same `env` / `environment` block as `POKE_AGENTS_EDITORS` for stdio MCP, or export them before `node ./dist/mcp/run.js --http`.

## 5. Tools exposed

| Tool | Purpose |
|------|---------|
| `adapters` | Adapter health + `editors` allowlist |
| `sessions` | Merged recent sessions (optional `editor`, `folder`, `limit`) |
| `session` | Full thread for `sessions[].id` (param `id`) |

## 6. Expand beyond Cursor + OpenCode

Set a wider allowlist (comma- or space-separated editor ids from the vendored bundle):

```bash
export POKE_AGENTS_EDITORS="cursor,opencode,claude,vscode"
```

Ids match **`editor.name`** in `vendor/session-editors/` (e.g. `claude`, not always the same as `chat.source`).

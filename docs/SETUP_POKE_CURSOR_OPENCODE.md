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
```

Use the same `POKE_AGENTS_EDITORS` in the environment if you start the HTTP process manually.

## 5. Tools exposed

| Tool | Purpose |
|------|---------|
| `list_connectors` | Cursor + OpenCode adapter health + `profile_editors` |
| `list_sessions` | Merged recent sessions (optional `source`, `limit`, `project_path`) |
| `get_session` | Full thread for an `id` from `list_sessions` |

## 6. Expand beyond Cursor + OpenCode

Set a wider allowlist (comma- or space-separated editor ids from the vendored bundle):

```bash
export POKE_AGENTS_EDITORS="cursor,opencode,claude,vscode"
```

Ids match **`editor.name`** in `vendor/session-editors/` (e.g. `claude`, not always the same as `chat.source`).

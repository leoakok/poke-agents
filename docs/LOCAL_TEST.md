# Local test & published launcher

## One command (npm — same pattern as Apple Music)

```bash
npx @leokok/poke-agents@latest
```

Uses a cache under **`~/.local/share/poke-agents/repo`**, runs **`npm install`**, **`npm run build`**, then **`npm run start:poke`** (MCP HTTP + Next dashboard + `poke tunnel`).

- **`POKE_AGENTS_REPO`** — git URL (default `https://github.com/leoakok/poke-agents.git`)
- **`--yes`** or **`POKE_AGENTS_YES=1`** — non-interactive cache prompts
- **`POKE_AGENTS_SKIP_WEB=1`** — MCP (+ tunnel) only
- **`POKE_AGENTS_SKIP_TUNNEL=1`** — no `poke tunnel`
- **`POKE_AGENTS_MCP_PORT`** / **`POKE_AGENTS_WEB_PORT`** — preferred ports (defaults `8740` / `3000`); if busy, the next free port is used unless **`POKE_AGENTS_STRICT_PORTS=1`**
- **`POKE_AGENTS_STRICT_PORTS=1`** — fail if preferred ports are taken (no auto bump)

The dashboard uses **same-origin `/api/*`** proxied to the MCP server, so the UI stays correct when MCP moves to another port.

See [`npm/poke-agents/README.md`](../npm/poke-agents/README.md).

## Checkout: full stack

From this repo’s root (the **`agents/`** tree):

```bash
cd /path/to/poke/agents
npm install
npm run build
npm run start:poke
```

Dashboard: [http://127.0.0.1:3000](http://127.0.0.1:3000) · MCP: [http://127.0.0.1:8740/mcp](http://127.0.0.1:8740/mcp)

### Web only (dev)

With MCP already running (`npm run start:http`):

```bash
npm run dev:web
```

## Stdio MCP (Cursor / OpenCode)

```bash
node ./cli.mjs
# or
npm start
```

Optional: `node ./cli.mjs --build` to compile first.

## HTTP MCP only (manual tunnel)

```bash
npm run start:http
```

Default URL: `http://127.0.0.1:8740/mcp` (override with `POKE_AGENTS_PORT` or pass a port: `node ./dist/mcp/run.js --http 8741`).

Then:

```bash
npx poke@latest tunnel http://127.0.0.1:8740/mcp -n "Poke agents"
```

## Dashboard JSON API (same data as MCP tools)

When the HTTP server is up:

- `GET /api/connectors`
- `GET /api/sessions`
- `GET /api/session?id=…`

For **`npm run dev:web`** with MCP elsewhere, set **`POKE_AGENTS_MCP_ORIGIN`** in `web/.env.local` (see `web/.env.example`).

## MCP tools smoke tests

After `npm run build` (or let the script build for you):

```bash
npm run test:smoke
# same as: npm test
```

Uses the official MCP **in-memory transport** + `Client` to call every registered tool with safe arguments (OpenCode stubs, invalid ids, `web_fetch` to example.com). Does **not** run a real Cursor `agent -p` job.

Tool names are asserted in `src/smoke/mcp-tools-smoke.test.ts` (`EXPECTED_MCP_TOOL_NAMES`).

CI runs the same gates on **every PR and branch**; **`npm publish`** for `@leokok/poke-agents` runs only on **`main`** (see [`.github/workflows/ci-release.yml`](../.github/workflows/ci-release.yml)).

## Quick sanity check

After `npm run build`:

```bash
node ./dist/mcp/run.js --http 18799 &
sleep 1
curl -s -o /dev/null -w "%{http_code}\n" -X GET http://127.0.0.1:18799/mcp
# expect 405
kill %1 2>/dev/null || true
```

## Point Cursor at this checkout

`~/.cursor/mcp.json` (example):

```json
{
  "mcpServers": {
    "poke-agents-local": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/poke/agents/cli.mjs", "--build"],
      "env": {
        "POKE_AGENTS_EDITORS": "cursor,opencode"
      }
    }
  }
}
```

Remove `--build` after the first successful compile if you prefer faster startup.

## Environment reminders

| Variable | Purpose |
|----------|---------|
| `POKE_AGENTS_EDITORS` | `cursor,opencode` by default if unset |
| `POKE_AGENTS_CURSOR_AGENT_BIN` | Path to `agent` if not on `PATH` |
| `POKE_AGENTS_PORT` | Default HTTP port when using `--http` without a number |
| `POKE_AGENTS_MCP_PORT` | Used by `start:poke` for MCP (falls back to `POKE_AGENTS_PORT` or `8740`) |
| `POKE_AGENTS_WEB_PORT` | Next.js port for `start:poke` (default `3000`) |

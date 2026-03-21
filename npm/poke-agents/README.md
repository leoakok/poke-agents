# `@leokok/poke-agents` (npm launcher)

One command — same pattern as `@leokok/poke-apple-music`:

1. Keeps a cached git clone under `~/.local/share/poke-agents/repo`
2. `npm install` + `npm run build` (MCP server + Next dashboard)
3. Starts **MCP HTTP**, **Next.js UI**, and **`poke tunnel`** to register the MCP with Poke

```bash
npx @leokok/poke-agents@latest
```

Non-interactive / fewer prompts:

```bash
npx @leokok/poke-agents@latest --yes
# or
POKE_AGENTS_YES=1 npx @leokok/poke-agents@latest
```

## Environment

| Variable | Purpose |
|----------|---------|
| `POKE_AGENTS_REPO` | Git URL (default: `https://github.com/leoakok/poke-agents.git`) |
| `POKE_AGENTS_YES` / `--yes` | Skip destructive cache prompts |
| `POKE_AGENTS_MCP_PORT` | MCP + dashboard API port (default `8740`) |
| `POKE_AGENTS_WEB_PORT` | Next.js port (default `3000`) |
| `POKE_AGENTS_SKIP_WEB` | `1` = MCP (+ tunnel) only, no dashboard |
| `POKE_AGENTS_SKIP_TUNNEL` | `1` = local only, no `poke tunnel` |
| `POKE_AGENTS_STRICT_PORTS` | `1` = do **not** auto-pick another port if the preferred MCP/dashboard port is busy (exit with error instead) |

## Developing from a checkout

Use the repo root (`poke/agents`), not this npm folder:

```bash
npm install
npm run build
npm run start:poke
```

Full source: [github.com/leoakok/poke-agents](https://github.com/leoakok/poke-agents).

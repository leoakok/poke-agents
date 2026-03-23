# `poke-agents` (npm launcher)

## Fast start

One command — same pattern as `@leokok/poke-apple-music`:

1. Keeps a cached git clone under `~/.local/share/poke-agents/repo`
2. `npm install` + build: full `npm run build` (MCP + Next), or **`npm run build:mcp` only** when using **`--skip-web`** / `POKE_AGENTS_SKIP_WEB=1` (no Turbopack/Next step)
3. Starts **MCP HTTP**, **Next.js UI**, and **`poke tunnel`** to register the MCP with Poke

```bash
npx poke-agents@latest
```

**MCP only (no Next.js dashboard)** — same as `POKE_AGENTS_SKIP_WEB=1`:

```bash
npx poke-agents@latest --skip-web
```

**Custom Poke + MCP name** (tunnel `-n` label + MCP server `name` as a slug of that label):

```bash
npx poke-agents@latest --name "Work laptop"
# → Poke sees "Work laptop"; MCP initialize name → work-laptop
```

Combine flags:

```bash
npx poke-agents@latest --skip-web --name "CI agents"
```

Non-interactive / fewer prompts:

```bash
npx poke-agents@latest --yes
# or
POKE_AGENTS_YES=1 npx poke-agents@latest
```

## Environment

| Variable | Purpose |
|----------|---------|
| `POKE_AGENTS_REPO` | Git URL (default: `https://github.com/leoakok/poke-agents.git`) |
| `POKE_AGENTS_YES` / `--yes` | Skip destructive cache prompts |
| `--skip-web` | Sets `POKE_AGENTS_SKIP_WEB=1` — start **MCP HTTP** (and tunnel unless skipped), **no** dashboard |
| `-n/--name "…"` | Sets `POKE_AGENTS_TUNNEL_NAME` and `POKE_AGENTS_MCP_SERVER_NAME` (slug) for Poke + MCP clients |
| `--mcp-name "…"` | Legacy alias for `--name` |
| `POKE_AGENTS_TUNNEL_NAME` | Poke tunnel display label (`-n`); default **Poke agents** |
| `POKE_AGENTS_MCP_SERVER_NAME` | MCP protocol server `name`; default **poke-agents**, or slug of tunnel name if only tunnel name is set |
| `POKE_AGENTS_MCP_PORT` | MCP + dashboard API port (default `8740`) |
| `POKE_AGENTS_WEB_PORT` | Next.js port (default `3000`) |
| `POKE_AGENTS_SKIP_WEB` | `1` = MCP (+ tunnel) only, no dashboard |
| `POKE_AGENTS_SKIP_TUNNEL` | `1` = local only, no `poke tunnel` |
| `POKE_AGENTS_NO_OPEN` | `1` = do not open the default browser when the dashboard starts |
| `POKE_AGENTS_STRICT_PORTS` | `1` = do **not** auto-pick another port if the preferred MCP/dashboard port is busy (exit with error instead) |

## CLI options

```bash
poke-agents --help
```

- `-h`, `--help` show usage
- `-v`, `--version` print launcher version
- `-y`, `--yes` run non-interactively
- `-n`, `--name <label>` set tunnel label + MCP server name slug
- `--mcp-name <label>` legacy alias for `--name`
- `--skip-web` start MCP-only mode

## Local development

Use the repo root (`poke/agents`), not this npm folder:

```bash
npm install
npm run build
npm run start:poke
```

Full source: [github.com/leoakok/poke-agents](https://github.com/leoakok/poke-agents).

## Releases and versioning

The **`poke-agents`** version on npm is released from the **`main`** branch in that repo: CI runs on every branch/PR; **semantic-release** bumps this package’s `version`, tags, and publishes **only** when changes land on **`main`** (see repo root `release.config.cjs` and `docs/GITHUB_READINESS.md`). Commit messages should follow **Conventional Commits** (`fix:`, `feat:`, etc.) so semver is correct.

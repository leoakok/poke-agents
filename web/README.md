# Poke agents — web dashboard

Next.js + shadcn UI for the **poke-agents** MCP server. Ships inside the monorepo (`../`) and with the published npm package.

## Run

```bash
cd ..
npm install
npm run build
npm run start:poke
```

Or the published launcher:

```bash
npx @leoakok/poke-agents@latest
```

## Pages

| Path | Purpose |
|------|---------|
| `/` | Overview — API status, shortcuts |
| `/sessions` | Session list and filters |
| `/chat` | Full-page transcript (`?s=` session id) |
| `/live` | CLI `agent` processes (`ps` scan + SSE) |
| `/templates` | Built-in + custom agent templates |
| `/settings` | Connectors and source toggles |

Legacy URLs `/?s=<id>` redirect to `/chat?s=<id>`.

## Configuration

The app proxies `/api/*` to the poke-agents HTTP server. Set **`POKE_AGENTS_MCP_ORIGIN`** (server) or **`NEXT_PUBLIC_POKE_AGENTS_ORIGIN`** (legacy) in `web/.env.local` if the API is not on `http://127.0.0.1:8740`.

## Publishing

The dashboard is **local-first** (`robots: noindex`). For npm, the parent package builds this app with `npm run -w web build`; output is `.next/` inside `web/`.

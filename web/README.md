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
| `/mcp-traffic` | Live `POST /mcp` JSON-RPC request/response log (SSE) |
| `/templates` | Built-in + custom agent templates |
| `/settings` | Connectors and source toggles |

Open transcripts with **`/chat?s=<session-id>`** (the app links use this form).

## Configuration

The app proxies `/api/*` to the poke-agents HTTP server. Set **`POKE_AGENTS_MCP_ORIGIN`** in `web/.env.local` if the API is not on `http://127.0.0.1:8740`.

Traffic logging: the MCP process records each **`POST /mcp`** body and response into an in-memory ring buffer and streams it at **`/api/mcp-traffic/stream`**. Disable with **`POKE_AGENTS_MCP_TRAFFIC=0`** on the MCP server if you do not want payloads retained in RAM.

## Publishing

The dashboard is **local-first** (`robots: noindex`). For npm, the parent package builds this app with `npm run -w web build`; output is `.next/` inside `web/`.

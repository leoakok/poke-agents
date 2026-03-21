# Poke agents — web dashboard

Next.js + shadcn UI for local sessions. It is part of the **poke-agents** monorepo (`../`).

Run with the rest of the stack:

```bash
cd ..
npm install
npm run build
npm run start:poke
```

Or use the published launcher:

```bash
npx @leokok/poke-agents@latest
```

The UI calls the MCP HTTP server’s JSON API (`/api/connectors`, `/api/sessions`, …). Override with `NEXT_PUBLIC_POKE_AGENTS_ORIGIN` if needed.

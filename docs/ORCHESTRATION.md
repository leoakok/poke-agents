# Where orchestration lives (Agent-MCP, Agent Orcha, Poke)

**poke-agents** (this repo) is a **data and control plane** for local agent artifacts: it exposes **MCP tools** and a small **HTTP JSON API** that mirror each other (`sessions`, `session`, `control_agent`, `agent_templates`, etc.). It does **not** embed a full multi-agent orchestration runtime.

## Agent-MCP

Use **Agent-MCP** (or any MCP-capable runner) as a **separate process** that:

1. Connects to **poke-agents** over stdio or HTTP MCP.
2. Implements the **outer loop** (plan → call tools → branch).
3. Calls `agent_templates` / **`control_agent`** (async + `run_id` + optional Poke callback) / `session` (or paginated **`control_chat_*`**) as **steps** in that loop.

In that layout, **orchestration logic lives in the MCP client** (Agent-MCP or your own script), and poke-agents remains the **tool server** for Cursor/OpenCode session IO and template storage.

## “Agent Orcha” / custom orchestrators

The same pattern applies: run an **orchestrator service** (CLI, daemon, or cloud worker) that:

- Holds goals, retries, and concurrency policy.
- Invokes poke-agents tools (or the HTTP API) over the network.
- Optionally talks to **Poke** for higher-level workflows; Poke can upsert templates via **`agent_templates`** MCP so the dashboard and automations stay aligned.

## This dashboard

The Next app under `web/` is a **human UI** on top of the HTTP API. It is not required for orchestration; it is useful for browsing transcripts and editing **custom** agent templates stored next to built-ins.

## Headless CLI vs web access

Headless **`control_agent`** uses **`POKE_AGENTS_CONTROL`**: **`cursor`** → `agent -p` (defaults avoid Cursor’s network-blocking **sandbox**), **`opencode`** → `opencode run`, **`codex`** → `codex exec`. None of these are GUI browsers. For HTTP or search, the **orchestrator** (e.g. **Poke**) should use **its own** fetch/search, then pass text into `control_agent.prompt`.

**Async runs:** **`control_agent`** returns immediately with a **`run_id`**; poll **`control_run_status`** and **`control_run_output_slice`**, or configure Poke’s HTTP MCP **`X-Poke-Callback-Url`** / **`X-Poke-Callback-Token`** (or stdio tool args) for a small completion ping — large stdout/stderr stay pull-based, not in the webhook body.

### Poke tunnel / HTTP MCP timeouts

Over **HTTP**, each tool invocation is usually **one request** that must **complete** before the MCP client sees success. **Tunnels and reverse proxies** enforce timeouts; a **502** often means the **proxy gave up waiting**, not that poke-agents failed.

- **`control_agent`** already ends the HTTP request quickly — orchestrators must **not** treat “MCP call returned” as “CLI finished”; use **callback + polling** for completion.
- Other tools can still run long on the server (**full `session`**, **`control_session_meta` with `count: true`**). Prefer **`control_chat_*`** slices when the client’s MCP HTTP deadline is tight.

Structured hints also live under **`control_plan.orchestration`**. Human-readable copy: **`poke_agents_guide`** with **`topic: tunnel`**, or MCP resource **`poke-agents://guide/http-tunnel`**.

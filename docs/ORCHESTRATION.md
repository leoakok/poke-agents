# Where orchestration lives (Agent-MCP, Agent Orcha, Poke)

**poke-agents** (this repo) is a **data and control plane** for local agent artifacts: it exposes **MCP tools** and a small **HTTP JSON API** that mirror each other (`sessions`, `session`, `control_agent`, `control_agent_start`, `agent_templates`, etc.). It does **not** embed a full multi-agent orchestration runtime.

## Agent-MCP

Use **Agent-MCP** (or any MCP-capable runner) as a **separate process** that:

1. Connects to **poke-agents** over stdio or HTTP MCP.
2. Implements the **outer loop** (plan → call tools → branch).
3. Calls `agent_templates` / `control_agent` or **`control_agent_start`** (async + `run_id` + optional Poke callback) / `session` (or paginated **`control_chat_*`**) as **steps** in that loop.

In that layout, **orchestration logic lives in the MCP client** (Agent-MCP or your own script), and poke-agents remains the **tool server** for Cursor/OpenCode session IO and template storage.

## “Agent Orcha” / custom orchestrators

The same pattern applies: run an **orchestrator service** (CLI, daemon, or cloud worker) that:

- Holds goals, retries, and concurrency policy.
- Invokes poke-agents tools (or the HTTP API) over the network.
- Optionally talks to **Poke** for higher-level workflows; Poke can upsert templates via **`agent_templates`** MCP so the dashboard and automations stay aligned.

## This dashboard

The Next app under `web/` is a **human UI** on top of the HTTP API. It is not required for orchestration; it is useful for browsing transcripts and editing **custom** agent templates stored next to built-ins.

## Cursor CLI vs web access

Headless **`control_agent`** runs `agent -p` with defaults that avoid Cursor’s **sandbox** (which often blocks network). The CLI still has **no GUI browser**. For HTTP or search, the **orchestrator** should call poke-agents **`web_fetch`** / **`web_search`**, then include the result text in the next `control_agent` prompt (or rely on shell tools inside the agent after sandbox is off).

**Async runs:** **`control_agent_start`** returns immediately with a **`run_id`**; poll **`control_run_status`** and **`control_run_output_slice`**, or configure Poke’s HTTP MCP **`X-Poke-Callback-Url`** / **`X-Poke-Callback-Token`** (or stdio tool args) for a small completion ping — large stdout/stderr stay pull-based, not in the webhook body.

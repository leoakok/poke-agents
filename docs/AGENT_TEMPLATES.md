# Agent templates (dashboard + Poke + MCP)

**Built-in** personas (`tester`, `reviewer`, `planner`) ship in `src/agent-templates-data.ts`.

**Custom** templates and **overrides** live in **`~/.poke-agents/agent-templates.json`** (override path with **`POKE_AGENTS_TEMPLATES_PATH`**). This file is under your home directory — it is **not** removed when you run `npx`, upgrade the package, or pull a new repo version.

- **Custom-only** `id` → new persona.
- **Same `id` as a built-in** → your row **replaces** the built-in in the merged list (on-disk override).
- **`delete`** removes a row from that JSON. For a built-in `id`, delete **clears your override** and the shipped default shows again.

## `control_agent.agent_template`

Optional MCP field: set **`agent_template`** to a template **`id`** from **`agent_templates`** (`action: "list"`). The server prepends that template’s **`promptPreamble`** to **`prompt`** (blank line between), then runs the headless CLI.

Successful responses echo **`agent_template`** and **`agent_template_title`** when a template was applied. Unknown ids fail fast with `failed_to_start` and an error message.

**Cursor + templates that run shell or automate aggressively:** a preamble alone does not execute commands. Use **`control_agent`** with **`force: true`** when the combined prompt should **actually run** terminal commands; **`trust`** (default) only marks the workspace trusted. See **`docs/MCP_TOOLS.md`** → `control_agent` for the full flag matrix.

## Dashboard (`/templates`)

- **New template** — new `id` on disk.
- **Customize** (built-in) — opens the merged row; **Save** writes an override with the same `id`.
- **Reset** (built-in + overridden) or **Delete** (custom) — removes the row from `agent-templates.json`.

Each row shows **`has_local_override`** when that `id` exists in the JSON file.

## Poke and automation

- **HTTP:** `GET /api/agent-templates`, `POST /api/agent-templates` with `upsert`, `delete_id`, or `replace_custom[]` (same shapes as the dashboard client).
- **MCP:** **`agent_templates`** with `action`: `list` | `upsert` | `delete`.

Reference in docs as **`template:{id}`** only for human readers; the machine field on **`control_agent`** is **`agent_template`**.

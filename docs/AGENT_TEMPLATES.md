# Agent templates (dashboard + Poke + MCP)

**Built-in** personas (`tester`, `reviewer`, `planner`) ship in `src/agent-templates-data.ts`.

**Custom** templates are stored in `~/.poke-agents/agent-templates.json` (override with `POKE_AGENTS_TEMPLATES_PATH`). Custom rows **override** a built-in if they share the same `id`.

## Dashboard

The home page loads the **merged** list from `GET /api/agent-templates` (proxied by Next to the poke-agents HTTP server). Use **New template** / **Edit** / **Delete** for custom rows; built-ins cannot be deleted from disk from the UI.

## Poke and automation

- **HTTP:** `POST /api/agent-templates` with `upsert`, `delete_id`, or `replace_custom[]` (same shapes as the dashboard client).
- **MCP:** tool **`agent_templates`** with `action`: `list` | `upsert` | `delete`.

Reference templates in prompts as **`template:{id}`** and copy or prepend the **prompt preamble** into `control_agent` (or Composer) prompts.

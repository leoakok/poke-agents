/**
 * Which headless CLI backs `control_agent` / `control_agent_check`.
 * **`POKE_AGENTS_CONTROL`:** `cursor` (default), `opencode`, `codex`, or `claude` (Claude Code).
 */
export type ControlBackendId = "cursor" | "opencode" | "codex" | "claude";

export function resolveControlBackend(): ControlBackendId {
  const raw = process.env.POKE_AGENTS_CONTROL?.trim().toLowerCase();
  if (raw === "opencode") return "opencode";
  if (raw === "codex") return "codex";
  if (raw === "claude") return "claude";
  return "cursor";
}

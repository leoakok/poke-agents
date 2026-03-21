/**
 * Which headless CLI backs `control_agent` / `control_agent_check`.
 * **`POKE_AGENTS_CONTROL`:** `cursor` (default), `opencode`, or `codex`.
 */
export type ControlBackendId = "cursor" | "opencode" | "codex";

export function resolveControlBackend(): ControlBackendId {
  const raw = process.env.POKE_AGENTS_CONTROL?.trim().toLowerCase();
  if (raw === "opencode") return "opencode";
  if (raw === "codex") return "codex";
  return "cursor";
}

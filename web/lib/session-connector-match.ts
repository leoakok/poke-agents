import type { SessionRow } from "@/lib/poke-agents-api";

/** Map a session row to at least one connector id from the profile (heuristic). */
export function sessionMatchesConnector(
  sessionSource: string,
  connectorId: string,
): boolean {
  const src = sessionSource.toLowerCase();
  const id = connectorId.toLowerCase();
  if (src === id) return true;
  if (src.startsWith(`${id}-`) || src.startsWith(`${id}_`)) return true;
  if (id === "claude" && src.includes("claude")) return true;
  if (id === "cursor" && src.startsWith("cursor")) return true;
  if (id === "cursor-agent" && src.includes("cursor")) return true;
  if (id === "vscode" && (src.includes("vscode") || src.includes("copilot")))
    return true;
  return false;
}

export function sessionVisibleWithEnabledConnectors(
  session: SessionRow,
  enabledConnectorIds: Set<string>,
): boolean {
  if (enabledConnectorIds.size === 0) return false;
  for (const cid of enabledConnectorIds) {
    if (sessionMatchesConnector(session.source, cid)) return true;
  }
  return false;
}

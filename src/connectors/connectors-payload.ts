import { getAllowedEditorIds } from "../profile.js";
import { allConnectors } from "./registry.js";

export type ConnectorJsonRow = {
  id: string;
  display_name: string;
  available: boolean;
  detail?: string;
  /** False when `id` is not in `POKE_AGENTS_EDITORS` on this process (dashboard still lists core editors). */
  server_enabled: boolean;
};

/**
 * Core disk adapters for Poke + MCP docs. Always listed first; then other editors in the server allowlist.
 * Matches dashboard `/api/connectors` and MCP `adapters` tool output shape.
 */
export async function buildConnectorsPayload(): Promise<{
  connectors: ConnectorJsonRow[];
  editors: string[];
}> {
  const allowed = getAllowedEditorIds();
  const byId = new Map(allConnectors.map((c) => [c.id, c]));
  const coreOrder = ["cursor", "opencode", "codex"] as const;
  const seen = new Set<string>();

  async function rowFor(c: (typeof allConnectors)[number]): Promise<ConnectorJsonRow> {
    const h = await c.health();
    return {
      id: c.id,
      display_name: c.displayName,
      available: h.available,
      detail: h.detail,
      server_enabled: allowed.has(c.id),
    };
  }

  const connectors: ConnectorJsonRow[] = [];
  for (const id of coreOrder) {
    const c = byId.get(id);
    if (!c) continue;
    connectors.push(await rowFor(c));
    seen.add(id);
  }
  for (const c of allConnectors) {
    if (seen.has(c.id)) continue;
    if (!allowed.has(c.id)) continue;
    connectors.push(await rowFor(c));
    seen.add(c.id);
  }

  return { connectors, editors: [...allowed] };
}

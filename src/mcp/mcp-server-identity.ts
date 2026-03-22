/**
 * MCP `initialize` server `name` + alignment with `poke tunnel -n` display label.
 */

/** Slug for protocol `name` (lowercase, hyphens, max 64). */
export function slugifyMcpServerName(display: string): string {
  const t = display
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (t.length === 0) return "poke-agents";
  return t.length > 64 ? t.slice(0, 64) : t;
}

/**
 * `POKE_AGENTS_MCP_SERVER_NAME` if set, else slug of `POKE_AGENTS_TUNNEL_NAME`, else `poke-agents`.
 */
export function resolveMcpServerName(): string {
  const explicit = process.env.POKE_AGENTS_MCP_SERVER_NAME?.trim();
  if (explicit && explicit.length > 0) {
    return explicit.length > 64 ? explicit.slice(0, 64) : explicit;
  }
  const tunnel = process.env.POKE_AGENTS_TUNNEL_NAME?.trim();
  if (tunnel && tunnel.length > 0) {
    return slugifyMcpServerName(tunnel);
  }
  return "poke-agents";
}

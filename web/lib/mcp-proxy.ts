/** MCP HTTP server base (no trailing slash). Used by Next route handlers only. */
export function mcpUpstreamBase(): string {
  return (
    process.env.POKE_AGENTS_MCP_ORIGIN?.replace(/\/$/, "") ||
    "http://127.0.0.1:8740"
  );
}

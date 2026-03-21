/** Session list and filters (no transcript). */
export const SESSIONS_HREF = "/sessions";

/** Full-height transcript view. */
export const CHAT_HREF = "/chat";

/** Live MCP HTTP JSON-RPC log (SSE). */
export const MCP_TRAFFIC_HREF = "/mcp-traffic";

export function chatHref(sessionId: string): string {
  return `${CHAT_HREF}?s=${encodeURIComponent(sessionId)}`;
}

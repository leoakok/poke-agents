/** Session list and filters (no transcript). */
export const SESSIONS_HREF = "/sessions";

/** Full-height transcript view. */
export const CHAT_HREF = "/chat";

export function chatHref(sessionId: string): string {
  return `${CHAT_HREF}?s=${encodeURIComponent(sessionId)}`;
}

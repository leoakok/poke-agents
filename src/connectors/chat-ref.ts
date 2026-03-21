import type { SessionSummary } from "./types.js";

/** Stable handle for MCP: full vendor chat row survives round-trip through getMessages(chat). */
export function encodeChatRef(chat: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(chat), "utf8").toString("base64url");
}

export function decodeChatRef(nativeId: string): Record<string, unknown> {
  const json = Buffer.from(nativeId, "base64url").toString("utf8");
  return JSON.parse(json) as Record<string, unknown>;
}

export function unifiedSessionIdFromChat(chat: Record<string, unknown>): string {
  const source = String(chat.source ?? "");
  if (!source) throw new Error("Chat missing source");
  return `${source}:${encodeChatRef(chat)}`;
}

export function chatToSummary(chat: Record<string, unknown>): SessionSummary {
  const source = String(chat.source ?? "");
  const nativeId = encodeChatRef(chat);
  const lastRaw = chat.lastUpdatedAt ?? chat.createdAt;
  const lastUpdatedAt =
    typeof lastRaw === "number"
      ? new Date(lastRaw).toISOString()
      : typeof lastRaw === "string"
        ? lastRaw
        : undefined;
  return {
    id: `${source}:${nativeId}`,
    source,
    nativeId,
    title: chat.name != null ? String(chat.name) : undefined,
    lastUpdatedAt,
    projectPath:
      typeof chat.folder === "string" ? chat.folder : undefined,
  };
}

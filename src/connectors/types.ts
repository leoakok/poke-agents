/**
 * Connector contract — implemented by vendored session editor modules
 * (`vendor/session-editors/*.js`) via `vendor-editors-load.ts` + `registry.ts`.
 */

/** Upstream `chat.source` / editor `name` (e.g. cursor, claude-code, windsurf-next). */
export type ConnectorId = string;

export interface ConnectorHealth {
  available: boolean;
  detail?: string;
}

export interface ListSessionsOptions {
  limit?: number;
  projectPath?: string;
}

export interface SessionSummary {
  id: string;
  source: string;
  nativeId: string;
  title?: string;
  lastUpdatedAt?: string;
  projectPath?: string;
}

export type MessageRole = "user" | "assistant" | "system" | "unknown";

export interface SessionMessage {
  role: MessageRole;
  content: string;
  model?: string;
}

export interface AgentConnector {
  readonly id: ConnectorId;
  readonly displayName: string;
  health(): Promise<ConnectorHealth>;
  listSessions(options: ListSessionsOptions): Promise<SessionSummary[]>;
  getMessages(nativeSessionId: string): Promise<SessionMessage[]>;
}

export function parseUnifiedSessionId(
  sessionId: string
): { source: string; nativeId: string } | null {
  const idx = sessionId.indexOf(":");
  if (idx <= 0) return null;
  const source = sessionId.slice(0, idx);
  const nativeId = sessionId.slice(idx + 1);
  if (!source || !nativeId) return null;
  return { source, nativeId };
}

import type {
  AgentConnector,
  ConnectorHealth,
  ConnectorId,
  ListSessionsOptions,
  SessionMessage,
  SessionSummary,
} from "./types.js";
import { parseUnifiedSessionId } from "./types.js";
import {
  chatMatchesSourceFilter,
  editorForChatSource,
  loadVendorEditors,
  type VendorEditorModule,
} from "./vendor-editors-load.js";
import { chatToSummary, decodeChatRef } from "./chat-ref.js";
import { normalizeSessionMessages } from "./message-normalize.js";
import { getAllowedEditorIds } from "../profile.js";

function displayNameForEditor(
  editor: VendorEditorModule,
  labels: Record<string, string>
): string {
  if (editor.labels) {
    for (const v of Object.values(editor.labels)) {
      if (v) return v;
    }
  }
  return labels[editor.name] ?? editor.name;
}

function makeConnector(
  editor: VendorEditorModule,
  labels: Record<string, string>
): AgentConnector {
  const bundle = () => loadVendorEditors();
  return {
    id: editor.name,
    displayName: displayNameForEditor(editor, labels),
    health: async (): Promise<ConnectorHealth> => {
      try {
        editor.getChats();
        return { available: true };
      } catch (e) {
        return {
          available: false,
          detail: e instanceof Error ? e.message : String(e),
        };
      }
    },
    listSessions: async (
      options: ListSessionsOptions
    ): Promise<SessionSummary[]> => {
      const { limit = 200, projectPath } = options;
      let chats: Record<string, unknown>[];
      try {
        chats = editor.getChats();
      } catch {
        return [];
      }
      let rows = chats.map((c) => chatToSummary(c));
      if (projectPath) {
        rows = rows.filter(
          (r) =>
            r.projectPath &&
            (r.projectPath === projectPath ||
              r.projectPath.includes(projectPath))
        );
      }
      rows.sort((a, b) =>
        (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "")
      );
      return rows.slice(0, limit);
    },
    getMessages: async (
      nativeSessionId: string
    ): Promise<SessionMessage[]> => {
      const chat = decodeChatRef(nativeSessionId);
      const raw = bundle().getMessages(chat);
      return normalizeSessionMessages(
        Array.isArray(raw) ? raw : []
      );
    },
  };
}

function buildConnectors(): readonly AgentConnector[] {
  const { editors, editorLabels } = loadVendorEditors();
  return editors.map((ed) => makeConnector(ed, editorLabels));
}

export const allConnectors: readonly AgentConnector[] = buildConnectors();

const byEditorName = new Map<ConnectorId, AgentConnector>(
  allConnectors.map((c) => [c.id, c])
);

export function getConnector(source: ConnectorId): AgentConnector | undefined {
  return byEditorName.get(source);
}

/** Resolve MCP `source` filter: editor name (e.g. `claude`) or `chat.source` (e.g. `claude-code`). */
export function resolveConnectorsForFilter(
  filter: string | undefined
): readonly AgentConnector[] {
  if (!filter) return allConnectors;
  const { editors } = loadVendorEditors();
  const direct = byEditorName.get(filter);
  if (direct) return [direct];
  const ed = editorForChatSource(editors, filter);
  if (ed) {
    const c = byEditorName.get(ed.name);
    if (c) return [c];
  }
  return allConnectors.filter((c) => c.id === filter);
}

export async function listAllSessionsMerged(options: {
  limit?: number;
  projectPath?: string;
  source?: string;
}): Promise<SessionSummary[]> {
  const { limit = 50, projectPath, source } = options;
  const bundle = loadVendorEditors();
  let chats: Record<string, unknown>[];
  try {
    chats = bundle.getAllChats();
  } catch {
    return [];
  }
  if (source) {
    chats = chats.filter((c) =>
      chatMatchesSourceFilter(c, source, bundle.editors)
    );
  }
  let rows = chats.map((c) => chatToSummary(c));
  if (projectPath) {
    rows = rows.filter(
      (r) =>
        r.projectPath &&
        (r.projectPath === projectPath ||
          r.projectPath.includes(projectPath))
    );
  }
  rows.sort((a, b) =>
    (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "")
  );
  return rows.slice(0, limit);
}

export async function getMessagesForUnifiedSession(sessionId: string): Promise<
  | { ok: true; source: string; messages: SessionMessage[] }
  | { ok: false; error: string }
> {
  const parsed = parseUnifiedSessionId(sessionId);
  if (!parsed) {
    return { ok: false, error: "Invalid session_id (expected source:payload)" };
  }
  let chat: Record<string, unknown>;
  try {
    chat = decodeChatRef(parsed.nativeId);
  } catch {
    return { ok: false, error: "Invalid session payload (bad encoding)" };
  }
  const chatSource = String(chat.source ?? "");
  if (chatSource !== parsed.source) {
    return {
      ok: false,
      error: "session_id prefix does not match payload source",
    };
  }
  const bundle = loadVendorEditors();
  try {
    const raw = bundle.getMessages(chat);
    const messages = normalizeSessionMessages(
      Array.isArray(raw) ? raw : []
    );
    return { ok: true, source: parsed.source, messages };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

function editorNameForChat(
  chat: Record<string, unknown>,
  editors: VendorEditorModule[]
): string | undefined {
  const src = String(chat.source ?? "");
  return editorForChatSource(editors, src)?.name;
}

/** Connectors enabled by `POKE_AGENTS_EDITORS` (default: cursor, opencode). */
export function activeConnectors(): readonly AgentConnector[] {
  const allowed = getAllowedEditorIds();
  return allConnectors.filter((c) => allowed.has(c.id));
}

/** Merged sessions, only from profile editors. */
export async function listSessionsForProfile(options: {
  limit?: number;
  projectPath?: string;
  source?: string;
}): Promise<SessionSummary[]> {
  const allowed = getAllowedEditorIds();
  const bundle = loadVendorEditors();
  let chats: Record<string, unknown>[];
  try {
    chats = bundle.getAllChats();
  } catch {
    return [];
  }
  chats = chats.filter((c) => {
    const name = editorNameForChat(c, bundle.editors);
    return name != null && allowed.has(name);
  });
  const { limit = 50, projectPath, source } = options;
  if (source) {
    chats = chats.filter((c) =>
      chatMatchesSourceFilter(c, source, bundle.editors)
    );
  }
  let rows = chats.map((c) => chatToSummary(c));
  if (projectPath) {
    rows = rows.filter(
      (r) =>
        r.projectPath &&
        (r.projectPath === projectPath ||
          r.projectPath.includes(projectPath))
    );
  }
  rows.sort((a, b) =>
    (b.lastUpdatedAt ?? "").localeCompare(a.lastUpdatedAt ?? "")
  );
  return rows.slice(0, limit);
}

/** Load messages only if the chat’s adapter is in the active profile. */
export async function getMessagesForProfile(sessionId: string): Promise<
  | {
      ok: true;
      session: {
        id: string;
        source: string;
        title?: string;
        project_path?: string;
        last_updated_at?: string;
      };
      messages: SessionMessage[];
    }
  | { ok: false; error: string }
> {
  const parsed = parseUnifiedSessionId(sessionId);
  if (!parsed) {
    return { ok: false, error: "Invalid session_id (expected source:payload)" };
  }
  let chat: Record<string, unknown>;
  try {
    chat = decodeChatRef(parsed.nativeId);
  } catch {
    return { ok: false, error: "Invalid session payload (bad encoding)" };
  }
  const chatSource = String(chat.source ?? "");
  if (chatSource !== parsed.source) {
    return {
      ok: false,
      error: "session_id prefix does not match payload source",
    };
  }
  const bundle = loadVendorEditors();
  const edName = editorNameForChat(chat, bundle.editors);
  if (!edName || !getAllowedEditorIds().has(edName)) {
    return {
      ok: false,
      error:
        "This session is outside the active profile (set POKE_AGENTS_EDITORS).",
    };
  }
  try {
    const raw = bundle.getMessages(chat);
    const messages = normalizeSessionMessages(
      Array.isArray(raw) ? raw : []
    );
    const summary = chatToSummary(chat);
    return {
      ok: true,
      session: {
        id: summary.id,
        source: summary.source,
        title: summary.title,
        project_path: summary.projectPath,
        last_updated_at: summary.lastUpdatedAt,
      },
      messages,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

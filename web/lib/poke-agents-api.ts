/**
 * Dashboard talks to the MCP HTTP JSON API.
 * - In the browser: same-origin `/api/*` routes (proxied by Next to POKE_AGENTS_MCP_ORIGIN).
 * - On the server: direct MCP origin from env (dev / SSR).
 */
export function getMcpUpstreamBase(): string {
  return process.env.POKE_AGENTS_MCP_ORIGIN?.replace(/\/$/, "") || "";
}

/** Empty string = same-origin (browser uses Next proxy). */
export function getApiBase(): string {
  if (typeof window !== "undefined") {
    return "";
  }
  return getMcpUpstreamBase();
}

function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export type ConnectorRow = {
  id: string;
  display_name: string;
  available: boolean;
  detail?: string;
  /** False when this id is not in `POKE_AGENTS_EDITORS` on the MCP host (dashboard still lists it). */
  server_enabled?: boolean;
};

export type ConnectorsResponse =
  | { ok: true; connectors: ConnectorRow[]; editors: string[] }
  | { ok: false; error: string };

export type SessionRow = {
  id: string;
  source: string;
  title?: string;
  last_updated_at?: string;
  project_path?: string;
};

export type SessionsResponse =
  | { ok: true; sessions: SessionRow[] }
  | { ok: false; error: string };

export type SessionMessage = {
  role: string;
  content: string;
  model?: string;
};

export type SessionDetailResponse =
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
  | { ok: false; error: string };

export type AgentProcessRow = {
  pid: number;
  ppid: number;
  elapsed: string;
  command: string;
  mode: "headless" | "interactive" | "other";
  /** Present from server ≥0.2 — Cursor `agent`, OpenCode `run`, or Codex `exec`. */
  cli?: "cursor-agent" | "opencode" | "codex" | "other";
};

export type AgentRuntimeResponse =
  | {
      ok: true;
      scanned_at: string;
      platform: string;
      processes: AgentProcessRow[];
      note?: string;
    }
  | { ok: false; error: string; scanned_at: string };

export type AgentTemplateRow = {
  id: string;
  title: string;
  summary: string;
  promptPreamble: string;
  pokeHint: string;
  built_in?: boolean;
  /** True when this id is stored in ~/.poke-agents/agent-templates.json (custom-only or override). */
  has_local_override?: boolean;
};

export type AgentTemplatesListResponse =
  | {
      ok: true;
      storage_path: string;
      built_in_ids: string[];
      templates: AgentTemplateRow[];
    }
  | { ok: false; error: string };

export type AgentTemplatesMutationBody =
  | {
      upsert: {
        id: string;
        title: string;
        summary: string;
        promptPreamble: string;
        pokeHint: string;
      };
    }
  | { delete_id: string }
  | {
      replace_custom: Array<{
        id: string;
        title: string;
        summary: string;
        promptPreamble: string;
        pokeHint: string;
      }>;
    };

export async function fetchConnectors(): Promise<ConnectorsResponse> {
  const r = await fetch(apiUrl("/api/connectors"), { cache: "no-store" });
  if (!r.ok) {
    return {
      ok: false,
      error: `HTTP ${r.status} ${r.statusText}`,
    };
  }
  return r.json() as Promise<ConnectorsResponse>;
}

function sessionsPathWithQuery(params?: {
  limit?: number;
  editor?: string;
}): string {
  const u = new URL("/api/sessions", "http://_");
  if (params?.limit) u.searchParams.set("limit", String(params.limit));
  if (params?.editor) u.searchParams.set("editor", params.editor);
  return `${u.pathname}${u.search}`;
}

function sessionPathWithQuery(sessionId: string): string {
  const u = new URL("/api/session", "http://_");
  u.searchParams.set("id", sessionId);
  return `${u.pathname}${u.search}`;
}

export async function fetchSessions(params?: {
  limit?: number;
  editor?: string;
}): Promise<SessionsResponse> {
  const path = sessionsPathWithQuery(params);
  const url = getApiBase() === "" ? path : `${getApiBase()}${path}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    return {
      ok: false,
      error: `HTTP ${r.status} ${r.statusText}`,
    };
  }
  return r.json() as Promise<SessionsResponse>;
}

export type StopAgentResponse =
  | { ok: true; pid: number }
  | { ok: false; error: string };

export async function stopAgentProcess(pid: number): Promise<StopAgentResponse> {
  const r = await fetch(apiUrl("/api/agent-runtime/stop"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pid }),
  });
  const text = await r.text();
  try {
    return JSON.parse(text) as StopAgentResponse;
  } catch {
    return {
      ok: false,
      error: text || `HTTP ${r.status} ${r.statusText}`,
    };
  }
}

export async function fetchAgentRuntime(): Promise<AgentRuntimeResponse> {
  const r = await fetch(apiUrl("/api/agent-runtime"), { cache: "no-store" });
  if (!r.ok) {
    return {
      ok: false,
      scanned_at: new Date().toISOString(),
      error: `HTTP ${r.status} ${r.statusText}`,
    };
  }
  return r.json() as Promise<AgentRuntimeResponse>;
}

export function agentRuntimeStreamUrl(): string {
  const base = getApiBase();
  const path = "/api/agent-runtime/stream";
  return base ? `${base}${path}` : path;
}

export async function fetchAgentTemplates(): Promise<AgentTemplatesListResponse> {
  const r = await fetch(apiUrl("/api/agent-templates"), { cache: "no-store" });
  if (!r.ok) {
    return {
      ok: false,
      error: `HTTP ${r.status} ${r.statusText}`,
    };
  }
  return r.json() as Promise<AgentTemplatesListResponse>;
}

export async function mutateAgentTemplates(
  body: AgentTemplatesMutationBody,
): Promise<AgentTemplatesListResponse> {
  const r = await fetch(apiUrl("/api/agent-templates"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try {
    return JSON.parse(text) as AgentTemplatesListResponse;
  } catch {
    return {
      ok: false,
      error: text || `HTTP ${r.status} ${r.statusText}`,
    };
  }
}

export async function fetchSessionDetail(
  sessionId: string,
): Promise<SessionDetailResponse> {
  const path = sessionPathWithQuery(sessionId);
  const url = getApiBase() === "" ? path : `${getApiBase()}${path}`;
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    const j = (await r.json().catch(() => null)) as SessionDetailResponse | null;
    if (j && "error" in j && typeof j.error === "string") {
      return { ok: false, error: j.error };
    }
    return {
      ok: false,
      error: `HTTP ${r.status} ${r.statusText}`,
    };
  }
  return r.json() as Promise<SessionDetailResponse>;
}

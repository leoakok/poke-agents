/**
 * Dashboard talks to the MCP HTTP JSON API.
 * - In the browser: same-origin `/api/*` routes (proxied by Next to POKE_AGENTS_MCP_ORIGIN).
 * - On the server: direct MCP origin from env (dev / SSR).
 */
export function getMcpUpstreamBase(): string {
  const fromServer = process.env.POKE_AGENTS_MCP_ORIGIN?.replace(/\/$/, "");
  const legacy = process.env.NEXT_PUBLIC_POKE_AGENTS_ORIGIN?.replace(/\/$/, "");
  return fromServer || legacy || "http://127.0.0.1:8740";
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
};

export type ConnectorsResponse =
  | { ok: true; connectors: ConnectorRow[]; profile_editors: string[] }
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
  source?: string;
}): string {
  const u = new URL("/api/sessions", "http://_");
  if (params?.limit) u.searchParams.set("limit", String(params.limit));
  if (params?.source) u.searchParams.set("source", params.source);
  return `${u.pathname}${u.search}`;
}

function sessionPathWithQuery(sessionId: string): string {
  const u = new URL("/api/session", "http://_");
  u.searchParams.set("id", sessionId);
  return `${u.pathname}${u.search}`;
}

export async function fetchSessions(params?: {
  limit?: number;
  source?: string;
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

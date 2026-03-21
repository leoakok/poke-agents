"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  agentRuntimeStreamUrl,
  fetchAgentRuntime,
  fetchConnectors,
  fetchSessions,
  type AgentRuntimeResponse,
  type ConnectorRow,
  type SessionRow,
} from "@/lib/poke-agents-api";
import {
  ARCHIVED_STORAGE_KEY,
  loadArchivedSessionIds,
  persistArchivedSessionIds,
} from "@/lib/dashboard-storage";

type LiveSse = "connecting" | "open" | "error";

type DashboardDataContextValue = {
  sessions: SessionRow[];
  connectors: ConnectorRow[];
  editors: string[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  liveRuntime: AgentRuntimeResponse | null;
  liveSse: LiveSse;
  refreshLiveSnapshot: () => void;
  archivedSessionIds: Set<string>;
  archiveSession: (id: string) => void;
  unarchiveSession: (id: string) => void;
};

const DashboardDataContext = createContext<DashboardDataContextValue | null>(
  null,
);

export function DashboardDataProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [editors, setEditors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveRuntime, setLiveRuntime] = useState<AgentRuntimeResponse | null>(
    null,
  );
  const [liveSse, setLiveSse] = useState<LiveSse>("connecting");
  const [archivedSessionIds, setArchivedSessionIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setArchivedSessionIds(loadArchivedSessionIds());
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === ARCHIVED_STORAGE_KEY) {
        setArchivedSessionIds(loadArchivedSessionIds());
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const archiveSession = useCallback((id: string) => {
    setArchivedSessionIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistArchivedSessionIds(next);
      return next;
    });
  }, []);

  const unarchiveSession = useCallback((id: string) => {
    setArchivedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      persistArchivedSessionIds(next);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([
        fetchConnectors(),
        fetchSessions({ limit: 250 }),
      ]);
      if (!c.ok) {
        setError(c.error);
        setConnectors([]);
        setEditors([]);
      } else {
        setConnectors(c.connectors);
        setEditors(c.editors);
      }
      if (!s.ok) {
        setError((e) => e ?? s.error);
        setSessions([]);
      } else {
        setSessions(s.sessions);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnectors([]);
      setEditors([]);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      setLiveSse("error");
      return;
    }
    const url = agentRuntimeStreamUrl();
    const es = new EventSource(url);
    setLiveSse("connecting");
    es.onopen = () => setLiveSse("open");
    es.onmessage = (ev) => {
      try {
        setLiveRuntime(JSON.parse(ev.data) as AgentRuntimeResponse);
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => setLiveSse("error");
    return () => es.close();
  }, []);

  useEffect(() => {
    if (
      !liveRuntime ||
      liveRuntime.ok !== true ||
      liveRuntime.processes.length === 0
    ) {
      return;
    }
    const id = window.setInterval(() => {
      void fetchSessions({ limit: 250 }).then((r) => {
        if (r.ok) setSessions(r.sessions);
      });
    }, 4000);
    return () => window.clearInterval(id);
  }, [liveRuntime]);

  const refreshLiveSnapshot = useCallback(() => {
    void fetchAgentRuntime().then(setLiveRuntime);
  }, []);

  const value = useMemo(
    () => ({
      sessions,
      connectors,
      editors,
      loading,
      error,
      refresh,
      liveRuntime,
      liveSse,
      refreshLiveSnapshot,
      archivedSessionIds,
      archiveSession,
      unarchiveSession,
    }),
    [
      sessions,
      connectors,
      editors,
      loading,
      error,
      refresh,
      liveRuntime,
      liveSse,
      refreshLiveSnapshot,
      archivedSessionIds,
      archiveSession,
      unarchiveSession,
    ],
  );

  return (
    <DashboardDataContext.Provider value={value}>
      {children}
    </DashboardDataContext.Provider>
  );
}

export function useDashboardData(): DashboardDataContextValue {
  const ctx = useContext(DashboardDataContext);
  if (!ctx) {
    throw new Error("useDashboardData must be used within DashboardDataProvider");
  }
  return ctx;
}

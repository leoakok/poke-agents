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
import { liveCliSessionsNotOnDisk } from "@/lib/live-cli-sessions";

const SESSIONS_PAGE_SIZE = 10;

type LiveSse = "connecting" | "open" | "error";

type DashboardDataContextValue = {
  /** Disk rows + synthetic live CLI rows (live rows first). */
  sessions: SessionRow[];
  diskSessions: SessionRow[];
  /** Total saved sessions on disk matching server filters (not including live-only rows). */
  diskTotalCount: number | null;
  diskHasMore: boolean;
  loadMoreDiskSessions: () => Promise<void>;
  loadingMoreDisk: boolean;
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
  const [diskSessions, setDiskSessions] = useState<SessionRow[]>([]);
  const [diskTotalCount, setDiskTotalCount] = useState<number | null>(null);
  const [diskHasMore, setDiskHasMore] = useState(false);
  const [loadingMoreDisk, setLoadingMoreDisk] = useState(false);
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
        fetchSessions({ limit: SESSIONS_PAGE_SIZE, offset: 0 }),
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
        setDiskSessions([]);
        setDiskTotalCount(null);
        setDiskHasMore(false);
      } else {
        setDiskSessions(s.sessions);
        setDiskTotalCount(
          typeof s.total_count === "number" ? s.total_count : s.sessions.length,
        );
        setDiskHasMore(Boolean(s.has_more));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setConnectors([]);
      setEditors([]);
      setDiskSessions([]);
      setDiskTotalCount(null);
      setDiskHasMore(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreDiskSessions = useCallback(async () => {
    if (!diskHasMore || loadingMoreDisk || loading) return;
    setLoadingMoreDisk(true);
    try {
      const s = await fetchSessions({
        limit: SESSIONS_PAGE_SIZE,
        offset: diskSessions.length,
      });
      if (!s.ok) return;
      setDiskSessions((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        const next = s.sessions.filter((r) => !seen.has(r.id));
        return [...prev, ...next];
      });
      if (typeof s.total_count === "number") {
        setDiskTotalCount(s.total_count);
      }
      setDiskHasMore(Boolean(s.has_more));
    } finally {
      setLoadingMoreDisk(false);
    }
  }, [diskHasMore, diskSessions.length, loading, loadingMoreDisk]);

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

  const liveOnlyRows = useMemo(
    () => liveCliSessionsNotOnDisk(liveRuntime, diskSessions),
    [liveRuntime, diskSessions],
  );

  const sessions = useMemo(
    () => [...liveOnlyRows, ...diskSessions],
    [liveOnlyRows, diskSessions],
  );

  const refreshLiveSnapshot = useCallback(() => {
    void fetchAgentRuntime().then(setLiveRuntime);
  }, []);

  const value = useMemo(
    () => ({
      sessions,
      diskSessions,
      diskTotalCount,
      diskHasMore,
      loadMoreDiskSessions,
      loadingMoreDisk,
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
      diskSessions,
      diskTotalCount,
      diskHasMore,
      loadMoreDiskSessions,
      loadingMoreDisk,
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

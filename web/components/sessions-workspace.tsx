"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ActivityIcon,
  ArchiveRestoreIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";

import { DashboardBody } from "@/components/dashboard-body";
import { useDashboardData } from "@/components/dashboard-data-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CONNECTOR_PREFS_KEY,
  loadEnabledConnectorIds,
} from "@/lib/connector-preferences";
import { buildLiveResumeIndex } from "@/lib/live-session-match";
import { chatHref } from "@/lib/routes";
import { sessionVisibleWithEnabledConnectors } from "@/lib/session-connector-match";
import { isPokeStackSource } from "@/lib/session-filters";
import { cn } from "@/lib/utils";

/**
 * Sessions route: toolbar (fixed height) + one scroll region (fills viewport).
 * CLI-linked sessions live on /live only — avoids duplicating that UI here.
 */
export function SessionsWorkspace() {
  const router = useRouter();

  const {
    sessions,
    connectors,
    editors,
    loading,
    error,
    refresh,
    liveRuntime,
    liveSse,
    archivedSessionIds,
    archiveSession,
    unarchiveSession,
  } = useDashboardData();

  const [enabledConnectorIds, setEnabledConnectorIds] = useState<Set<string>>(
    new Set(),
  );
  const [pokeOnly, setPokeOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (connectors.length === 0) return;
    queueMicrotask(() => {
      setEnabledConnectorIds(
        loadEnabledConnectorIds(connectors.map((c) => c.id)),
      );
    });
  }, [connectors]);

  useEffect(() => {
    function onVis() {
      if (
        document.visibilityState === "visible" &&
        connectors.length > 0
      ) {
        setEnabledConnectorIds(
          loadEnabledConnectorIds(connectors.map((c) => c.id)),
        );
      }
    }
    function onStorage(e: StorageEvent) {
      if (e.key === CONNECTOR_PREFS_KEY && connectors.length > 0) {
        setEnabledConnectorIds(
          loadEnabledConnectorIds(connectors.map((c) => c.id)),
        );
      }
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("storage", onStorage);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("storage", onStorage);
    };
  }, [connectors]);

  const sessionIdsWithLiveAgent = useMemo(() => {
    const set = new Set<string>();
    if (!liveRuntime || liveRuntime.ok !== true) return set;
    for (const p of liveRuntime.processes) {
      const { matchingSessionIds } = buildLiveResumeIndex(sessions, p.command);
      for (const id of matchingSessionIds) set.add(id);
    }
    return set;
  }, [liveRuntime, sessions]);

  const archivedSessions = useMemo(
    () => sessions.filter((s) => archivedSessionIds.has(s.id)),
    [sessions, archivedSessionIds],
  );

  const visibleSessions = useMemo(
    () => sessions.filter((s) => !archivedSessionIds.has(s.id)),
    [sessions, archivedSessionIds],
  );

  const connectorFiltered = useMemo(() => {
    return visibleSessions.filter((s) =>
      sessionVisibleWithEnabledConnectors(s, enabledConnectorIds),
    );
  }, [visibleSessions, enabledConnectorIds]);

  const pokeFiltered = useMemo(() => {
    if (!pokeOnly) return connectorFiltered;
    return connectorFiltered.filter((s) => isPokeStackSource(s.source));
  }, [connectorFiltered, pokeOnly]);

  const searchFiltered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return pokeFiltered;
    return pokeFiltered.filter((s) => {
      const title = (s.title ?? "").toLowerCase();
      const path = (s.project_path ?? "").toLowerCase();
      const src = s.source.toLowerCase();
      return title.includes(q) || path.includes(q) || src.includes(q);
    });
  }, [pokeFiltered, search]);

  const tableSessions = searchFiltered;

  const openChat = useCallback(
    (id: string) => {
      router.push(chatHref(id));
    },
    [router],
  );

  return (
    <DashboardBody variant="fixed" className="gap-3">
      {/* Toolbar — does not scroll */}
      <div className="flex shrink-0 flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="relative min-w-0 max-w-xl flex-1">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search title, path, source…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8"
              aria-label="Search sessions"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={pokeOnly ? "default" : "outline"}
              onClick={() => setPokeOnly((v) => !v)}
            >
              Poke stack only
            </Button>
            <Link
              href="/live"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex gap-1",
              )}
            >
              <ActivityIcon className="size-4" />
              Live
            </Link>
            <Link
              href="/settings"
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex gap-1",
              )}
            >
              <SettingsIcon className="size-4" />
              Settings
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              disabled={loading}
            >
              <RefreshCwIcon className="size-4" />
              Refresh
            </Button>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">
          {tableSessions.length} shown
          {archivedSessions.length > 0
            ? ` · ${archivedSessions.length} archived`
            : ""}
          {editors.length > 0 ? ` · ${editors.join(", ")}` : ""}
          {" · "}
          stream {liveSse}
        </p>

        {error ? (
          <Card className="border-destructive/50 py-3">
            <CardHeader className="space-y-1 px-4 py-0">
              <CardTitle className="text-destructive text-sm">
                Cannot reach API
              </CardTitle>
              <CardDescription className="text-xs">
                Run <code className="font-mono">npm run start:http</code> from
                the agents package.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 pt-2 pb-0">
              <p className="text-muted-foreground text-xs">{error}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* One scroll region for the rest (viewport-bound, like a chat transcript) */}
      <div className="border-border bg-card flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
        <div className="border-border shrink-0 border-b px-4 py-3">
          <h2 className="text-sm font-medium">Saved sessions</h2>
          <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
            Row opens chat. Archive is stored in this browser only.
          </p>
        </div>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <div className="p-4">
              <Skeleton className="h-48 w-full" />
            </div>
          ) : tableSessions.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">
              No sessions match filters. Adjust connectors in{" "}
              <Link href="/settings" className="underline underline-offset-2">
                Settings
              </Link>
              .
            </p>
          ) : (
            <div className="min-w-0">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-10 border-b backdrop-blur-sm">
                  <tr className="border-border border-b">
                    <th className="text-foreground h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap">
                      Title
                    </th>
                    <th className="text-foreground h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap">
                      Source
                    </th>
                    <th className="text-foreground h-10 px-3 text-left align-middle text-xs font-medium whitespace-nowrap">
                      Updated
                    </th>
                    <th className="text-foreground h-10 px-3 text-right align-middle text-xs font-medium whitespace-nowrap">
                      Archive
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableSessions.map((s) => (
                    <tr
                      key={s.id}
                      className={cn(
                        "border-border hover:bg-muted/50 cursor-pointer border-b transition-colors",
                        sessionIdsWithLiveAgent.has(s.id) &&
                          "bg-emerald-500/[0.06]",
                      )}
                      onClick={() => openChat(s.id)}
                    >
                      <td className="max-w-[min(12rem,40vw)] px-3 py-2 align-middle">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">
                            {s.title || "(untitled)"}
                          </span>
                          {sessionIdsWithLiveAgent.has(s.id) ? (
                            <Badge
                              variant="outline"
                              className="h-5 shrink-0 border-emerald-500/40 px-1.5 text-[0.6rem] text-emerald-700 dark:text-emerald-400"
                            >
                              CLI
                            </Badge>
                          ) : null}
                        </span>
                      </td>
                      <td className="text-muted-foreground px-3 py-2 align-middle whitespace-nowrap">
                        {s.source}
                      </td>
                      <td className="text-muted-foreground px-3 py-2 align-middle text-xs whitespace-nowrap">
                        {s.last_updated_at
                          ? new Date(s.last_updated_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right align-middle whitespace-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            archiveSession(s.id);
                          }}
                        >
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {archivedSessions.length > 0 ? (
            <div className="border-border mt-4 border-t px-4 pt-4 pb-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-medium">Archived</h3>
                  <p className="text-muted-foreground text-xs">
                    This browser only ({archivedSessions.length})
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowArchived((v) => !v)}
                >
                  {showArchived ? "Hide" : "Show"}
                </Button>
              </div>
              {showArchived ? (
                <ul className="flex flex-col gap-1 rounded-lg border p-2">
                  {archivedSessions.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-muted-foreground">
                          {s.title || "(untitled)"}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {s.source}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0"
                        onClick={() => unarchiveSession(s.id)}
                      >
                        <ArchiveRestoreIcon className="size-4" />
                        Restore
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </DashboardBody>
  );
}

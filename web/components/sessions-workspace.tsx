"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ActivityIcon,
  ArchiveRestoreIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  SearchIcon,
  SettingsIcon,
} from "lucide-react";

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CONNECTOR_PREFS_KEY,
  loadEnabledConnectorIds,
} from "@/lib/connector-preferences";
import { buildLiveResumeIndex } from "@/lib/live-session-match";
import { chatHref } from "@/lib/routes";
import { sessionVisibleWithEnabledConnectors } from "@/lib/session-connector-match";
import { isPokeStackSource } from "@/lib/session-filters";
import { cn } from "@/lib/utils";

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

  const [appOrigin, setAppOrigin] = useState("");
  const [enabledConnectorIds, setEnabledConnectorIds] = useState<Set<string>>(
    new Set(),
  );
  const [pokeOnly, setPokeOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setAppOrigin(typeof window !== "undefined" ? window.location.origin : "");
    });
  }, []);

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

  const liveMatchedSessions = useMemo(() => {
    const out: typeof sessions = [];
    const seen = new Set<string>();
    for (const s of connectorFiltered) {
      if (!sessionIdsWithLiveAgent.has(s.id)) continue;
      if (seen.has(s.id)) continue;
      seen.add(s.id);
      out.push(s);
    }
    return out;
  }, [connectorFiltered, sessionIdsWithLiveAgent]);

  const openChat = useCallback(
    (id: string) => {
      router.push(chatHref(id));
    },
    [router],
  );

  const liveCount =
    liveRuntime?.ok === true ? liveRuntime.processes.length : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-xl flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Sessions</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Open a transcript on the dedicated chat page. Filters respect{" "}
            <Link
              href="/settings"
              className="text-foreground font-medium underline-offset-4 hover:underline"
            >
              Settings
            </Link>
            .{" "}
            <span className="font-mono text-xs text-muted-foreground/90">
              API {appOrigin || "…"} → poke-agents
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/live"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "inline-flex gap-1",
            )}
          >
            <ActivityIcon className="size-4" />
            Live processes
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            placeholder="Search title, path, source…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-8"
            aria-label="Search sessions"
          />
        </div>
        <Button
          type="button"
          size="sm"
          variant={pokeOnly ? "default" : "outline"}
          onClick={() => setPokeOnly((v) => !v)}
        >
          Poke agents
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Live stream:{" "}
        {liveSse === "open"
          ? "connected"
          : liveSse === "connecting"
            ? "connecting…"
            : "disconnected"}
        {liveCount !== null ? ` · ${liveCount} CLI process(es)` : ""}
        {" · "}
        {tableSessions.length} shown
        {archivedSessions.length > 0
          ? ` · ${archivedSessions.length} archived`
          : ""}
        {editors.length > 0 ? (
          <>
            {" · "}
            Profile: {editors.join(", ")}
          </>
        ) : null}
      </p>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Cannot reach API</CardTitle>
            <CardDescription>
              Start the HTTP server from the{" "}
              <code className="font-mono">agents</code> package:{" "}
              <code className="font-mono text-xs">npm run start:http</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-6">
        <Card
          className={
            liveMatchedSessions.length > 0 ? "border-emerald-500/25" : undefined
          }
        >
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Active (CLI-linked)</CardTitle>
                <CardDescription>
                  Sessions currently tied to a visible{" "}
                  <code className="font-mono text-xs">agent</code> CLI process.
                  Open chat for a full-page transcript.
                </CardDescription>
              </div>
              <Link
                href="/live"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "h-8 shrink-0 gap-1 text-xs",
                )}
              >
                <ExternalLinkIcon className="size-3.5" />
                Live view
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {liveMatchedSessions.length > 0 ? (
              liveMatchedSessions.map((s) => (
                <div
                  key={s.id}
                  className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {s.title || "(untitled)"}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {s.source}
                      {s.project_path ? ` · ${s.project_path}` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 shrink-0 gap-1"
                    onClick={() => openChat(s.id)}
                  >
                    <MessageSquareIcon className="size-4" />
                    Open chat
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm leading-relaxed">
                {liveRuntime?.ok === true && liveRuntime.processes.length > 0
                  ? "CLI processes are running, but no saved session UUID matches yet."
                  : liveRuntime?.ok === true
                    ? "No matching CLI agent processes. Headless runs with --resume show here when IDs align."
                    : "Waiting for a live snapshot…"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Saved sessions</CardTitle>
            <CardDescription>
              Click a row to open the chat page. Archive is stored in this
              browser only (sidebar: hover a row to archive).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-56 w-full" />
            ) : tableSessions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No sessions match filters. Adjust connectors in{" "}
                <Link href="/settings" className="underline underline-offset-2">
                  Settings
                </Link>
                .
              </p>
            ) : (
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="w-[96px] text-right">
                        Archive
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tableSessions.map((s) => (
                      <TableRow
                        key={s.id}
                        className={cn(
                          "cursor-pointer",
                          sessionIdsWithLiveAgent.has(s.id) &&
                            "bg-emerald-500/5 ring-1 ring-emerald-500/20",
                        )}
                        onClick={() => openChat(s.id)}
                      >
                        <TableCell className="max-w-[200px] truncate font-medium">
                          <span className="inline-flex items-center gap-2">
                            {s.title || "(untitled)"}
                            {sessionIdsWithLiveAgent.has(s.id) ? (
                              <Badge
                                variant="outline"
                                className="h-5 shrink-0 border-emerald-500/40 px-1.5 text-[0.6rem] text-emerald-700 dark:text-emerald-400"
                              >
                                Running
                              </Badge>
                            ) : null}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.source}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {s.last_updated_at
                            ? new Date(s.last_updated_at).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
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
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {archivedSessions.length > 0 ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">Archived</CardTitle>
                <CardDescription>
                  This browser only ({archivedSessions.length})
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowArchived((v) => !v)}
              >
                {showArchived ? "Hide" : "Show"}
              </Button>
            </CardHeader>
            {showArchived ? (
              <CardContent>
                <div className="flex flex-col gap-1 rounded-lg border p-2">
                  {archivedSessions.map((s) => (
                    <div
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
                    </div>
                  ))}
                </div>
              </CardContent>
            ) : null}
          </Card>
        ) : null}
      </div>
        </div>
      </div>
    </div>
  );
}

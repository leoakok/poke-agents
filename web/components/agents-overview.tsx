"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCwIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  fetchConnectors,
  fetchSessionDetail,
  fetchSessions,
  type ConnectorRow,
  type SessionRow,
} from "@/lib/poke-agents-api";
import { cn } from "@/lib/utils";

export function AgentsOverview() {
  const [appOrigin, setAppOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [profileEditors, setProfileEditors] = useState<string[]>([]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailText, setDetailText] = useState<string>("");

  useEffect(() => {
    setAppOrigin(
      typeof window !== "undefined" ? window.location.origin : "",
    );
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, s] = await Promise.all([
        fetchConnectors(),
        fetchSessions({ limit: 150 }),
      ]);
      if (!c.ok) {
        setError(c.error);
        setConnectors([]);
        setProfileEditors([]);
      } else {
        setConnectors(c.connectors);
        setProfileEditors(c.profile_editors);
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
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetailText("");
      setDetailError(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError(null);
    void fetchSessionDetail(selectedId).then((r) => {
      if (cancelled) return;
      setDetailLoading(false);
      if (!r.ok) {
        setDetailError(r.error);
        setDetailText("");
        return;
      }
      const lines = r.messages.map((m, i) => {
        const head = `[${i + 1}] ${m.role}${m.model ? ` · ${m.model}` : ""}`;
        return `${head}\n${m.content}`;
      });
      setDetailText(lines.join("\n\n---\n\n"));
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Local agent sessions
          </h1>
          <p className="text-sm text-muted-foreground">
            Connectors and chats on this machine. The launcher can move MCP and
            dashboard ports if defaults are busy; this page always talks to MCP
            through{" "}
            <span className="font-mono text-xs">
              {appOrigin || "this origin"}
            </span>
            .
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCwIcon data-icon="inline-start" />
          Refresh
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Cannot reach API</CardTitle>
            <CardDescription>
              Start the HTTP server from <code className="font-mono">poke/agents</code>
              :{" "}
              <code className="font-mono text-xs">
                npm run start:http
              </code>
              . Then open this dashboard again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Connectors</CardTitle>
            <CardDescription>
              Profile:{" "}
              {profileEditors.length ? (
                <span className="inline-flex flex-wrap gap-1">
                  {profileEditors.map((id) => (
                    <Badge key={id} variant="secondary">
                      {id}
                    </Badge>
                  ))}
                </span>
              ) : (
                "—"
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {connectors.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        {c.display_name}
                        <div className="text-xs text-muted-foreground">
                          {c.id}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.available ? (
                          <Badge variant="default">Available</Badge>
                        ) : (
                          <Badge variant="destructive">Unavailable</Badge>
                        )}
                        {c.detail ? (
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                            {c.detail}
                          </p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>
              Chats from allowed editors, newest first. Select a row for a raw
              transcript preview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-48 w-full" />
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sessions found. Open Cursor or OpenCode chats, or widen{" "}
                <code className="rounded bg-muted px-1 font-mono text-xs">
                  POKE_AGENTS_EDITORS
                </code>
                .
              </p>
            ) : (
              <ScrollArea className="h-[min(420px,50vh)] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((s) => (
                      <TableRow
                        key={s.id}
                        data-state={selectedId === s.id ? "selected" : undefined}
                        className={cn(
                          "cursor-pointer",
                          selectedId === s.id && "bg-muted/60"
                        )}
                        onClick={() =>
                          setSelectedId((id) => (id === s.id ? null : s.id))
                        }
                      >
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {s.title || "(untitled)"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {s.source}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.last_updated_at
                            ? new Date(s.last_updated_at).toLocaleString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {selectedId ? (
        <Card>
          <CardHeader>
            <CardTitle>Transcript</CardTitle>
            <CardDescription className="font-mono text-xs break-all">
              {selectedId}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {detailLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : detailError ? (
              <p className="text-sm text-destructive">{detailError}</p>
            ) : (
              <ScrollArea className="h-[min(480px,55vh)] rounded-md border bg-muted/30 p-4">
                <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                  {detailText || "No messages."}
                </pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

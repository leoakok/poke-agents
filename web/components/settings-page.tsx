"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardBody } from "@/components/dashboard-body";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  CONNECTOR_PREFS_KEY,
  loadEnabledConnectorIds,
  saveEnabledConnectorIds,
} from "@/lib/connector-preferences";
import { fetchConnectors, type ConnectorRow } from "@/lib/poke-agents-api";
import { cn } from "@/lib/utils";

const SOURCE_HINT: Record<string, string> = {
  cursor: "Disk chats (Cursor)",
  opencode: "Disk sessions (OpenCode)",
  codex: "Disk threads (~/.codex/sessions)",
};

function isServerEnabled(c: ConnectorRow): boolean {
  return c.server_enabled !== false;
}

export function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorRow[]>([]);
  const [editors, setEditors] = useState<string[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const c = await fetchConnectors();
    if (!c.ok) {
      setError(c.error);
      setConnectors([]);
      setEditors([]);
      setLoading(false);
      return;
    }
    setConnectors(c.connectors);
    setEditors(c.editors);
    const initial = loadEnabledConnectorIds(c.connectors.map((x) => x.id));
    for (const row of c.connectors) {
      if (row.server_enabled === false) {
        initial.delete(row.id);
      }
    }
    setEnabled(initial);
    setLoading(false);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  const toggle = useCallback((id: string, on: boolean) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      if (next.size === 0) {
        return prev;
      }
      saveEnabledConnectorIds(next);
      return next;
    });
  }, []);

  return (
    <DashboardBody variant="scroll">
      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive text-base">
              Cannot load connectors
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void load()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Session sources</CardTitle>
          <CardDescription>
            Dashboard-only visibility for the session list. The MCP host merges
            from{" "}
            <code className="font-mono text-xs">POKE_AGENTS_EDITORS</code>.
            Toggles are stored as{" "}
            <code className="font-mono text-xs">{CONNECTOR_PREFS_KEY}</code>.
            Cursor, OpenCode, and Codex match disk adapters and{" "}
            <code className="font-mono text-xs">control_agent</code> docs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ul className="divide-border divide-y rounded-lg border">
              {connectors.map((c) => {
                const on = enabled.has(c.id);
                const serverOk = isServerEnabled(c);
                const hint = SOURCE_HINT[c.id] ?? c.display_name;
                const switchId = `dashboard-connector-${c.id}`;
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-medium">
                          {c.display_name}
                        </span>
                        <code className="text-muted-foreground font-mono text-xs">
                          {c.id}
                        </code>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            c.available
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-muted-foreground",
                          )}
                        >
                          {c.available ? "Readable" : "Unavailable"}
                        </span>
                      </div>
                      <p className="text-muted-foreground text-sm">{hint}</p>
                      {!serverOk ? (
                        <p className="text-muted-foreground text-xs">
                          Not on MCP allowlist — add{" "}
                          <code className="font-mono">{c.id}</code> to{" "}
                          <code className="font-mono">POKE_AGENTS_EDITORS</code>{" "}
                          and restart.
                        </p>
                      ) : null}
                      {c.detail && c.available === false ? (
                        <p className="text-destructive text-xs">{c.detail}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                      <Label htmlFor={switchId} className="sr-only">
                        Show {c.display_name} sessions in the list
                      </Label>
                      <Switch
                        id={switchId}
                        checked={on}
                        disabled={!serverOk}
                        onCheckedChange={(checked) => toggle(c.id, checked)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">MCP allowlist</CardTitle>
          <CardDescription>
            Effective on the running server (read-only in this UI).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {editors.length ? (
              editors.map((id) => (
                <span
                  key={id}
                  className="border-border bg-muted/50 text-foreground rounded-md border px-2 py-1 font-mono text-xs"
                >
                  {id}
                </span>
              ))
            ) : loading ? (
              <Skeleton className="h-8 w-40" />
            ) : (
              <span className="text-muted-foreground text-sm">—</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Headless control</CardTitle>
          <CardDescription>
            <code className="font-mono text-xs">POKE_AGENTS_CONTROL</code> selects
            the CLI for{" "}
            <code className="font-mono text-xs">control_agent</code>
            : cursor, opencode, codex, or claude. Use{" "}
            <span className="text-foreground font-medium">Live</span> to send{" "}
            <code className="font-mono text-xs">SIGINT</code> to matching PIDs.
          </CardDescription>
        </CardHeader>
      </Card>
    </DashboardBody>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  saveEnabledConnectorIds,
} from "@/lib/connector-preferences";
import { fetchConnectors, type ConnectorRow } from "@/lib/poke-agents-api";
import { cn } from "@/lib/utils";

function ConnectorToggle({
  enabled,
  onChange,
  id,
}: {
  enabled: boolean;
  onChange: (next: boolean) => void;
  id: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={`${enabled ? "Disable" : "Enable"} ${id} in session list`}
      onClick={() => onChange(!enabled)}
      className={cn(
        "focus-visible:ring-ring relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none",
        enabled
          ? "bg-primary border-primary"
          : "bg-muted border-input",
      )}
    >
      <span
        className={cn(
          "bg-background pointer-events-none block size-6 rounded-full shadow-sm ring-0 transition-transform",
          enabled ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
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
    setEnabled(loadEnabledConnectorIds(c.connectors.map((x) => x.id)));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(
    (id: string, on: boolean) => {
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
    },
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Connector visibility and agent runtime notes. Toggles affect this
          dashboard only (stored in{" "}
          <code className="font-mono text-xs">{CONNECTOR_PREFS_KEY}</code>).
        </p>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive text-base">
              Cannot load connectors
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connectors</CardTitle>
          <CardDescription>
            Turn adapters off to hide their sessions from the home list. The
            MCP server still uses{" "}
            <code className="font-mono text-xs">POKE_AGENTS_EDITORS</code> on
            the host — this does not change that.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Adapter</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead className="text-right">In session list</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {connectors.map((c) => {
                  const on = enabled.has(c.id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.display_name}</div>
                        <div className="text-muted-foreground font-mono text-xs">
                          {c.id}
                        </div>
                        {c.detail ? (
                          <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                            {c.detail}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {c.available ? (
                          <Badge>Available</Badge>
                        ) : (
                          <Badge variant="destructive">Unavailable</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <ConnectorToggle
                            id={c.id}
                            enabled={on}
                            onChange={(next) => toggle(c.id, next)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Server profile</CardTitle>
          <CardDescription>
            Effective editor allowlist from the running MCP process.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {editors.length ? (
            <div className="flex flex-wrap gap-1">
              {editors.map((id) => (
                <Badge key={id} variant="secondary">
                  {id}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">—</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stopping live agents</CardTitle>
          <CardDescription>
            From the home page, <strong>Stop</strong> sends{" "}
            <code className="font-mono text-xs">SIGINT</code> to processes that
            appear in the live scan (same user/OS permissions required).
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm">
          <p>
            If stop fails with permission errors, interrupt the terminal where
            the agent is running (<kbd className="font-mono">Ctrl+C</kbd>) or
            use <code className="font-mono text-xs">kill</code> manually.
          </p>
          <p>
            Agent panes inside the Cursor app may not create a separate{" "}
            <code className="font-mono text-xs">agent</code> process, so they
            will not appear in the live list.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


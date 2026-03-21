"use client";

import Link from "next/link";
import {
  ActivityIcon,
  LayoutListIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";

import { useDashboardData } from "@/components/dashboard-data-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const cardLink =
  "hover:border-primary/30 hover:bg-muted/40 -m-px block rounded-xl border border-transparent p-px transition-colors";

export function HomeDashboard() {
  const { sessions, loading, error, liveRuntime, liveSse } = useDashboardData();

  const liveN =
    liveRuntime?.ok === true ? liveRuntime.processes.length : null;
  const sessionCount = sessions.length;

  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Poke agents dashboard
        </h1>
        <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
          Local-first UI for editor sessions exposed by the{" "}
          <strong>poke-agents</strong> MCP server. Browse transcripts, watch CLI
          agent processes, and manage templates — same data as the MCP tools on
          your machine.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Status</CardTitle>
          <CardDescription>
            {error
              ? "API unreachable — start the MCP HTTP server."
              : "Connection to the bundled JSON API."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">API</span>{" "}
            <span
              className={cn(
                "font-medium",
                error ? "text-destructive" : "text-emerald-700 dark:text-emerald-400",
              )}
            >
              {error ? "offline" : "ok"}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Live SSE</span>{" "}
            <span className="font-medium capitalize">{liveSse}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Sessions indexed</span>{" "}
            <span className="font-medium">
              {loading ? "…" : sessionCount}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">CLI processes</span>{" "}
            <span className="font-medium">
              {liveN === null ? "—" : liveN}
            </span>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-medium tracking-wide uppercase">
          Navigate
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link href="/sessions" className={cardLink}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <LayoutListIcon className="text-muted-foreground size-4" />
                    <CardTitle className="text-base">Sessions</CardTitle>
                  </div>
                  <CardDescription>
                    Browse saved threads; each opens on the chat page. Sidebar
                    list while you are on Sessions or Chat.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
          <li>
            <Link href="/live" className={cardLink}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ActivityIcon className="text-muted-foreground size-4" />
                    <CardTitle className="text-base">Live processes</CardTitle>
                  </div>
                  <CardDescription>
                    Cursor <code className="font-mono text-xs">agent</code> CLI
                    rows from <code className="font-mono text-xs">ps</code>, stop
                    PIDs, jump to matched chats.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
          <li>
            <Link href="/templates" className={cardLink}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <SparklesIcon className="text-muted-foreground size-4" />
                    <CardTitle className="text-base">Templates</CardTitle>
                  </div>
                  <CardDescription>
                    Built-in and custom agent personas; edit on disk or via MCP{" "}
                    <code className="font-mono text-xs">agent_templates</code>.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
          <li>
            <Link href="/settings" className={cardLink}>
              <Card className="h-full">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <SettingsIcon className="text-muted-foreground size-4" />
                    <CardTitle className="text-base">Settings</CardTitle>
                  </div>
                  <CardDescription>
                    Enable connectors, tune which sources appear in lists.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

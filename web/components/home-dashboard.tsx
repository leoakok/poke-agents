"use client";

import Link from "next/link";

import { DashboardBody } from "@/components/dashboard-body";
import { useDashboardData } from "@/components/dashboard-data-context";
import { OverviewGuides } from "@/components/overview-guides";
import { DASHBOARD_NAV } from "@/lib/dashboard-nav";
import { cn } from "@/lib/utils";

export function HomeDashboard() {
  const {
    diskSessions,
    diskTotalCount,
    loading,
    error,
    liveRuntime,
    liveSse,
  } = useDashboardData();

  const liveN =
    liveRuntime?.ok === true ? liveRuntime.processes.length : null;
  const sessionCount =
    diskTotalCount != null ? diskTotalCount : diskSessions.length;

  const shortcuts = DASHBOARD_NAV.filter((item) => item.href !== "/");

  const stats = [
    { label: "API", value: error ? "offline" : "ok", bad: Boolean(error) },
    { label: "Stream", value: liveSse, bad: false },
    {
      label: "Sessions",
      value: loading ? "…" : String(sessionCount),
      bad: false,
    },
    {
      label: "CLI",
      value: liveN === null ? "—" : String(liveN),
      bad: false,
    },
  ] as const;

  return (
    <DashboardBody variant="scroll">
      <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        {stats.map(({ label, value, bad }) => (
          <div key={label} className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {label}
            </p>
            <p
              className={cn(
                "text-sm font-medium tabular-nums",
                bad
                  ? "text-destructive"
                  : label === "API" && !bad
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-foreground",
              )}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          Start the stack (e.g.{" "}
          <code className="text-foreground rounded bg-muted px-1 py-0.5 font-mono text-xs">
            npm run start:poke
          </code>
          ) so this UI can reach the API.
        </p>
      ) : null}

      <div>
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Open
        </p>
        <nav aria-label="Shortcuts">
          <ul className="flex flex-col gap-0.5">
            {shortcuts.map(({ href, label, Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-foreground hover:bg-muted/60 -mx-2 flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors"
                >
                  <Icon className="text-muted-foreground size-4 shrink-0 opacity-80" />
                  <span className="font-medium">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <OverviewGuides />
    </DashboardBody>
  );
}

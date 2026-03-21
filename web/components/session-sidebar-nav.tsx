"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArchiveIcon, MessageSquareIcon, SearchIcon } from "lucide-react";

import { useDashboardData } from "@/components/dashboard-data-context";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarInput,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { buildLiveResumeIndex } from "@/lib/live-session-match";
import { chatHref } from "@/lib/routes";
import { sessionVisibleWithEnabledConnectors } from "@/lib/session-connector-match";
import { loadEnabledConnectorIds } from "@/lib/connector-preferences";
import { cn } from "@/lib/utils";

function groupLabelForSource(source: string): string {
  const i = source.search(/[-_]/);
  if (i <= 0) return source || "Other";
  return `${source.slice(0, i)} · …`;
}

function SessionSidebarNavInner() {
  const {
    sessions,
    connectors,
    loading,
    liveRuntime,
    archivedSessionIds,
    archiveSession,
  } = useDashboardData();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = searchParams.get("s");
  const [q, setQ] = useState("");

  const enabledConnectorIds = useMemo(() => {
    if (connectors.length === 0) return new Set<string>();
    return loadEnabledConnectorIds(connectors.map((c) => c.id));
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

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sessions
      .filter((s) => !archivedSessionIds.has(s.id))
      .filter((s) =>
        sessionVisibleWithEnabledConnectors(s, enabledConnectorIds),
      )
      .filter((s) => {
        if (!needle) return true;
        const t = (s.title ?? "").toLowerCase();
        const p = (s.project_path ?? "").toLowerCase();
        const src = s.source.toLowerCase();
        return t.includes(needle) || p.includes(needle) || src.includes(needle);
      })
      .sort((a, b) => {
        const ta = a.last_updated_at ?? "";
        const tb = b.last_updated_at ?? "";
        return tb.localeCompare(ta);
      })
      .slice(0, 80);
  }, [sessions, archivedSessionIds, enabledConnectorIds, q]);

  const liveBucket = useMemo(
    () => visible.filter((s) => sessionIdsWithLiveAgent.has(s.id)),
    [visible, sessionIdsWithLiveAgent],
  );

  const liveIds = useMemo(
    () => new Set(liveBucket.map((s) => s.id)),
    [liveBucket],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, typeof visible>();
    for (const s of visible) {
      if (liveIds.has(s.id)) continue;
      const key = groupLabelForSource(s.source);
      const arr = m.get(key) ?? [];
      arr.push(s);
      m.set(key, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible, liveIds]);

  const chatOpen = pathname === "/chat";
  const liveOpen = pathname === "/live";
  const showSessionList = pathname === "/sessions" || chatOpen || liveOpen;

  if (!showSessionList) {
    return (
      <SidebarGroup>
        <SidebarGroupLabel>Sessions</SidebarGroupLabel>
        <SidebarGroupContent>
          <p className="text-muted-foreground px-2 text-xs leading-relaxed">
            Open{" "}
            <Link href="/sessions" className="text-sidebar-foreground underline">
              Sessions
            </Link>
            ,{" "}
            <Link href="/live" className="text-sidebar-foreground underline">
              Live
            </Link>
            , or a chat — the list shows on those pages.
          </p>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  const rowIsActive = (id: string) => chatOpen && selected === id;

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel>Session list</SidebarGroupLabel>
        <div className="relative px-2 pb-2">
          <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2" />
          <SidebarInput
            placeholder="Filter…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="h-8 pl-8 text-xs"
            aria-label="Filter sessions"
          />
        </div>
        <SidebarGroupContent className="max-h-[min(50vh,22rem)] overflow-y-auto">
          {loading ? (
            <p className="text-muted-foreground px-2 text-xs">Loading…</p>
          ) : null}
          {!loading && visible.length === 0 ? (
            <p className="text-muted-foreground px-2 text-xs">
              No sessions (check Settings → connectors).
            </p>
          ) : null}
          {liveBucket.length > 0 ? (
            <SidebarGroup className="p-0">
              <SidebarGroupLabel className="text-emerald-700 dark:text-emerald-400">
                Running (CLI)
              </SidebarGroupLabel>
              <SidebarMenu>
                {liveBucket.map((s) => (
                  <SidebarMenuItem
                    key={`live-${s.id}`}
                    className="group/row relative"
                  >
                    <SidebarMenuButton
                      render={
                        <Link href={chatHref(s.id)} scroll={false} />
                      }
                      isActive={rowIsActive(s.id)}
                      tooltip={s.title || s.source}
                      className={cn(
                        "h-auto min-h-8 py-1.5 pr-9",
                        "border-l-2 border-l-emerald-500 pl-2",
                      )}
                    >
                      <span
                        className="relative flex size-2.5 shrink-0"
                        aria-hidden
                      >
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
                      </span>
                      <span className="line-clamp-2 text-left text-xs leading-snug">
                        {s.title || "(untitled)"}
                      </span>
                      <SidebarMenuBadge className="bg-emerald-600/20 text-[0.55rem] text-emerald-800 dark:text-emerald-300">
                        LIVE
                      </SidebarMenuBadge>
                    </SidebarMenuButton>
                    <button
                      type="button"
                      aria-label={`Archive ${s.title || "session"}`}
                      title="Archive"
                      className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent absolute top-1/2 right-1 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        archiveSession(s.id);
                      }}
                    >
                      <ArchiveIcon className="size-3.5" />
                    </button>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          ) : null}

          {grouped.map(([label, rows]) => (
            <SidebarGroup key={label} className="p-0">
              <SidebarGroupLabel className="text-[0.65rem] uppercase">
                {label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {rows.map((s) => {
                  const isLive = sessionIdsWithLiveAgent.has(s.id);
                  return (
                    <SidebarMenuItem
                      key={s.id}
                      className="group/row relative"
                    >
                      <SidebarMenuButton
                        render={
                          <Link href={chatHref(s.id)} scroll={false} />
                        }
                        isActive={rowIsActive(s.id)}
                        tooltip={`${s.title ?? ""} ${s.project_path ?? ""}`}
                        className={cn(
                          "h-auto min-h-8 py-1.5 pr-9",
                          isLive && "border-l-2 border-l-emerald-500/70 pl-2",
                        )}
                      >
                        {isLive ? (
                          <span
                            className="relative flex size-2 shrink-0"
                            aria-hidden
                          >
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                          </span>
                        ) : (
                          <MessageSquareIcon className="size-3.5 shrink-0 opacity-60" />
                        )}
                        <span className="line-clamp-2 text-left text-xs leading-snug">
                          {s.title || "(untitled)"}
                        </span>
                      </SidebarMenuButton>
                      <button
                        type="button"
                        aria-label={`Archive ${s.title || "session"}`}
                        title="Archive"
                        className="text-muted-foreground hover:text-foreground hover:bg-sidebar-accent absolute top-1/2 right-1 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/row:opacity-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          archiveSession(s.id);
                        }}
                      >
                        <ArchiveIcon className="size-3.5" />
                      </button>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup className="group-data-[collapsible=icon]:hidden border-sidebar-border border-t pt-2">
        <SidebarGroupLabel>Templates</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton render={<Link href="/templates" />}>
                <span className="text-xs">Manage templates</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}

export function SessionSidebarNav() {
  return (
    <Suspense
      fallback={
        <SidebarGroup>
          <SidebarGroupLabel>Sessions</SidebarGroupLabel>
          <SidebarGroupContent>
            <p className="text-muted-foreground px-2 text-xs">Loading…</p>
          </SidebarGroupContent>
        </SidebarGroup>
      }
    >
      <SessionSidebarNavInner />
    </Suspense>
  );
}

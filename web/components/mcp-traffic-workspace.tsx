"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RadioIcon, Trash2Icon } from "lucide-react";

import { DashboardBody } from "@/components/dashboard-body";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type McpTrafficEntry = {
  id: string;
  ts: string;
  direction: "request" | "response";
  method?: string;
  summary: string;
  bodyPreview: string;
  statusCode?: number;
};

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

function looksLikeSse(text: string): boolean {
  return /(?:^|\r?\n)\s*event:\s*/i.test(text) || /(?:^|\r?\n)\s*data:\s*/.test(text);
}

/** Parse MCP / SSE bodies: `event:` + `data:` lines (same rules as server preview). */
function parseSseEvents(text: string): Array<{ event: string; data: string; id?: string }> {
  const events: Array<{ event: string; data: string; id?: string }> = [];
  let eventName = "message";
  let dataParts: string[] = [];
  let id: string | undefined;
  let hasField = false;

  function flush(): void {
    if (!hasField && dataParts.length === 0) return;
    events.push({ event: eventName, data: dataParts.join("\n"), id });
    eventName = "message";
    dataParts = [];
    id = undefined;
    hasField = false;
  }

  for (const line of text.split(/\r?\n/)) {
    if (line === "") {
      flush();
      continue;
    }
    if (line.startsWith(":")) continue;
    hasField = true;
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      const rest = line.slice(5);
      dataParts.push(rest.startsWith(" ") ? rest.slice(1) : rest);
      continue;
    }
    if (line.startsWith("id:")) {
      id = line.slice(3).trimStart();
      continue;
    }
    if (line.startsWith("retry:")) continue;
  }
  flush();
  return events;
}

function prettyDataPayloadClient(data: string): string {
  const d = data.trim();
  if (!d) return "(empty)";
  if (d.startsWith("{") || d.startsWith("[")) {
    try {
      return JSON.stringify(JSON.parse(d) as unknown, null, 2);
    } catch {
      return d;
    }
  }
  return d;
}

function formatSseBodyClient(text: string): string {
  return parseSseEvents(text)
    .map((ev, i) => {
      const head = `# ${i + 1} · event: ${ev.event}${ev.id != null && ev.id !== "" ? ` · id: ${ev.id}` : ""}`;
      const body = prettyDataPayloadClient(ev.data);
      const indented = body
        .split("\n")
        .map((ln) => `  ${ln}`)
        .join("\n");
      return `${head}\ndata:\n${indented}`;
    })
    .join("\n\n—\n\n");
}

/** Pretty-print JSON, raw SSE streams, or pass through server-formatted previews. */
function formatLogBody(raw: string): string {
  const t = raw.trim();
  if (!t) return "(empty)";
  if (/^#\s+\d+\s+·\s+event:/m.test(raw)) {
    return raw;
  }
  if (looksLikeSse(raw)) {
    return formatSseBodyClient(raw);
  }
  if (
    (t.startsWith("{") && t.endsWith("}")) ||
    (t.startsWith("[") && t.endsWith("]"))
  ) {
    try {
      return JSON.stringify(JSON.parse(t) as unknown, null, 2);
    } catch {
      /* fall through */
    }
  }
  return raw;
}

function McpTrafficRow({ entry: e }: { entry: McpTrafficEntry }) {
  const formatted = useMemo(() => formatLogBody(e.bodyPreview), [e.bodyPreview]);
  const lineCount = formatted.split("\n").length;
  const charCount = formatted.length;

  return (
    <li className="min-w-0 px-3 py-2.5">
      <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
        <span className="text-muted-foreground shrink-0">
          {formatTime(e.ts)}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase",
            e.direction === "request"
              ? "bg-sky-500/15 text-sky-800 dark:text-sky-300"
              : "bg-violet-500/15 text-violet-800 dark:text-violet-300",
          )}
        >
          {e.direction}
        </span>
        {e.statusCode != null ? (
          <span className="text-muted-foreground">{e.statusCode}</span>
        ) : null}
        <span className="text-foreground font-medium">{e.summary}</span>
        {e.method ? (
          <span className="text-muted-foreground truncate">{e.method}</span>
        ) : null}
      </div>
      <details className="group border-border/60 bg-muted/20 mt-1 max-w-full min-w-0 rounded-md border">
        <summary className="text-muted-foreground hover:bg-muted/40 flex min-w-0 cursor-pointer list-none items-center gap-1.5 px-2 py-1.5 text-[0.65rem] font-medium select-none [&::-webkit-details-marker]:hidden">
          <span
            className="inline-block w-3 shrink-0 text-center opacity-70 transition-transform duration-150 group-open:rotate-90"
            aria-hidden
          >
            ▸
          </span>
          <span>Payload</span>
          <span className="text-muted-foreground/85 font-mono font-normal">
            · {lineCount} line{lineCount === 1 ? "" : "s"},{" "}
            {charCount.toLocaleString()} chars
          </span>
        </summary>
        <pre className="text-foreground border-border max-h-[min(50dvh,20rem)] min-h-0 min-w-0 max-w-full overflow-auto border-t bg-background/60 p-2.5 font-mono text-[0.7rem] leading-relaxed whitespace-pre-wrap break-words">
          {formatted}
        </pre>
      </details>
    </li>
  );
}

export function McpTrafficWorkspace() {
  const [entries, setEntries] = useState<McpTrafficEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenIds = useRef(new Set<string>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickBottomRef = useRef(true);

  const mergeEntry = useCallback((e: McpTrafficEntry) => {
    if (seenIds.current.has(e.id)) return;
    seenIds.current.add(e.id);
    setEntries((prev) => {
      const next = [...prev, e];
      if (next.length > 400) {
        const drop = next.length - 400;
        for (let i = 0; i < drop; i++) {
          seenIds.current.delete(next[i]!.id);
        }
        return next.slice(-400);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;

    function connect() {
      if (cancelled) return;
      es = new EventSource("/api/mcp-traffic/stream");
      es.onopen = () => {
        if (!cancelled) {
          setConnected(true);
          setError(null);
        }
      };
      es.onmessage = (ev) => {
        try {
          const row = JSON.parse(ev.data) as McpTrafficEntry;
          mergeEntry(row);
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        if (!cancelled) {
          setConnected(false);
          setError("Stream disconnected — reconnecting…");
        }
        es?.close();
        es = null;
        if (!cancelled) {
          window.setTimeout(connect, 2000);
        }
      };
    }

    connect();
    return () => {
      cancelled = true;
      es?.close();
    };
  }, [mergeEntry]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickBottomRef.current = gap < 80;
  }, []);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  const clearLocal = useCallback(() => {
    seenIds.current.clear();
    setEntries([]);
  }, []);

  return (
    <DashboardBody variant="fixed" className="gap-4">
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-muted-foreground max-w-2xl text-xs leading-relaxed">
          Live <code className="bg-muted rounded px-1 py-0.5 font-mono">POST /mcp</code>{" "}
          traffic via this app. Disable with{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono">
            POKE_AGENTS_MCP_TRAFFIC=0
          </code>{" "}
          on the MCP process. Large bodies may be truncated.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
              connected
                ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <RadioIcon
              className={cn("size-3.5", connected && "text-emerald-600")}
            />
            {connected ? "Live" : "Offline"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={clearLocal}
          >
            <Trash2Icon className="size-3.5" />
            Clear view
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overscroll-contain"
      >
        {error ? (
          <p className="text-muted-foreground shrink-0 py-2 text-sm">{error}</p>
        ) : null}

        <div className="bg-card border-border min-w-0 rounded-xl border text-xs shadow-sm">
          {entries.length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No traffic yet. Trigger the MCP from Poke or your editor.
            </p>
          ) : (
            <ul className="divide-border divide-y overflow-x-hidden">
              {entries.map((e) => (
                <McpTrafficRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardBody>
  );
}

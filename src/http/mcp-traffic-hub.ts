import type { Response } from "express";

export type McpTrafficDirection = "request" | "response";

export type McpTrafficEntry = {
  id: string;
  ts: string;
  direction: McpTrafficDirection;
  /** JSON-RPC method(s) when inferable */
  method?: string;
  /** One-line summary */
  summary: string;
  /** Truncated JSON (redacted) */
  bodyPreview: string;
  statusCode?: number;
};

const MAX_BUFFER = 500;
const MAX_PREVIEW_CHARS = 14_000;

let seq = 0;

function nextId(): string {
  return `mcp-${Date.now()}-${++seq}`;
}

function mcpTrafficEnabled(): boolean {
  const v = process.env.POKE_AGENTS_MCP_TRAFFIC?.trim().toLowerCase();
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

/** Shallow+recursive redact of obvious secret keys. */
function redactForLog(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[max-depth]";
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactForLog(v, depth + 1));
  }
  const o = { ...(value as Record<string, unknown>) };
  for (const k of Object.keys(o)) {
    const kl = k.toLowerCase();
    if (
      kl.includes("token") ||
      kl.includes("secret") ||
      kl.includes("password") ||
      kl === "authorization" ||
      kl.includes("api_key") ||
      kl.includes("apikey")
    ) {
      o[k] = "[redacted]";
    } else {
      o[k] = redactForLog(o[k], depth + 1);
    }
  }
  return o;
}

function truncateStr(s: string): string {
  if (s.length <= MAX_PREVIEW_CHARS) return s;
  const over = s.length - MAX_PREVIEW_CHARS;
  return `${s.slice(0, MAX_PREVIEW_CHARS)}… [truncated ${over} chars]`;
}

function previewJson(value: unknown): string {
  try {
    const redacted = redactForLog(value);
    return truncateStr(JSON.stringify(redacted, null, 2));
  } catch {
    return truncateStr(String(value));
  }
}

/** Line-oriented SSE (MCP stream): event / data / id fields, blank line between events. */
function looksLikeSse(text: string): boolean {
  return /(?:^|\r?\n)\s*event:\s*/i.test(text) || /(?:^|\r?\n)\s*data:\s*/.test(text);
}

function parseSseEvents(text: string): Array<{ event: string; data: string; id?: string }> {
  const events: Array<{ event: string; data: string; id?: string }> = [];
  let eventName = "message";
  let dataParts: string[] = [];
  let id: string | undefined;
  let hasField = false;

  function flush(): void {
    if (!hasField && dataParts.length === 0) return;
    events.push({
      event: eventName,
      data: dataParts.join("\n"),
      id,
    });
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

function prettyPrintDataPayload(data: string): string {
  const d = data.trim();
  if (!d) return "(empty)";
  if (d.startsWith("{") || d.startsWith("[")) {
    try {
      const parsed = JSON.parse(d) as unknown;
      return JSON.stringify(redactForLog(parsed), null, 2);
    } catch {
      return d;
    }
  }
  return d;
}

function previewSseBody(text: string): string {
  const events = parseSseEvents(text);
  const blocks = events.map((ev, i) => {
    const head = `# ${i + 1} · event: ${ev.event}${ev.id != null && ev.id !== "" ? ` · id: ${ev.id}` : ""}`;
    const body = prettyPrintDataPayload(ev.data);
    const indented = body
      .split("\n")
      .map((ln) => `  ${ln}`)
      .join("\n");
    return `${head}\ndata:\n${indented}`;
  });
  return truncateStr(blocks.join("\n\n—\n\n"));
}

/** Pretty-print JSON responses when possible; SSE streams get structured + pretty `data:` JSON. */
function previewResponseBodyText(text: string): string {
  const t = text.trim();
  if (!t) return "";
  if (looksLikeSse(text)) {
    return previewSseBody(text);
  }
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      const parsed = JSON.parse(t) as unknown;
      const redacted = redactForLog(parsed);
      return truncateStr(JSON.stringify(redacted, null, 2));
    } catch {
      /* not valid JSON */
    }
  }
  return truncateStr(text);
}

function extractMethod(body: unknown): string | undefined {
  if (!body || typeof body !== "object") return undefined;
  if (Array.isArray(body)) {
    const methods = body.map((x) =>
      x && typeof x === "object" && "method" in x
        ? String((x as { method: unknown }).method)
        : "?",
    );
    return `batch(${body.length}): ${methods.join(", ")}`;
  }
  if ("method" in body) return String((body as { method: unknown }).method);
  return undefined;
}

function summarizeRequest(body: unknown): string {
  const m = extractMethod(body);
  if (m?.startsWith("batch")) return m;
  if (m) return m;
  return "MCP POST";
}

function summarizeResponse(statusCode: number, bodyText: string): string {
  if (looksLikeSse(bodyText)) {
    const evs = parseSseEvents(bodyText);
    for (const ev of evs) {
      const d = ev.data.trim();
      if (!d) continue;
      if (d.startsWith("{") || d.startsWith("[")) {
        try {
          const j = JSON.parse(d) as {
            error?: unknown;
            result?: unknown;
            method?: unknown;
            id?: unknown;
          };
          if (j.error != null) return `HTTP ${statusCode} SSE error`;
          if (j.result != null) return `HTTP ${statusCode} SSE ok`;
          if (j.method != null) return `HTTP ${statusCode} SSE ${String(j.method)}`;
        } catch {
          /* ignore */
        }
      }
    }
    return `HTTP ${statusCode} SSE (${evs.length} evt)`;
  }
  try {
    const j = JSON.parse(bodyText) as { result?: unknown; error?: unknown };
    if (j.error != null) return `HTTP ${statusCode} error`;
    if (j.result != null) return `HTTP ${statusCode} ok`;
  } catch {
    /* ignore */
  }
  return `HTTP ${statusCode}`;
}

const listeners = new Set<(e: McpTrafficEntry) => void>();
let buffer: McpTrafficEntry[] = [];

function push(entry: McpTrafficEntry): void {
  buffer.push(entry);
  if (buffer.length > MAX_BUFFER) {
    buffer = buffer.slice(-MAX_BUFFER);
  }
  for (const l of listeners) {
    try {
      l(entry);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

export function subscribeMcpTraffic(
  listener: (e: McpTrafficEntry) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRecentMcpTraffic(limit = 200): McpTrafficEntry[] {
  if (limit >= buffer.length) return [...buffer];
  return buffer.slice(-limit);
}

export function logMcpHttpRequest(body: unknown): void {
  if (!mcpTrafficEnabled()) return;
  push({
    id: nextId(),
    ts: new Date().toISOString(),
    direction: "request",
    method: extractMethod(body),
    summary: summarizeRequest(body),
    bodyPreview: previewJson(body),
  });
}

export function logMcpHttpResponse(statusCode: number, raw: Buffer): void {
  if (!mcpTrafficEnabled()) return;
  const text = raw.toString("utf8");
  push({
    id: nextId(),
    ts: new Date().toISOString(),
    direction: "response",
    method: undefined,
    summary: summarizeResponse(statusCode, text),
    bodyPreview: previewResponseBodyText(text),
    statusCode,
  });
}

/**
 * Wraps Express `res` to capture the full written body once, then log it.
 * Safe to stack with other middleware; only logs once on first `end`.
 */
export function wrapExpressResponseForMcpLogging(res: Response): void {
  if (!mcpTrafficEnabled()) return;

  const chunks: Buffer[] = [];
  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);
  let finished = false;

  const capture = (chunk: unknown): void => {
    if (chunk == null || chunk === false) return;
    if (Buffer.isBuffer(chunk)) {
      chunks.push(chunk);
      return;
    }
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk));
      return;
    }
    if (chunk instanceof Uint8Array) {
      chunks.push(Buffer.from(chunk));
    }
  };

  res.write = function (chunk: unknown, ...args: unknown[]) {
    capture(chunk);
    return (origWrite as (a: unknown, ...r: unknown[]) => boolean)(
      chunk,
      ...args,
    );
  } as typeof res.write;

  res.end = function (chunk?: unknown, ...args: unknown[]) {
    if (!finished) {
      finished = true;
      capture(chunk);
      const buf =
        chunks.length === 0 ? Buffer.alloc(0) : Buffer.concat(chunks);
      logMcpHttpResponse(res.statusCode || 200, buf);
    }
    return (origEnd as (a?: unknown, ...r: unknown[]) => Response)(
      chunk,
      ...args,
    );
  } as typeof res.end;
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolStructured } from "./tool-result.js";
import {
  WEB,
  webFetchInput,
  webFetchOutputShape,
  webSearchInput,
  webSearchOutputShape,
} from "./tool-schemas.js";
import { withMcpToolLogging } from "./tool-logging.js";

function braveApiKey(): string | undefined {
  const a = process.env.POKE_AGENTS_BRAVE_API_KEY?.trim();
  const b = process.env.BRAVE_API_KEY?.trim();
  return a || b || undefined;
}

export function registerWebTools(mcp: McpServer): void {
  mcp.registerTool(
    "web_fetch",
    {
      title: WEB.fetch.title,
      description: WEB.fetch.description,
      inputSchema: webFetchInput,
      outputSchema: webFetchOutputShape,
    },
    withMcpToolLogging("web_fetch", async ({ url, max_bytes, timeout_ms }) => {
      const maxBytes = max_bytes ?? 500_000;
      const timeoutMs = timeout_ms ?? 25_000;
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: ac.signal,
          headers: {
            Accept:
              "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5",
            "User-Agent":
              "poke-agents-mcp/0.2 (+https://github.com/leoakok/poke-agents; dev fetch)",
          },
        });
        const ct = res.headers.get("content-type") ?? "";
        const buf = new Uint8Array(await res.arrayBuffer());
        const truncated = buf.length > maxBytes;
        const slice = buf.subarray(0, Math.min(buf.length, maxBytes));
        let body_preview: string;
        try {
          body_preview = new TextDecoder("utf-8", { fatal: false }).decode(
            slice,
          );
        } catch {
          body_preview = `[binary ${slice.length} bytes]`;
        }
        return toolStructured({
          ok: res.ok,
          url: res.url,
          status: res.status,
          status_text: res.statusText,
          content_type: ct,
          bytes_returned: buf.length,
          body_truncated: truncated,
          body_preview:
            body_preview.length > maxBytes
              ? body_preview.slice(0, maxBytes)
              : body_preview,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const name = e instanceof Error ? e.name : "Error";
        let classification: string = "unknown";
        if (name === "AbortError") classification = "timeout";
        else if (/fetch failed|ECONNREFUSED|ENOTFOUND|ENETUNREACH|certificate|TLS|SSL/i.test(msg)) {
          classification = /cert|TLS|SSL/i.test(msg)
            ? "network_tls"
            : "network_unreachable";
        }
        return toolStructured({
          ok: false,
          url,
          error: msg,
          error_name: name,
          error_classification: classification,
        });
      } finally {
        clearTimeout(t);
      }
    }),
  );

  mcp.registerTool(
    "web_search",
    {
      title: WEB.search.title,
      description: WEB.search.description,
      inputSchema: webSearchInput,
      outputSchema: webSearchOutputShape,
    },
    withMcpToolLogging("web_search", async ({ query, count }) => {
      const key = braveApiKey();
      if (!key) {
        return toolStructured({
          ok: false,
          error:
            "No Brave Search API key configured. Set POKE_AGENTS_BRAVE_API_KEY or BRAVE_API_KEY.",
          setup:
            "Create a key at https://api.search.brave.com — free tier available.",
        });
      }
      const n = Math.min(20, Math.max(1, count ?? 8));
      const u = new URL("https://api.search.brave.com/res/v1/web/search");
      u.searchParams.set("q", query);
      u.searchParams.set("count", String(n));
      try {
        const res = await fetch(u, {
          headers: {
            "X-Subscription-Token": key,
            Accept: "application/json",
          },
        });
        const text = await res.text();
        if (!res.ok) {
          return toolStructured({
            ok: false,
            status: res.status,
            error: `Brave Search API error: ${res.status} ${res.statusText}`,
            body_preview: text.slice(0, 1500),
          });
        }
        let data: unknown;
        try {
          data = JSON.parse(text) as unknown;
        } catch {
          return toolStructured({
            ok: false,
            error: "Brave Search returned non-JSON",
            body_preview: text.slice(0, 1500),
          });
        }
        const web = (data as { web?: { results?: unknown[] } }).web;
        const raw = Array.isArray(web?.results) ? web.results : [];
        const results = raw.map((item) => {
          const o = item as Record<string, unknown>;
          return {
            title: typeof o.title === "string" ? o.title : null,
            url: typeof o.url === "string" ? o.url : null,
            description:
              typeof o.description === "string"
                ? o.description
                : typeof o.extra_snippets === "object" &&
                    o.extra_snippets !== null &&
                    Array.isArray(o.extra_snippets) &&
                    typeof o.extra_snippets[0] === "string"
                  ? o.extra_snippets[0]
                  : null,
          };
        });
        return toolStructured({
          ok: true,
          query,
          provider: "brave",
          results,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return toolStructured({
          ok: false,
          error: msg,
          error_classification: "network_unreachable",
        });
      }
    }),
  );
}

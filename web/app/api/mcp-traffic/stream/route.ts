import { NextResponse } from "next/server";

import { mcpUpstreamBase } from "@/lib/mcp-proxy";
import { mcpUpstreamFetch } from "@/lib/mcp-upstream-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function passthroughSse(
  upstream: ReadableStream<Uint8Array>,
  clientSignal: AbortSignal,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const onAbort = () => {
    void reader.cancel().catch(() => {});
  };
  if (clientSignal.aborted) {
    onAbort();
  } else {
    clientSignal.addEventListener("abort", onAbort, { once: true });
  }

  return new ReadableStream({
    async start(controller) {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch {
        try {
          controller.close();
        } catch {
          /* noop */
        }
      }
    },
    cancel() {
      void reader.cancel().catch(() => {});
    },
  });
}

export async function GET(request: Request) {
  try {
    const r = await mcpUpstreamFetch(
      `${mcpUpstreamBase()}/api/mcp-traffic/stream`,
      {
        timeoutMs: 0,
        headers: { Accept: "text/event-stream" },
        signal: request.signal,
      },
    );
    if (!r.ok || !r.body) {
      return new NextResponse("MCP traffic stream unavailable", {
        status: 502,
      });
    }
    const out = passthroughSse(r.body, request.signal);
    return new NextResponse(out, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  } catch (e) {
    if (
      e instanceof DOMException &&
      (e.name === "AbortError" || e.code === 20)
    ) {
      return new NextResponse(null, { status: 204 });
    }
    if (e instanceof Error && e.name === "AbortError") {
      return new NextResponse(null, { status: 204 });
    }
    return new NextResponse("MCP server unreachable", { status: 502 });
  }
}

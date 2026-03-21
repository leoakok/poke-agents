import { NextResponse } from "next/server";

import { mcpUpstreamBase } from "@/lib/mcp-proxy";
import { mcpUpstreamFetch } from "@/lib/mcp-upstream-fetch";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Next.js pipes `fetch()` bodies directly to the response; when the MCP process
 * dies (Ctrl+C) the upstream socket errors with UND_ERR_SOCKET and that
 * surfaces as "failed to pipe response". Copy through a fresh ReadableStream
 * and close quietly on any read/cancel error.
 */
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
          /* already closed */
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
      `${mcpUpstreamBase()}/api/agent-runtime/stream`,
      {
        timeoutMs: 0,
        headers: { Accept: "text/event-stream" },
        signal: request.signal,
      },
    );
    if (!r.ok || !r.body) {
      return new NextResponse("MCP server unavailable or stream not supported", {
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
    return new NextResponse("MCP server unreachable (socket closed)", {
      status: 502,
    });
  }
}

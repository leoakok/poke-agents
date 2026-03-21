import { NextResponse } from "next/server";

import { mcpUpstreamBase } from "@/lib/mcp-proxy";
import { mcpUpstreamFetch } from "@/lib/mcp-upstream-fetch";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const r = await mcpUpstreamFetch(
      `${mcpUpstreamBase()}/api/agent-runtime/stop`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      },
    );
    const text = await r.text();
    return new NextResponse(text, {
      status: r.status,
      headers: {
        "content-type":
          r.headers.get("content-type") ?? "application/json; charset=utf-8",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { ok: false, error: `MCP unreachable: ${msg}` },
      { status: 502 },
    );
  }
}

import { NextResponse } from "next/server";

import { mcpUpstreamBase } from "@/lib/mcp-proxy";
import { mcpUpstreamFetch } from "@/lib/mcp-upstream-fetch";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const url = `${mcpUpstreamBase()}/api/connectors`;
    const r = await mcpUpstreamFetch(url);
    const body = await r.text();
    return new NextResponse(body, {
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

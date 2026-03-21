import { NextResponse } from "next/server";

import { mcpUpstreamBase } from "@/lib/mcp-proxy";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = `${mcpUpstreamBase()}/api/connectors`;
  const r = await fetch(url, { cache: "no-store" });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: {
      "content-type":
        r.headers.get("content-type") ?? "application/json; charset=utf-8",
    },
  });
}

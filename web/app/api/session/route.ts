import { NextResponse } from "next/server";

import { mcpUpstreamBase } from "@/lib/mcp-proxy";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const u = new URL(`${mcpUpstreamBase()}/api/session`);
  incoming.searchParams.forEach((v, k) => {
    u.searchParams.set(k, v);
  });
  const r = await fetch(u.toString(), { cache: "no-store" });
  const body = await r.text();
  return new NextResponse(body, {
    status: r.status,
    headers: {
      "content-type":
        r.headers.get("content-type") ?? "application/json; charset=utf-8",
    },
  });
}

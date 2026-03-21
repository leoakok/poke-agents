/**
 * Poke MCP callback protocol (matches Python poke.mcp _send_callback_sync).
 * POST JSON { content, hasMore } with Authorization: Bearer <token>.
 */

import { getMcpRequestContext } from "./mcp-request-context.js";

export type PokeCallbackResult = {
  nextToken?: string;
};

export async function sendPokeCallback(opts: {
  url: string;
  token: string;
  content: string;
  hasMore: boolean;
}): Promise<PokeCallbackResult> {
  const body = JSON.stringify({
    content: opts.content,
    hasMore: opts.hasMore,
  });
  const maxAttempts = 5;
  let token = opts.token;
  let url = opts.url;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body,
      });

      if (res.status === 429) {
        let retryAfterMs = 60_000;
        try {
          const j = (await res.json()) as { retryAfterMs?: number };
          if (typeof j.retryAfterMs === "number") retryAfterMs = j.retryAfterMs;
        } catch {
          /* ignore */
        }
        await new Promise((r) => setTimeout(r, retryAfterMs));
        continue;
      }

      if (!res.ok) {
        return {};
      }

      try {
        const j = (await res.json()) as PokeCallbackResult;
        return typeof j?.nextToken === "string" ? { nextToken: j.nextToken } : {};
      } catch {
        return {};
      }
    } catch {
      return {};
    }
  }

  return {};
}

export function resolvePokeCallbackFromToolArgs(args: {
  poke_callback_url?: string;
  poke_callback_token?: string;
}): { url?: string; token?: string } {
  const url = args.poke_callback_url?.trim();
  const token = args.poke_callback_token?.trim();
  if (url && token) return { url, token };
  const ctx = getMcpRequestContext();
  const u = ctx?.pokeCallbackUrl?.trim();
  const t = ctx?.pokeCallbackToken?.trim();
  if (u && t) return { url: u, token: t };
  return {};
}

/**
 * Resilient fetch to the poke-agents HTTP API (handles transient socket drops).
 */
function isRetryableNetworkError(e: unknown): boolean {
  const name = e instanceof Error ? e.name : "";
  const msg = e instanceof Error ? e.message : String(e);
  const cause =
    e instanceof Error && "cause" in e && e.cause instanceof Error
      ? e.cause.message
      : "";
  const blob = `${name} ${msg} ${cause}`.toLowerCase();
  return (
    blob.includes("terminated") ||
    blob.includes("und_err_socket") ||
    blob.includes("econnreset") ||
    blob.includes("epipe") ||
    blob.includes("socket") ||
    blob.includes("fetch failed")
  );
}

export type McpUpstreamFetchOptions = RequestInit & {
  /** Override default 45s timeout (omit for streams). */
  timeoutMs?: number;
};

export async function mcpUpstreamFetch(
  url: string,
  init?: McpUpstreamFetchOptions,
): Promise<Response> {
  const { timeoutMs, signal: userSignal, ...rest } = init ?? {};
  const attempts = 3;
  /** `0` = no per-attempt timeout (e.g. SSE). Default 45s for JSON APIs. */
  const perAttemptMs = timeoutMs !== undefined ? timeoutMs : 45_000;
  let last: unknown;

  for (let i = 1; i <= attempts; i++) {
    const ac = new AbortController();
    const t =
      perAttemptMs > 0
        ? setTimeout(() => ac.abort(), perAttemptMs)
        : undefined;
    try {
      if (userSignal) {
        if (userSignal.aborted) throw new DOMException("Aborted", "AbortError");
        userSignal.addEventListener("abort", () => ac.abort(), { once: true });
      }
      const r = await fetch(url, {
        ...rest,
        cache: "no-store",
        signal: ac.signal,
      });
      if (t !== undefined) clearTimeout(t);
      return r;
    } catch (e) {
      if (t !== undefined) clearTimeout(t);
      last = e;
      if (i < attempts && isRetryableNetworkError(e)) {
        await new Promise((r) => setTimeout(r, 150 * i));
        continue;
      }
      throw e;
    }
  }
  throw last;
}

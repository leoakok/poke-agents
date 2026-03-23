"use client";

import { useEffect, useState } from "react";

type NpmVersionApiResponse =
  | {
      ok: true;
      current: string;
      latest: string;
      needsUpdate: boolean;
      note: string;
    }
  | { ok: false; error: string };

export function NpmVersionNotice() {
  const [state, setState] = useState<NpmVersionApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/npm-version", { cache: "no-store" });
        const j = (await r.json()) as NpmVersionApiResponse;
        if (!cancelled) setState(j);
      } catch {
        // If the network is offline, we just don't show the banner.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state || !("ok" in state) || state.ok !== true) return null;
  if (!state.needsUpdate) return null;

  return (
    <a
      href="https://www.npmjs.com/package/poke-agents"
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:bg-muted/60 hover:text-foreground flex shrink-0 items-center rounded-md px-2 py-1.5 text-[0.65rem] border border-border bg-muted/40"
      title={state.note}
    >
      Update: {state.current} → {state.latest}
    </a>
  );
}


import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";

// The npm launcher package people run via:
//   npx poke-agents@latest
const PACKAGE_NAME = "poke-agents";
// For scoped packages, the registry expects the scope as its own path segment,
// e.g. `/@scope/name/latest` (so do *not* encode the `/` separator).
const NPM_LATEST_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;

type ParsedSemver = { major: number; minor: number; patch: number };

function parseSemver(v: string): ParsedSemver | null {
  const main = v.split("-")[0].trim();
  const parts = main.split(".");
  if (parts.length < 3) return null;
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  const patch = Number(parts[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }
  return { major, minor, patch };
}

function compareSemver(a: string, b: string): number | null {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return null;
  if (pa.major !== pb.major) return pa.major > pb.major ? 1 : -1;
  if (pa.minor !== pb.minor) return pa.minor > pb.minor ? 1 : -1;
  if (pa.patch !== pb.patch) return pa.patch > pb.patch ? 1 : -1;
  return 0;
}

function currentVersion(): string {
  // We check the published *launcher* package version.
  const pkgPath = new URL(
    "../../../../npm/poke-agents/package.json",
    import.meta.url,
  );
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: unknown };
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

let cache:
  | {
      atMs: number;
      res:
        | {
            ok: true;
            current: string;
            latest: string;
            needsUpdate: boolean;
            note: string;
          }
        | { ok: false; error: string };
    }
  | null = null;

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export const dynamic = "force-dynamic";

export async function GET() {
  const disabled =
    process.env.POKE_AGENTS_DISABLE_NPM_VERSION_CHECK === "1" ||
    process.env.POKE_AGENTS_DISABLE_NPM_VERSION_NOTICE === "1";
  if (disabled) {
    return NextResponse.json({
      ok: true,
      current: currentVersion(),
      latest: currentVersion(),
      needsUpdate: false,
      note: "npm version check disabled",
    });
  }

  const now = Date.now();
  if (cache && now - cache.atMs < TTL_MS) return NextResponse.json(cache.res);

  const cur = currentVersion();
  const timeoutMs = 1500;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(NPM_LATEST_URL, {
      signal: ctrl.signal,
      headers: { accept: "application/json" },
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status} ${r.statusText}`);
    }
    const body = (await r.json()) as { version?: unknown };
    if (typeof body.version !== "string") {
      throw new Error("Missing `version` in npm registry response");
    }
    const latest = body.version;
    const cmp = compareSemver(cur, latest);
    const needsUpdate = cmp != null ? cmp > 0 : cur !== latest;
    const note = needsUpdate
      ? `Update available: ${PACKAGE_NAME} ${cur} → ${latest}`
      : `Up to date: ${PACKAGE_NAME} ${cur}`;
    const res = { ok: true as const, current: cur, latest, needsUpdate, note };
    cache = { atMs: now, res };
    return NextResponse.json(res);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const res = { ok: false as const, error: msg };
    cache = { atMs: now, res };
    return NextResponse.json(res);
  } finally {
    clearTimeout(t);
  }
}


import { readFileSync } from "node:fs";

// The npm launcher package people run via:
//   npx @leokok/poke-agents@latest
const PACKAGE_NAME = "@leokok/poke-agents";
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

function readCurrentVersion(): string {
  // Works in both src/ and dist/ by walking relative to this helper file.
  // We check the *launcher* package version (npm/poke-agents/package.json),
  // not the internal repo package.json.
  const pkgPath = new URL("../../npm/poke-agents/package.json", import.meta.url);
  const raw = readFileSync(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as { version?: unknown };
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

let cached:
  | {
      atMs: number;
      ok: true;
      current: string;
      latest: string;
      needsUpdate: boolean;
      note: string;
    }
  | { atMs: number; ok: false; error: string }
  | null = null;

const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

async function fetchLatestVersion(timeoutMs: number): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(NPM_LATEST_URL, {
      method: "GET",
      signal: ctrl.signal,
      headers: { "accept": "application/json" },
    });
    if (!r.ok) {
      throw new Error(`HTTP ${r.status} ${r.statusText}`);
    }
    const body = (await r.json()) as { version?: unknown };
    if (typeof body.version !== "string") {
      throw new Error("Missing `version` in npm registry response");
    }
    return body.version;
  } finally {
    clearTimeout(t);
  }
}

export async function checkNpmLatestVersion(opts?: {
  timeoutMs?: number;
  // Allow integrators to disable checks in offline environments.
  disabled?: boolean;
}): Promise<
  | {
      ok: true;
      current: string;
      latest: string;
      needsUpdate: boolean;
      note: string;
    }
  | { ok: false; error: string }
> {
  const disabled =
    opts?.disabled ??
    process.env.POKE_AGENTS_DISABLE_NPM_VERSION_CHECK === "1";
  if (disabled) {
    return {
      ok: false,
      error:
        "disabled via POKE_AGENTS_DISABLE_NPM_VERSION_CHECK=1 (or opts.disabled=true)",
    };
  }

  const now = Date.now();
  if (cached && now - cached.atMs < TTL_MS) {
    return cached.ok
      ? {
          ok: true,
          current: cached.current,
          latest: cached.latest,
          needsUpdate: cached.needsUpdate,
          note: cached.note,
        }
      : { ok: false, error: cached.error };
  }

  const current = readCurrentVersion();
  const timeoutMs = opts?.timeoutMs ?? 1500;
  try {
    const latest = await fetchLatestVersion(timeoutMs);
    const cmp = compareSemver(current, latest);
    const needsUpdate = cmp != null ? cmp > 0 : current !== latest;
    const note = needsUpdate
      ? `npm: update available for ${PACKAGE_NAME} (${current} → ${latest}). Run: npx ${PACKAGE_NAME}@latest`
      : `npm: already up to date for ${PACKAGE_NAME} (${current}).`;
    cached = { atMs: now, ok: true, current, latest, needsUpdate, note };
    return cached;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    cached = { atMs: now, ok: false, error: msg };
    return { ok: false, error: msg };
  }
}


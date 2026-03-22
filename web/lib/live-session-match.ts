import type { SessionRow } from "@/lib/poke-agents-api";

const UUID_ONE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** OpenCode native session id (`ses_…`) stored as `composerId` on disk rows. */
const OPENCODE_SES = /^ses_[a-z0-9][a-z0-9_]*$/i;

const SES_TOKEN_GLOBAL = /\bses_[a-z0-9][a-z0-9_]*\b/gi;

const UUID_GLOBAL =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

/** `--resume <uuid>` or `--resume=<uuid>` from `ps` command string. */
export function extractResumeUuidFromCommand(command: string): string | null {
  const m = command.match(
    /--resume(?:=|\s+)([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i,
  );
  return m ? m[1].toLowerCase() : null;
}

/** All UUID-like tokens in command (resume, etc.). */
export function extractAllUuidsFromCommand(command: string): string[] {
  const set = new Set<string>();
  const matches = command.match(UUID_GLOBAL) ?? [];
  for (const m of matches) set.add(m.toLowerCase());
  return [...set];
}

function base64UrlToUtf8(b64url: string): string {
  let b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch {
    return "";
  }
}

/**
 * Read `composerId` from opaque `sessions[].id` (`source:base64url`).
 * Cursor: uuid. OpenCode: `ses_…`. Codex: often uuid in metadata.
 */
export function composerIdFromSessionId(sessionId: string): string | null {
  const idx = sessionId.indexOf(":");
  if (idx <= 0) return null;
  const payload = sessionId.slice(idx + 1);
  if (!payload) return null;
  const json = base64UrlToUtf8(payload);
  if (!json.startsWith("{")) return null;
  try {
    const o = JSON.parse(json) as Record<string, unknown>;
    const c = o.composerId;
    if (typeof c !== "string") return null;
    const t = c.trim();
    if (UUID_ONE.test(t)) return t.toLowerCase();
    if (OPENCODE_SES.test(t)) return t.toLowerCase();
    return null;
  } catch {
    return null;
  }
}

/** Tokens that can link a live `opencode run` line to a saved OpenCode session. */
export function extractOpenCodeSessionTokensFromCommand(
  command: string,
): string[] {
  const out = new Set<string>();
  for (const m of command.match(SES_TOKEN_GLOBAL) ?? []) {
    out.add(m.toLowerCase());
  }
  const sess = command.match(/--session(?:=|\s+)(\S+)/i);
  if (sess?.[1]?.toLowerCase().startsWith("ses_")) {
    out.add(sess[1].toLowerCase());
  }
  return [...out];
}

export function sessionIdsMatchingResumeUuid(
  sessions: SessionRow[],
  resumeUuid: string | null,
): string[] {
  if (!resumeUuid) return [];
  const u = resumeUuid.toLowerCase();
  return sessions
    .map((s) => s.id)
    .filter((id) => {
      if (composerIdFromSessionId(id) === u) return true;
      /** Non-Cursor ids may embed the chat uuid directly in `id` (e.g. plain `source:uuid`). */
      const embedded = id.match(UUID_GLOBAL) ?? [];
      return embedded.some((m) => m.toLowerCase() === u);
    });
}

export function buildLiveResumeIndex(
  sessions: SessionRow[],
  command: string,
): { resume: string | null; matchingSessionIds: string[] } {
  const resume = extractResumeUuidFromCommand(command);
  const matching = new Set<string>();
  if (resume) {
    for (const id of sessionIdsMatchingResumeUuid(sessions, resume)) {
      matching.add(id);
    }
  }
  /** Some invocations pass the chat uuid without `--resume`; match any v4-like token. */
  for (const u of extractAllUuidsFromCommand(command)) {
    for (const id of sessionIdsMatchingResumeUuid(sessions, u)) {
      matching.add(id);
    }
  }
  for (const ses of extractOpenCodeSessionTokensFromCommand(command)) {
    for (const s of sessions) {
      const cid = composerIdFromSessionId(s.id);
      if (cid === ses) {
        matching.add(s.id);
        continue;
      }
      if (s.id.toLowerCase().includes(ses)) {
        matching.add(s.id);
      }
    }
  }
  return { resume, matchingSessionIds: [...matching] };
}

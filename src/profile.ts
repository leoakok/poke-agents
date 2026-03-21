/**
 * Which vendored editor adapters are active. Default first step: Cursor + OpenCode only.
 * Override: POKE_AGENTS_EDITORS=cursor,opencode,claude (comma or space separated).
 */
const DEFAULT_EDITORS = ["cursor", "opencode"] as const;

function parseEditorList(raw: string | undefined): string[] {
  if (raw == null || raw.trim() === "") {
    return [...DEFAULT_EDITORS];
  }
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

let cachedAllow: ReadonlySet<string> | null = null;

export function getAllowedEditorIds(): ReadonlySet<string> {
  if (!cachedAllow) {
    cachedAllow = new Set(parseEditorList(process.env.POKE_AGENTS_EDITORS));
  }
  return cachedAllow;
}

export function resetProfileCacheForTests(): void {
  cachedAllow = null;
}

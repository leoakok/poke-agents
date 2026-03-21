export const CONNECTOR_PREFS_KEY = "poke-agents-dashboard-connectors-v1";

/** Persisted list of connector ids that should appear in the session list (dashboard only). */
export function loadEnabledConnectorIds(allIds: string[]): Set<string> {
  if (typeof window === "undefined") return new Set(allIds);
  if (allIds.length === 0) return new Set();
  try {
    const raw = localStorage.getItem(CONNECTOR_PREFS_KEY);
    if (!raw) return new Set(allIds);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set(allIds);
    const allowed = new Set(
      parsed.filter((x): x is string => typeof x === "string" && allIds.includes(x)),
    );
    return allowed.size > 0 ? allowed : new Set(allIds);
  } catch {
    return new Set(allIds);
  }
}

export function saveEnabledConnectorIds(ids: Set<string>): void {
  localStorage.setItem(CONNECTOR_PREFS_KEY, JSON.stringify([...ids]));
}

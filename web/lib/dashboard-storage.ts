export const ARCHIVED_STORAGE_KEY = "poke-agents-dashboard-archived-v1";

export function loadArchivedSessionIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(ARCHIVED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function persistArchivedSessionIds(ids: Set<string>): void {
  localStorage.setItem(ARCHIVED_STORAGE_KEY, JSON.stringify([...ids]));
}

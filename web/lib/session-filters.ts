/** Poke’s usual coding-agent sources (vs wider POKE_AGENTS_EDITORS). */
export function isPokeStackSource(source: string): boolean {
  const s = source.toLowerCase();
  return (
    s === "cursor" ||
    s.startsWith("cursor") ||
    s === "opencode" ||
    s.startsWith("opencode") ||
    s === "codex" ||
    s.startsWith("codex")
  );
}

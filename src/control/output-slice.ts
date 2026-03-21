/** Slice UTF-16 string by character indices (same as JS string indices). */
export function sliceText(
  text: string,
  offset: number,
  limit: number,
): { text: string; total_length: number; next_offset: number; truncated: boolean } {
  const total_length = text.length;
  if (offset < 0) {
    return { text: "", total_length, next_offset: 0, truncated: total_length > 0 };
  }
  if (limit <= 0) {
    return { text: "", total_length, next_offset: offset, truncated: offset < total_length };
  }
  const end = Math.min(offset + limit, total_length);
  const chunk = text.slice(offset, end);
  const truncated = end < total_length;
  return {
    text: chunk,
    total_length,
    next_offset: end,
    truncated,
  };
}

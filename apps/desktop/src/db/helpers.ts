export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function normalizeQuery(rawQuery: string): string {
  const tokens = rawQuery.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.map((term) => `${term.replace(/\*+$/g, "")}*`).join(" ");
}

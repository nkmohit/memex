/**
 * Input validation helpers — centralises checks for user-supplied search and
 * import parameters.  Used by the DB layer before interpolating values into SQL.
 */

const VALID_SOURCES = new Set(["claude", "chatgpt", "gemini", "grok", "other"]);

const VALID_SORTS = new Set([
  "relevance",
  "last_occurrence_desc",
  "occurrence_count_desc",
  "title_az",
  "title_za",
]);

export function isValidSource(source: string): boolean {
  return VALID_SOURCES.has(source.toLowerCase()) || source.length > 0;
}

export function sanitizeSource(source?: string): string | undefined {
  if (!source) return undefined;
  const trimmed = source.trim().toLowerCase();
  if (!trimmed) return undefined;
  // Allow only known sources or alphanumeric slugs (3-20 chars)
  if (!/^[a-z0-9_-]{1,30}$/.test(trimmed)) return undefined;
  return trimmed;
}

export function clampLimit(limit: unknown, defaultValue = 20, max = 100): number {
  const n = typeof limit === "number" ? limit : Number(limit);
  if (!Number.isFinite(n)) return defaultValue;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

export function clampOffset(offset: unknown): number {
  const n = typeof offset === "number" ? offset : Number(offset);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function sanitizeSort(sort: unknown): string {
  if (typeof sort === "string" && VALID_SORTS.has(sort)) return sort;
  return "last_occurrence_desc";
}

export function sanitizeQuery(query: string): string {
  const trimmed = query.trim();
  if (!trimmed) return "";
  // Limit length to avoid pathological FTS queries
  if (trimmed.length > 500) return trimmed.slice(0, 500);
  return trimmed;
}

export function isValidTimestamp(ts: unknown): boolean {
  return typeof ts === "number" && Number.isFinite(ts) && ts >= 0 && ts <= Date.now() + 86_400_000;
}

export function sanitizeDateRange(
  dateFrom?: unknown,
  dateTo?: unknown
): { from?: number; to?: number } {
  const from = typeof dateFrom === "number" && isValidTimestamp(dateFrom) ? dateFrom : undefined;
  const to = typeof dateTo === "number" && isValidTimestamp(dateTo) ? dateTo : undefined;
  if (from !== undefined && to !== undefined && from > to) {
    return { from: to, to: from };
  }
  return { from, to };
}

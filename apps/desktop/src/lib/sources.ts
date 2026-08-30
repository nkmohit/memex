import { IMPORT_SOURCES } from "../importer";
import type { SourceStats } from "../db";

export { sourceLabel } from "./sourceDisplay";

export function getAvailableSources(sourceStats: SourceStats[]): string[] {
  const dbSources = sourceStats.map((s) => s.source);
  const all = new Set([...dbSources, ...IMPORT_SOURCES.filter((s) => s.available).map((s) => s.id)]);
  return Array.from(all);
}

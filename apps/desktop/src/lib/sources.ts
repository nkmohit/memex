import { IMPORT_SOURCES } from "../importer";
import type { SourceStats } from "../db";

export function sourceLabel(source: string): string {
  const meta = IMPORT_SOURCES.find((s) => s.id === source);
  return meta?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
}

export function getAvailableSources(sourceStats: SourceStats[]): string[] {
  const dbSources = sourceStats.map((s) => s.source);
  const all = new Set([...dbSources, ...IMPORT_SOURCES.filter((s) => s.available).map((s) => s.id)]);
  return Array.from(all);
}

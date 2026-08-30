import { getSourceStats, getStats } from "../db/queries";
import type { DbStats, SourceStats } from "../db/types";
import { logger } from "./logger";

// App version — keep in sync with apps/desktop/package.json
export const APP_VERSION = "0.4.0";

export interface IndexHealth {
  /** Percentage of messages indexed (0–100). 100 when no messages. */
  indexedPct: number;
  /** True when messages exist but nothing is indexed (index missing/corrupt). */
  missing: boolean;
  totalMessages: number;
  indexedMessages: number;
}

export interface Diagnostics {
  db: DbStats;
  indexHealth: IndexHealth;
  sourceStats: SourceStats[];
  version: string;
  generatedAt: number;
}

export function computeIndexHealth(stats: DbStats): IndexHealth {
  const total = stats.messageCount;
  const indexed = stats.indexedMessageCount;
  const indexedPct = total > 0 ? Math.round((indexed / total) * 100) : 100;
  const missing = total > 0 && indexed === 0;
  return {
    indexedPct,
    missing,
    totalMessages: total,
    indexedMessages: indexed,
  };
}

export async function isSearchIndexHealthy(): Promise<boolean> {
  const stats = await getStats();
  const health = computeIndexHealth(stats);
  logger.debug("diagnostics: index health", health);
  return !health.missing;
}

export async function getDiagnostics(): Promise<Diagnostics> {
  logger.debug("diagnostics: collecting");
  const [db, sourceStats] = await Promise.all([getStats(), getSourceStats()]);
  const indexHealth = computeIndexHealth(db);
  const diagnostics: Diagnostics = {
    db,
    indexHealth,
    sourceStats,
    version: APP_VERSION,
    generatedAt: Date.now(),
  };
  logger.debug("diagnostics: collected", diagnostics);
  return diagnostics;
}

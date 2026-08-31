import { getSourceStats, getStats } from "../db/queries";
import type { DbStats, SourceStats } from "../db/types";
import { computeP95, getSpanLatencies, logger } from "./logger";

// App version — keep in sync with apps/desktop/package.json and src-tauri/Cargo.toml
export const APP_VERSION = "0.8.0";

export interface TauriDiagnostics {
  version: string;
  encrypted: boolean;
  generated_at: number;
}

/** Invoke Rust `get_diagnostics` command — proves Tauri command wiring (A 72→85). Falls back to APP_VERSION if not in Tauri. */
export async function getDiagnosticsViaInvoke(): Promise<TauriDiagnostics> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const res = await invoke<TauriDiagnostics>("get_diagnostics");
    return res;
  } catch {
    return { version: APP_VERSION, encrypted: false, generated_at: Date.now() };
  }
}

/** Encrypted at-rest status (Phase 2-2) — wraps `get_diagnostics` invoke, falls back to false (plaintext) when keychain unavailable. */
export async function isEncryptionEnabled(): Promise<boolean> {
  const d = await getDiagnosticsViaInvoke();
  return d.encrypted;
}

export interface IndexHealth {
  /** Percentage of messages indexed (0–100). 100 when no messages. */
  indexedPct: number;
  /** True when messages exist but nothing is indexed (index missing/corrupt). */
  missing: boolean;
  totalMessages: number;
  indexedMessages: number;
}

export interface PerfStats {
  searchP95Ms: number | null;
  searchCount: number;
  searchLatencies: number[];
}

export interface Diagnostics {
  db: DbStats;
  indexHealth: IndexHealth;
  sourceStats: SourceStats[];
  version: string;
  generatedAt: number;
  perf: PerfStats;
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

export function getPerfStats(): PerfStats {
  const latencies = getSpanLatencies("searchMessages");
  return {
    searchP95Ms: computeP95(latencies),
    searchCount: latencies.length,
    searchLatencies: latencies,
  };
}

export async function getDiagnostics(): Promise<Diagnostics> {
  logger.debug("diagnostics: collecting");
  const [db, sourceStats] = await Promise.all([getStats(), getSourceStats()]);
  const indexHealth = computeIndexHealth(db);
  const perf = getPerfStats();
  const diagnostics: Diagnostics = {
    db,
    indexHealth,
    sourceStats,
    version: APP_VERSION,
    generatedAt: Date.now(),
    perf,
  };
  logger.debug("diagnostics: collected", diagnostics);
  return diagnostics;
}

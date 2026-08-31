import { getDb, withDbLock } from "./connection";
import { buildDashboardSnapshot } from "./dashboardSnapshot";
import {
  readDataVersion,
  bumpDataVersion,
  writeDashboardCache,
  getDashboardMemoryCache,
  setDashboardMemoryCache,
} from "./dashboardCache";
import type { DashboardSnapshot } from "./types";

// Re-export cache helpers for tests and other modules
export { readDataVersion, bumpDataVersion, buildDashboardSnapshot };
export { getDataVersion, markDataChanged, getCachedDashboardSnapshot } from "./dashboardCache";

export function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  return withDbLock(async () => {
    const database = await getDb();
    const currentVersion = await readDataVersion(database);
    const memoryCache = getDashboardMemoryCache();

    if (memoryCache && memoryCache.dataVersion === currentVersion) {
      return memoryCache;
    }

    const rows = await database.select<{ payload: string; data_version: number }[]>(
      "SELECT payload, data_version FROM dashboard_cache WHERE cache_key = 'overview:v1' LIMIT 1"
    );
    const cached = rows[0];
    if (cached && cached.data_version === currentVersion) {
      try {
        const parsed = JSON.parse(cached.payload) as DashboardSnapshot;
        setDashboardMemoryCache(parsed);
        return parsed;
      } catch {
        // fall through to build
      }
    }

    const snapshot = await buildDashboardSnapshot(database, currentVersion);
    await writeDashboardCache(database, snapshot);
    setDashboardMemoryCache(snapshot);
    return snapshot;
  });
}

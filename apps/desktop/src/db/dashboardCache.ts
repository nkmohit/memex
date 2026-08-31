import type Database from "@tauri-apps/plugin-sql";
import { getDb, withDbLock } from "./connection";
import type { DashboardSnapshot } from "./types";

let dashboardMemoryCache: DashboardSnapshot | null = null;

export function getDashboardMemoryCache(): DashboardSnapshot | null {
  return dashboardMemoryCache;
}

export function setDashboardMemoryCache(snapshot: DashboardSnapshot | null): void {
  dashboardMemoryCache = snapshot;
}

export async function readDataVersion(database: Database): Promise<number> {
  const rows = await database.select<{ value: string }[]>(
    "SELECT value FROM app_meta WHERE key = 'data_version' LIMIT 1"
  );
  const parsed = Number(rows[0]?.value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function writeDashboardCache(
  database: Database,
  snapshot: DashboardSnapshot
): Promise<void> {
  await database.execute(
    `INSERT INTO dashboard_cache (cache_key, payload, data_version, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload,
       data_version = excluded.data_version,
       updated_at = excluded.updated_at`,
    ["overview:v1", JSON.stringify(snapshot), snapshot.dataVersion, snapshot.updatedAt]
  );
}

export async function bumpDataVersion(database: Database): Promise<number> {
  const nextVersion = (await readDataVersion(database)) + 1;
  await database.execute(
    `INSERT INTO app_meta (key, value)
     VALUES ('data_version', $1)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [String(nextVersion)]
  );
  dashboardMemoryCache = null;
  return nextVersion;
}

export function getDataVersion(): Promise<number> {
  return withDbLock(async () => {
    const database = await getDb();
    return readDataVersion(database);
  });
}

export function markDataChanged(): Promise<number> {
  return withDbLock(async () => {
    const database = await getDb();
    return bumpDataVersion(database);
  });
}

export function getCachedDashboardSnapshot(): Promise<DashboardSnapshot | null> {
  return withDbLock(async () => {
    const database = await getDb();
    const currentVersion = await readDataVersion(database);

    if (dashboardMemoryCache && dashboardMemoryCache.dataVersion === currentVersion) {
      return dashboardMemoryCache;
    }

    const rows = await database.select<{ payload: string; data_version: number }[]>(
      "SELECT payload, data_version FROM dashboard_cache WHERE cache_key = 'overview:v1' LIMIT 1"
    );
    const cached = rows[0];
    if (!cached || cached.data_version !== currentVersion) {
      return null;
    }

    try {
      const parsed = JSON.parse(cached.payload) as DashboardSnapshot;
      dashboardMemoryCache = parsed;
      return parsed;
    } catch {
      return null;
    }
  });
}

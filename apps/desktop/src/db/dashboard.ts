import Database from "@tauri-apps/plugin-sql";
import { getDb, withDbLock } from "./connection";
import type {
  ActivityHeatmapPoint,
  ConversationRow,
  DashboardSnapshot,
  DbStats,
  SourceStats,
} from "./types";

let dashboardMemoryCache: DashboardSnapshot | null = null;

async function readDataVersion(database: Database): Promise<number> {
  const rows = await database.select<{ value: string }[]>(
    "SELECT value FROM app_meta WHERE key = 'data_version' LIMIT 1"
  );
  const parsed = Number(rows[0]?.value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

async function writeDashboardCache(database: Database, snapshot: DashboardSnapshot): Promise<void> {
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

async function bumpDataVersion(database: Database): Promise<number> {
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

async function buildDashboardSnapshot(
  database: Database,
  dataVersion: number
): Promise<DashboardSnapshot> {
  const convRows = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) AS count FROM conversations"
  );
  const msgRows = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) AS count FROM messages"
  );
  const latestRows = await database.select<{ latest: number | null }[]>(
    "SELECT MAX(created_at) AS latest FROM messages"
  );
  const indexedRows = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) AS count FROM messages_fts"
  );
  const tokenRows = await database.select<{ inputTokens: number; outputTokens: number }[]>(
    `SELECT
       COALESCE(SUM(
         CASE WHEN sender = 'human' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END
       ), 0) AS inputTokens,
       COALESCE(SUM(
         CASE WHEN sender = 'assistant' THEN CAST((LENGTH(content) + 3) / 4 AS INTEGER) ELSE 0 END
       ), 0) AS outputTokens
     FROM messages`
  );

  const sourceStats = await database.select<SourceStats[]>(
    `SELECT
       c.source AS source,
       COUNT(DISTINCT c.id) AS conversationCount,
       COUNT(m.id) AS messageCount,
       MAX(m.created_at) AS lastActivityTimestamp
     FROM conversations c
     LEFT JOIN messages m ON m.conversation_id = c.id
     GROUP BY c.source
     ORDER BY c.source`
  );

  const recentConversations = await database.select<ConversationRow[]>(
    `SELECT
       c.id,
       c.source,
       COALESCE(c.title, 'Untitled') AS title,
       COALESCE(c.created_at, 0) AS created_at,
       COALESCE(m.last_msg_time, c.created_at, 0) AS last_message_at,
       COALESCE(c.message_count, 0) AS message_count
     FROM conversations c
     LEFT JOIN (
       SELECT conversation_id, MAX(created_at) AS last_msg_time
       FROM messages
       GROUP BY conversation_id
     ) m ON m.conversation_id = c.id
     ORDER BY last_message_at DESC
     LIMIT 12`
  );

  const activityTimeline = await database.select<ActivityHeatmapPoint[]>(
    `SELECT
       date(m.created_at / 1000, 'unixepoch', 'localtime') AS day,
       COUNT(*) AS totalCount,
       SUM(CASE WHEN LOWER(c.source) = 'chatgpt' THEN 1 ELSE 0 END) AS chatgptCount,
       SUM(CASE WHEN LOWER(c.source) = 'claude' THEN 1 ELSE 0 END) AS claudeCount,
       SUM(CASE WHEN LOWER(c.source) = 'gemini' THEN 1 ELSE 0 END) AS geminiCount,
       SUM(CASE WHEN LOWER(c.source) = 'grok' THEN 1 ELSE 0 END) AS grokCount,
       SUM(CASE WHEN LOWER(c.source) NOT IN ('chatgpt', 'claude', 'gemini', 'grok') THEN 1 ELSE 0 END) AS otherCount
     FROM messages m
     JOIN conversations c ON c.id = m.conversation_id
     WHERE m.created_at IS NOT NULL
     GROUP BY day
     ORDER BY day`
  );

  const inputTokens = tokenRows[0]?.inputTokens ?? 0;
  const outputTokens = tokenRows[0]?.outputTokens ?? 0;
  const stats: DbStats = {
    conversationCount: convRows[0]?.count ?? 0,
    messageCount: msgRows[0]?.count ?? 0,
    indexedMessageCount: indexedRows[0]?.count ?? 0,
    latestMessageTimestamp: latestRows[0]?.latest ?? null,
    estimatedInputTokens: inputTokens,
    estimatedOutputTokens: outputTokens,
    estimatedTotalTokens: inputTokens + outputTokens,
  };

  return {
    stats,
    sourceStats,
    recentConversations,
    activityTimeline,
    dataVersion,
    updatedAt: Date.now(),
  };
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

export function getDashboardSnapshot(): Promise<DashboardSnapshot> {
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
    if (cached && cached.data_version === currentVersion) {
      try {
        const parsed = JSON.parse(cached.payload) as DashboardSnapshot;
        dashboardMemoryCache = parsed;
        return parsed;
      } catch {
        // fall through
      }
    }

    const snapshot = await buildDashboardSnapshot(database, currentVersion);
    await writeDashboardCache(database, snapshot);
    dashboardMemoryCache = snapshot;
    return snapshot;
  });
}

// Expose helpers for other modules (rebuild needs bump)
export { bumpDataVersion, readDataVersion, buildDashboardSnapshot };

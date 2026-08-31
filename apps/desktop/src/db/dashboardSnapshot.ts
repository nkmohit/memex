import type Database from "@tauri-apps/plugin-sql";
import type {
  ActivityHeatmapPoint,
  ConversationRow,
  DashboardSnapshot,
  DbStats,
  SourceStats,
} from "./types";

export async function buildDashboardSnapshot(
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

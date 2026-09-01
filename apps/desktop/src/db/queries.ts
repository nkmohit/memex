import { getDb, withDbLock } from "./connection";
import { bumpDataVersion } from "./dashboard";
import type {
  ActivityDayPoint,
  ActivityHeatmapPoint,
  ConversationListRow,
  ConversationRow,
  DbStats,
  MessageRow,
  SourceStats,
} from "./types";
import { clampLimit, clampOffset, sanitizeSource } from "../lib/validation";

export function getStats(): Promise<DbStats> {
  return withDbLock(async () => {
    const database = await getDb();

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
    const inputTokens = tokenRows[0]?.inputTokens ?? 0;
    const outputTokens = tokenRows[0]?.outputTokens ?? 0;

    return {
      conversationCount: convRows[0]?.count ?? 0,
      messageCount: msgRows[0]?.count ?? 0,
      indexedMessageCount: indexedRows[0]?.count ?? 0,
      latestMessageTimestamp: latestRows[0]?.latest ?? null,
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedTotalTokens: inputTokens + outputTokens,
    };
  });
}

export function rebuildSearchIndex(): Promise<void> {
  return withDbLock(async () => {
    const database = await getDb();
    await database.execute("DELETE FROM messages_fts");
    await database.execute(`
      INSERT INTO messages_fts (content, title, conversation_id, message_id)
      SELECT m.content, COALESCE(c.title, ''), m.conversation_id, m.id
      FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
    `);
    await bumpDataVersion(database);
  });
}

export function getActivityCountByDay(days: number): Promise<number[]> {
  return withDbLock(async () => {
    const database = await getDb();
    const safeDays = Math.max(1, Math.min(365, Math.floor(days)));
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const startOfOldestDay = new Date(now - (safeDays - 1) * oneDayMs);
    startOfOldestDay.setHours(0, 0, 0, 0);
    const startMs = startOfOldestDay.getTime();

    const rows = await database.select<{ day: string; cnt: number }[]>(
      `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt
       FROM messages
       WHERE created_at >= $1 AND created_at IS NOT NULL
       GROUP BY day
       ORDER BY day`,
      [startMs]
    );

    const countByDay = new Map<string, number>();
    for (const r of rows) {
      countByDay.set(r.day, r.cnt);
    }

    const result: number[] = [];
    for (let i = 0; i < safeDays; i++) {
      const t = now - (safeDays - 1 - i) * oneDayMs;
      const dayStr = new Date(t).toISOString().slice(0, 10);
      result.push(countByDay.get(dayStr) ?? 0);
    }
    return result;
  });
}

export function getActivityTimeline(): Promise<ActivityDayPoint[]> {
  return withDbLock(async () => {
    const database = await getDb();
    const rows = await database.select<{ day: string; cnt: number }[]>(
      `SELECT date(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt
       FROM messages
       WHERE created_at IS NOT NULL
       GROUP BY day
       ORDER BY day`
    );
    return rows.map((r) => ({ day: r.day, count: r.cnt }));
  });
}

export function getActivityHeatmapTimeline(): Promise<ActivityHeatmapPoint[]> {
  return withDbLock(async () => {
    const database = await getDb();
    const rows = await database.select<ActivityHeatmapPoint[]>(
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
    return rows;
  });
}

export function getSourceStats(): Promise<SourceStats[]> {
  return withDbLock(async () => {
    const database = await getDb();
    return database.select<SourceStats[]>(
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
  });
}

export function getConversations(limit = 50, source?: string): Promise<ConversationRow[]> {
  return withDbLock(async () => {
    const database = await getDb();
    const safeLimit = clampLimit(limit, 50, 500);
    const validatedSource = sanitizeSource(source);

    if (validatedSource) {
      return database.select<ConversationRow[]>(
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
         WHERE c.source = $1
         ORDER BY last_message_at DESC
         LIMIT ${safeLimit}`,
        [validatedSource]
      );
    }

    return database.select<ConversationRow[]>(
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
       LIMIT ${safeLimit}`
    );
  });
}

export function getAllConversationsForSearch(
  opts: {
    source?: string;
    dateFrom?: number;
    dateTo?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ rows: ConversationListRow[]; totalMatches: number }> {
  return withDbLock(async () => {
    const database = await getDb();

    const safeLimit = clampLimit(opts.limit, 50, 100);
    const safeOffset = clampOffset(opts.offset);

    let whereClause = "1=1";
    const params: unknown[] = [];
    let paramIndex = 1;

    const validatedSource = sanitizeSource(opts.source);
    if (validatedSource) {
      whereClause += ` AND c.source = $${paramIndex}`;
      params.push(validatedSource);
      paramIndex += 1;
    }

    if (typeof opts.dateFrom === "number") {
      whereClause += ` AND COALESCE(last_msg_time, 0) >= $${paramIndex}`;
      params.push(opts.dateFrom);
      paramIndex += 1;
    }

    if (typeof opts.dateTo === "number") {
      whereClause += ` AND COALESCE(last_msg_time, 0) <= $${paramIndex}`;
      params.push(opts.dateTo);
    }

    const countSql = `SELECT COUNT(*) AS total
      FROM conversations c
      LEFT JOIN (
        SELECT conversation_id, MAX(created_at) AS last_msg_time
        FROM messages
        GROUP BY conversation_id
      ) m ON m.conversation_id = c.id
      WHERE ${whereClause}`;

    const rowsSql = `SELECT
        c.id AS conversation_id,
        COALESCE(c.title, 'Untitled') AS title,
        c.source AS source,
        COALESCE(c.created_at, 0) AS created_at,
        COALESCE(m.last_msg_time, c.created_at, 0) AS last_message_at,
        COALESCE(c.message_count, 0) AS message_count
      FROM conversations c
      LEFT JOIN (
        SELECT conversation_id, MAX(created_at) AS last_msg_time
        FROM messages
        GROUP BY conversation_id
      ) m ON m.conversation_id = c.id
      WHERE ${whereClause}
      ORDER BY last_message_at DESC
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}`;

    const countRows = await database.select<{ total: number }[]>(countSql, params);
    const rows = await database.select<ConversationListRow[]>(rowsSql, params);

    return {
      rows,
      totalMatches: countRows[0]?.total ?? 0,
    };
  });
}

export function getMessages(conversationId: string): Promise<MessageRow[]> {
  return withDbLock(async () => {
    const database = await getDb();

    // Input validation: conversationId must be non-empty alphanumeric/slug
    if (!conversationId || typeof conversationId !== "string" || conversationId.length > 200) {
      return [];
    }

    return database.select<MessageRow[]>(
      `SELECT
         id,
         sender,
         content,
         COALESCE(created_at, 0) AS created_at
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId]
    );
  });
}

const MAX_CLEAR_RETRIES = 6;
const CLEAR_RETRY_DELAY_MS = 500;

function isBusyOrLocked(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("database is locked") || msg.includes("SQLITE_BUSY") || msg.includes("code: 5")
  );
}

export function clearAllData(): Promise<void> {
  return withDbLock(async () => {
    const database = await getDb();
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_CLEAR_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, CLEAR_RETRY_DELAY_MS * attempt));
      }
      try {
        await database.execute("PRAGMA busy_timeout = 30000");
        try {
          await database.execute("ROLLBACK");
        } catch {
          // ignore
        }

        await database.execute("BEGIN IMMEDIATE");
        await database.execute("DELETE FROM messages_fts");
        await database.execute("DELETE FROM messages");
        await database.execute("DELETE FROM conversations");
        await bumpDataVersion(database);
        await database.execute("COMMIT");
        return;
      } catch (err) {
        lastErr = err;
        try {
          await database.execute("ROLLBACK");
        } catch {
          // ignore
        }
        if (!isBusyOrLocked(err) || attempt === MAX_CLEAR_RETRIES - 1) throw err;
      }
    }
    throw lastErr;
  });
}

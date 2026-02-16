import Database from "@tauri-apps/plugin-sql";

// ---------------------------------------------------------------------------
// Single connection + init gate
// ---------------------------------------------------------------------------

let db: Database | null = null;

/**
 * Low-level accessor — only call this from inside `withDbLock` or from
 * `initDatabase` (which itself runs inside the lock).
 */
async function rawGetDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:memex.db");
  }
  return db;
}

// ---------------------------------------------------------------------------
// DB mutex — serialises ALL database operations (reads AND writes) so that
// nothing runs concurrently.  The Tauri SQL plugin uses a connection pool
// on the Rust side, and SQLite doesn't allow concurrent writes.  Routing
// every call through one promise chain guarantees no two IPC calls overlap.
// ---------------------------------------------------------------------------

let dbLock: Promise<void> = Promise.resolve();

/**
 * Enqueue a database operation.  Only one runs at a time; callers
 * automatically wait for every preceding operation to finish (or fail)
 * before starting.
 */
export function withDbLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = dbLock.then(fn, fn); // run fn regardless of previous outcome
  // Keep the chain going – swallow rejections so a failure in one operation
  // doesn't permanently break the queue.
  dbLock = next.then(
    () => {},
    () => {}
  );
  return next;
}

// Convenience alias kept for clarity at call-sites that do writes.
export const withWriteLock = withDbLock;

// ---------------------------------------------------------------------------
// Database initialisation — runs exactly once, inside the lock, before any
// other operation can proceed.  Exported so main.tsx can `await` it.
// ---------------------------------------------------------------------------

let initPromise: Promise<void> | null = null;

/**
 * Initialise the database: set PRAGMAs, run migrations, create tables.
 * Safe to call multiple times — only the first call does real work.
 * Every `withDbLock` call implicitly waits for this to finish because
 * it is the first thing enqueued on the lock chain.
 */
export function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = withDbLock(async () => {
    const database = await rawGetDb();

    // PRAGMAs — long busy_timeout so writes wait instead of failing with "database is locked"
    await database.execute("PRAGMA journal_mode = WAL");
    await database.execute("PRAGMA busy_timeout = 30000");

    // Migrate: drop old tables that lack the new columns.
    const cols = await database.select<{ name: string }[]>(
      "PRAGMA table_info(conversations)"
    );
    const colNames = cols.map((c: { name: string }) => c.name);

    if (colNames.length > 0 && !colNames.includes("updated_at")) {
      console.log("Migrating: dropping old tables to recreate with new schema");
      await database.execute("DROP TABLE IF EXISTS messages_fts");
      await database.execute("DROP TABLE IF EXISTS messages");
      await database.execute("DROP TABLE IF EXISTS conversations");
    }

    await database.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT,
        created_at INTEGER,
        updated_at INTEGER,
        message_count INTEGER DEFAULT 0
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      );
    `);

    const ftsInfo = await database.select<{ name: string }[]>(
      "PRAGMA table_info(messages_fts)"
    );
    const ftsColNames = ftsInfo.map((c) => c.name);
    if (ftsColNames.length > 0 && !ftsColNames.includes("title")) {
      console.log("Migrating FTS index to include title column");
      await database.execute("DROP TABLE IF EXISTS messages_fts");
    }

    await database.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
      USING fts5(
        content,
        title,
        conversation_id UNINDEXED,
        message_id UNINDEXED
      );
    `);

    // Back-fill FTS if needed
    const msgCountRows = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM messages"
    );
    const ftsCountRows = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM messages_fts"
    );
    const msgCount = msgCountRows[0]?.count ?? 0;
    const ftsCount = ftsCountRows[0]?.count ?? 0;

    if (msgCount > 0 && ftsCount === 0) {
      console.log("Backfilling FTS index from existing messages");
      await database.execute(`
        INSERT INTO messages_fts (content, title, conversation_id, message_id)
        SELECT m.content, COALESCE(c.title, ''), m.conversation_id, m.id
        FROM messages m
        JOIN conversations c ON c.id = m.conversation_id
      `);
    }

    const convCount = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) as count FROM conversations"
    );
    console.log("Conversations in DB:", convCount[0]?.count ?? 0);
  });

  return initPromise;
}

/**
 * Get the database instance.  Always goes through the lock so it is safe
 * to call from anywhere.  Implicitly waits for `initDatabase` to finish
 * (because init is the first item in the lock queue).
 */
export async function getDb(): Promise<Database> {
  return rawGetDb();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DbStats {
  conversationCount: number;
  messageCount: number;
  indexedMessageCount: number;
  latestMessageTimestamp: number | null;
}

export interface SourceStats {
  source: string;
  conversationCount: number;
  messageCount: number;
  /** Latest message timestamp for this source (for "last sync" display). */
  lastActivityTimestamp: number | null;
}

export interface ConversationRow {
  id: string;
  source: string;
  title: string;
  created_at: number;
  last_message_at: number;
  message_count: number;
}

export interface MessageRow {
  id: string;
  sender: "human" | "assistant";
  content: string;
  created_at: number;
}

export interface SearchResultRow {
  conversation_id: string;
  title: string;
  source: string;
  snippet: string;
  snippets: string[];
  created_at: number;
  last_occurrence: number;
  occurrence_count: number;
  message_match_count: number;
  rank: number;
  first_match_message_id: string | null;
}

export interface SearchMessagesResult {
  rows: SearchResultRow[];
  totalMatches: number;
  totalOccurrences: number;
}

export interface SearchOptions {
  source?: string;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
  sort?:
    | "relevance"
    | "last_occurrence_desc"
    | "occurrence_count_desc"
    | "title_az"
    | "title_za";
}

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export function normalizeQuery(rawQuery: string): string {
  const tokens = rawQuery.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return tokens.map((term) => `${term.replace(/\*+$/g, "")}*`).join(" ");
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

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

    return {
      conversationCount: convRows[0]?.count ?? 0,
      messageCount: msgRows[0]?.count ?? 0,
      indexedMessageCount: indexedRows[0]?.count ?? 0,
      latestMessageTimestamp: latestRows[0]?.latest ?? null,
    };
  });
}

/**
 * Returns message counts per day for the last N days.
 * result[0] = oldest day (N days ago), result[days-1] = most recent day.
 * Uses calendar days in local time; created_at is stored as Unix ms.
 */
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

export function getConversations(
  limit = 50,
  source?: string
): Promise<ConversationRow[]> {
  return withDbLock(async () => {
    const database = await getDb();
    const safeLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(500, Math.floor(limit)))
      : 50;

    if (source) {
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
        [source]
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

export interface ConversationListRow {
  conversation_id: string;
  title: string;
  source: string;
  created_at: number;
  last_message_at: number;
  message_count: number;
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

    const safeLimit = Number.isFinite(opts.limit)
      ? Math.max(1, Math.min(100, Math.floor(opts.limit as number)))
      : 50;
    const safeOffset = Number.isFinite(opts.offset)
      ? Math.max(0, Math.floor(opts.offset as number))
      : 0;

    let whereClause = "1=1";
    const params: unknown[] = [];
    let paramIndex = 1;

    if (opts.source) {
      whereClause += ` AND c.source = $${paramIndex}`;
      params.push(opts.source);
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
      paramIndex += 1;
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

    const [countRows, rows] = await Promise.all([
      database.select<{ total: number }[]>(countSql, params),
      database.select<ConversationListRow[]>(rowsSql, params),
    ]);

    return {
      rows,
      totalMatches: countRows[0]?.total ?? 0,
    };
  });
}

export function getMessages(
  conversationId: string
): Promise<MessageRow[]> {
  return withDbLock(async () => {
    const database = await getDb();

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

export function searchMessages(
  query: string,
  opts: SearchOptions = {}
): Promise<SearchMessagesResult> {
  const rawQuery = query.trim();
  if (!rawQuery) {
    return Promise.resolve({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  }
  const normalizedQuery = normalizeQuery(rawQuery);
  if (!normalizedQuery) {
    return Promise.resolve({ rows: [], totalMatches: 0, totalOccurrences: 0 });
  }

  return withDbLock(async () => {
    const database = await getDb();

    const safeLimit = Number.isFinite(opts.limit)
      ? Math.max(1, Math.min(100, Math.floor(opts.limit as number)))
      : 20;
    const safeOffset = Number.isFinite(opts.offset)
      ? Math.max(0, Math.floor(opts.offset as number))
      : 0;
    const sort = opts.sort ?? "last_occurrence_desc";
    const titleLikeParam = `%${escapeLikePattern(rawQuery.toLowerCase())}%`;

    let whereClause = "messages_fts MATCH $1";
    const rawQueryLower = rawQuery.toLowerCase();
    const params: unknown[] = [normalizedQuery, titleLikeParam, rawQueryLower];
    let paramIndex = 4;

    if (opts.source) {
      whereClause += ` AND c.source = $${paramIndex}`;
      params.push(opts.source);
      paramIndex += 1;
    }

    if (typeof opts.dateFrom === "number") {
      whereClause += ` AND COALESCE(m.created_at, 0) >= $${paramIndex}`;
      params.push(opts.dateFrom);
      paramIndex += 1;
    }

    if (typeof opts.dateTo === "number") {
      whereClause += ` AND COALESCE(m.created_at, 0) <= $${paramIndex}`;
      params.push(opts.dateTo);
      paramIndex += 1;
    }

    const countSql = `SELECT COUNT(DISTINCT messages_fts.conversation_id) AS total
      FROM messages_fts
      JOIN conversations c ON c.id = messages_fts.conversation_id
      JOIN messages m ON m.id = messages_fts.message_id
      WHERE ${whereClause}`;

    const totalOccurrencesSql = `SELECT COALESCE(CAST(SUM(
        (LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0)
      ) AS INTEGER), 0) AS total
      FROM messages_fts
      JOIN conversations c ON c.id = messages_fts.conversation_id
      JOIN messages m ON m.id = messages_fts.message_id
      WHERE ${whereClause}`;

    let orderBy = "last_occurrence DESC, rank ASC";
    if (sort === "relevance") {
      orderBy = "rank ASC, last_occurrence DESC";
    } else if (sort === "occurrence_count_desc") {
      orderBy = "occurrence_count DESC, rank ASC";
    } else if (sort === "title_az") {
      orderBy = "title COLLATE NOCASE ASC, rank ASC";
    } else if (sort === "title_za") {
      orderBy = "title COLLATE NOCASE DESC, rank ASC";
    }

    const rowsSql = `WITH ranked_rows AS (
        SELECT
          c.id AS conversation_id,
          COALESCE(c.title, 'Untitled') AS title,
          c.source AS source,
          COALESCE(c.created_at, 0) AS created_at,
          COALESCE(m.created_at, 0) AS message_created_at,
          m.id AS message_id,
          (LENGTH(LOWER(m.content)) - LENGTH(REPLACE(LOWER(m.content), $3, ''))) / NULLIF(LENGTH($3), 0) AS occurrence_in_message,
          CASE
            WHEN LOWER(COALESCE(c.title, '')) LIKE $2 ESCAPE '\\' THEN -5.0
            ELSE 0.0
          END AS title_boost
        FROM messages_fts
        JOIN conversations c ON c.id = messages_fts.conversation_id
        JOIN messages m ON m.id = messages_fts.message_id
        WHERE ${whereClause}
      ),
      grouped AS (
        SELECT
          conversation_id,
          title,
          source,
          created_at,
          MAX(message_created_at) AS last_occurrence,
          CAST(SUM(occurrence_in_message) AS INTEGER) AS occurrence_count,
          COUNT(DISTINCT message_id) AS message_match_count,
          (-1.0 * SUM(occurrence_in_message)) + MIN(title_boost) AS rank,
          (SELECT message_id FROM ranked_rows r2
           WHERE r2.conversation_id = ranked_rows.conversation_id
           ORDER BY r2.message_created_at ASC
           LIMIT 1) AS first_match_message_id
        FROM ranked_rows
        GROUP BY conversation_id, title, source, created_at
      )
      SELECT
        conversation_id,
        title,
        source,
        created_at,
        COALESCE(last_occurrence, 0) AS last_occurrence,
        occurrence_count,
        message_match_count,
        rank,
        first_match_message_id
      FROM grouped
      ORDER BY ${orderBy}
      LIMIT ${safeLimit}
      OFFSET ${safeOffset}`;

    const [countRows, totalOccurrencesRows, rawRows] = await Promise.all([
      database.select<{ total: number }[]>(countSql, params),
      database.select<{ total: number }[]>(totalOccurrencesSql, params),
      database.select<Omit<SearchResultRow, "snippet" | "snippets">[]>(rowsSql, params),
    ]);
    const rows: SearchResultRow[] = [];

    for (const row of rawRows) {
      let snippetWhereClause =
        "messages_fts MATCH $1 AND messages_fts.conversation_id = $2";
      const snippetParams: unknown[] = [normalizedQuery, row.conversation_id];
      let snippetParamIndex = 3;

      if (typeof opts.dateFrom === "number") {
        snippetWhereClause += ` AND COALESCE(m.created_at, 0) >= $${snippetParamIndex}`;
        snippetParams.push(opts.dateFrom);
        snippetParamIndex += 1;
      }
      if (typeof opts.dateTo === "number") {
        snippetWhereClause += ` AND COALESCE(m.created_at, 0) <= $${snippetParamIndex}`;
        snippetParams.push(opts.dateTo);
      }

      const snippetRows = await database.select<{ snippet: string }[]>(
        `SELECT snippet(messages_fts, 0, '<mark>', '</mark>', '...', 10) AS snippet
         FROM messages_fts
         JOIN messages m ON m.id = messages_fts.message_id
         WHERE ${snippetWhereClause}
         ORDER BY COALESCE(m.created_at, 0) DESC
         LIMIT 3`,
        snippetParams
      );

      const snippets = snippetRows
        .map((snippetRow) => snippetRow.snippet.trim())
        .filter(Boolean);

      rows.push({
        conversation_id: row.conversation_id,
        title: row.title,
        source: row.source,
        snippet: snippets[0] ?? "",
        snippets,
        created_at: row.created_at,
        last_occurrence: row.last_occurrence,
        occurrence_count: row.occurrence_count,
        message_match_count: row.message_match_count,
        rank: row.rank,
        first_match_message_id: row.first_match_message_id,
      });
    }

    return {
      rows,
      totalMatches: countRows[0]?.total ?? 0,
      totalOccurrences: totalOccurrencesRows[0]?.total ?? 0,
    };
  });
}

const MAX_CLEAR_RETRIES = 6;
const CLEAR_RETRY_DELAY_MS = 500;

function isBusyOrLocked(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("database is locked") || msg.includes("SQLITE_BUSY") || msg.includes("code: 5");
}

export function clearAllData(): Promise<void> {
  return withDbLock(async () => {
    const database = await getDb();
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_CLEAR_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, CLEAR_RETRY_DELAY_MS * attempt));
      }
      let began = false;
      try {
        // Ensure this connection waits for locks (plugin may use a pool; pragma is per-connection)
        await database.execute("PRAGMA busy_timeout = 30000");

        // Defensive cleanup: if a previous attempt failed after BEGIN but before
        // we could reliably observe the state, SQLite may still consider a
        // transaction active on this connection.
        try {
          await database.execute("ROLLBACK");
        } catch {
          // ignore
        }

        await database.execute("BEGIN IMMEDIATE");
        began = true;
        await database.execute("DELETE FROM messages_fts");
        await database.execute("DELETE FROM messages");
        await database.execute("DELETE FROM conversations");
        await database.execute("COMMIT");
        return;
      } catch (err) {
        lastErr = err;
        // Always attempt rollback. If no transaction is active, ignore.
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

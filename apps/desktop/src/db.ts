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

    // PRAGMAs
    await database.execute("PRAGMA journal_mode = WAL");
    await database.execute("PRAGMA busy_timeout = 5000");

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

    await database.execute(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
      USING fts5(
        content,
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
        INSERT INTO messages_fts (content, conversation_id, message_id)
        SELECT content, conversation_id, id FROM messages
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
}

export interface ConversationRow {
  id: string;
  source: string;
  title: string;
  created_at: number;
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
  created_at: number;
  rank: number;
}

export interface SearchOptions {
  source?: string;
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
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

export function getSourceStats(): Promise<SourceStats[]> {
  return withDbLock(async () => {
    const database = await getDb();

    return database.select<SourceStats[]>(
      `SELECT
         c.source AS source,
         COUNT(DISTINCT c.id) AS conversationCount,
         COUNT(m.id) AS messageCount
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
           id,
           source,
           COALESCE(title, 'Untitled') AS title,
           COALESCE(created_at, 0) AS created_at,
           COALESCE(message_count, 0) AS message_count
         FROM conversations
         WHERE source = $1
         ORDER BY created_at DESC
         LIMIT ${safeLimit}`,
        [source]
      );
    }

    return database.select<ConversationRow[]>(
      `SELECT
         id,
         source,
         COALESCE(title, 'Untitled') AS title,
         COALESCE(created_at, 0) AS created_at,
         COALESCE(message_count, 0) AS message_count
       FROM conversations
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`
    );
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
): Promise<SearchResultRow[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return Promise.resolve([]);

  return withDbLock(async () => {
    const database = await getDb();

    const safeLimit = Number.isFinite(opts.limit)
      ? Math.max(1, Math.min(100, Math.floor(opts.limit as number)))
      : 20;

    let sql = `SELECT
        c.id AS conversation_id,
        COALESCE(c.title, 'Untitled') AS title,
        c.source AS source,
        snippet(messages_fts, 0, '<mark>', '</mark>', '...', 10) AS snippet,
        COALESCE(c.created_at, 0) AS created_at,
        bm25(messages_fts) AS rank
      FROM messages_fts
      JOIN conversations c ON c.id = messages_fts.conversation_id
      WHERE messages_fts MATCH $1`;
    const params: unknown[] = [normalizedQuery];
    let paramIndex = 2;

    if (opts.source) {
      sql += ` AND c.source = $${paramIndex}`;
      params.push(opts.source);
      paramIndex += 1;
    }

    if (typeof opts.dateFrom === "number") {
      sql += ` AND COALESCE(c.created_at, 0) >= $${paramIndex}`;
      params.push(opts.dateFrom);
      paramIndex += 1;
    }

    if (typeof opts.dateTo === "number") {
      sql += ` AND COALESCE(c.created_at, 0) <= $${paramIndex}`;
      params.push(opts.dateTo);
      paramIndex += 1;
    }

    sql += ` ORDER BY bm25(messages_fts) LIMIT ${safeLimit}`;

    return database.select<SearchResultRow[]>(sql, params);
  });
}

export function clearAllData(): Promise<void> {
  return withDbLock(async () => {
    const database = await getDb();

    // Use BEGIN IMMEDIATE to grab a write lock up-front, avoiding
    // SQLITE_BUSY races that SAVEPOINTs are susceptible to when the
    // Tauri SQL plugin processes requests on a connection pool.
    await database.execute("BEGIN IMMEDIATE");
    try {
      await database.execute("DELETE FROM messages_fts");
      await database.execute("DELETE FROM messages");
      await database.execute("DELETE FROM conversations");
      await database.execute("COMMIT");
    } catch (err) {
      try {
        await database.execute("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback of clear-all failed:", rollbackErr);
      }
      throw err;
    }
  });
}

import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb() {
  if (!db) {
    db = await Database.load("sqlite:memex.db");
  }
  return db;
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

export async function getStats(): Promise<DbStats> {
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
}

export async function getSourceStats(): Promise<SourceStats[]> {
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
}

export async function getConversations(
  limit = 50,
  source?: string
): Promise<ConversationRow[]> {
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
}

export async function getMessages(
  conversationId: string
): Promise<MessageRow[]> {
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
}

export async function searchMessages(
  query: string,
  opts: SearchOptions = {}
): Promise<SearchResultRow[]> {
  const database = await getDb();
  const normalizedQuery = query.trim();

  if (!normalizedQuery) return [];

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
}

export async function clearAllData(): Promise<void> {
  const database = await getDb();
  await database.execute("BEGIN");

  try {
    await database.execute("DELETE FROM messages_fts");
    await database.execute("DELETE FROM messages");
    await database.execute("DELETE FROM conversations");
    await database.execute("COMMIT");
  } catch (err) {
    await database.execute("ROLLBACK");
    throw err;
  }
}

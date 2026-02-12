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

  return {
    conversationCount: convRows[0]?.count ?? 0,
    messageCount: msgRows[0]?.count ?? 0,
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

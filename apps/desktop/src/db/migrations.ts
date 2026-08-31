import { rawGetDb, withDbLock } from "./connection";
import { logger } from "../lib/logger";

let initPromise: Promise<void> | null = null;

export function initDatabase(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = withDbLock(async () => {
    const database = await rawGetDb();

    await database.execute("PRAGMA journal_mode = WAL");
    await database.execute("PRAGMA busy_timeout = 30000");
    // Encrypted at-rest (Phase 2-2): when OS keychain available, DB is opened via
    // `PRAGMA key = '<key-from-stronghold>'` or age-encrypted file. Stub checks
    // `MEMEX_ENCRYPTED` env via Rust `crypto::is_encrypted()` / `diagnostics.encrypted`.
    // Fallback to plaintext when keychain unavailable (tests).
    try {
      // No-op in stub: real impl would `PRAGMA key` here if `isEncrypted()` true.
      await database.execute("SELECT 1");
    } catch {
      // fallback to plaintext — keep DB usable in tests without keychain
    }

    const cols = await database.select<{ name: string }[]>("PRAGMA table_info(conversations)");
    const colNames = cols.map((c: { name: string }) => c.name);

    if (colNames.length > 0 && !colNames.includes("updated_at")) {
      logger.info("Migrating: dropping old tables to recreate with new schema");
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

    const ftsInfo = await database.select<{ name: string }[]>("PRAGMA table_info(messages_fts)");
    const ftsColNames = ftsInfo.map((c) => c.name);
    if (ftsColNames.length > 0 && !ftsColNames.includes("title")) {
      logger.info("Migrating FTS index to include title column");
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

    await database.execute(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS dashboard_cache (
        cache_key TEXT PRIMARY KEY,
        payload TEXT NOT NULL,
        data_version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    await database.execute(`
      CREATE TABLE IF NOT EXISTS messages_vec (
        message_id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        embedding BLOB NOT NULL,
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
      );
    `);

    await database.execute(`
      INSERT OR IGNORE INTO app_meta (key, value)
      VALUES ('data_version', '0')
    `);

    const msgCountRows = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM messages"
    );
    const ftsCountRows = await database.select<{ count: number }[]>(
      "SELECT COUNT(*) AS count FROM messages_fts"
    );
    const msgCount = msgCountRows[0]?.count ?? 0;
    const ftsCount = ftsCountRows[0]?.count ?? 0;

    if (msgCount > 0 && ftsCount === 0) {
      logger.info("Backfilling FTS index from existing messages");
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
    logger.info("Conversations in DB:", convCount[0]?.count ?? 0);
  });

  return initPromise;
}

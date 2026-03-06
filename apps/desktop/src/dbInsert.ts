import type { ParsedConversation } from "@memex/core";
import { getDb, withDbLock } from "./db";

const MAX_IMPORT_RETRIES = 6;
const IMPORT_RETRY_DELAY_MS = 500;
const DEFAULT_IMPORT_CHUNK_SIZE = 150;

function isDbLockedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("database is locked") || msg.includes("SQLITE_BUSY") || msg.includes("code: 5");
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("Import cancelled");
  }
}

function buildPlaceholders(rows: number, cols: number, startIndex = 1): string {
  return Array.from({ length: rows }, (_, rowIndex) => {
    const rowStart = startIndex + rowIndex * cols;
    const rowParams = Array.from({ length: cols }, (_, colIndex) => `$${rowStart + colIndex}`);
    return `(${rowParams.join(", ")})`;
  }).join(", ");
}

function buildParamList(count: number, startIndex = 1): string {
  return Array.from({ length: count }, (_, idx) => `$${startIndex + idx}`).join(", ");
}

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

interface InsertConversationsOptions {
  signal?: AbortSignal;
  chunkSize?: number;
  onProgress?: (progress: {
    phase: "write";
    conversationsDone: number;
    conversationsTotal: number;
    messagesDone: number;
    messagesTotal: number;
  }) => void;
}

async function runImportChunkTransaction(
  db: Awaited<ReturnType<typeof getDb>>,
  conversations: ParsedConversation[]
): Promise<{ conversationCount: number; messageCount: number }> {
  let totalMessages = 0;
  let began = false;

  // Ensure this connection waits for locks (plugin may use a pool; pragma is per-connection)
  await db.execute("PRAGMA busy_timeout = 30000");
  await db.execute("BEGIN IMMEDIATE");
  began = true;

  try {
    const convValues: unknown[] = [];
    for (const conv of conversations) {
      convValues.push(
        conv.id,
        conv.source,
        conv.title,
        conv.createdAt,
        conv.updatedAt,
        conv.messageCount
      );
    }
    if (conversations.length > 0) {
      const convSql = `INSERT OR REPLACE INTO conversations (id, source, title, created_at, updated_at, message_count)
        VALUES ${buildPlaceholders(conversations.length, 6)}`;
      await db.execute(convSql, convValues);
    }

    const conversationIds = conversations.map((conv) => conv.id);
    if (conversationIds.length > 0) {
      const deletePlaceholders = buildParamList(conversationIds.length);
      await db.execute(
        `DELETE FROM messages_fts WHERE conversation_id IN (${deletePlaceholders})`,
        conversationIds
      );
    }

    const messageRows: unknown[] = [];
    const ftsRows: unknown[] = [];
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        messageRows.push(msg.id, msg.conversationId, msg.sender, msg.content, msg.createdAt);
        ftsRows.push(msg.content, conv.title ?? "", msg.conversationId, msg.id);
        totalMessages += 1;
      }
    }

    if (messageRows.length > 0) {
      const messageCount = messageRows.length / 5;
      const msgSql = `INSERT OR REPLACE INTO messages (id, conversation_id, sender, content, created_at)
        VALUES ${buildPlaceholders(messageCount, 5)}`;
      await db.execute(msgSql, messageRows);
    }

    if (ftsRows.length > 0) {
      const ftsCount = ftsRows.length / 4;
      const ftsSql = `INSERT INTO messages_fts (content, title, conversation_id, message_id)
        VALUES ${buildPlaceholders(ftsCount, 4)}`;
      await db.execute(ftsSql, ftsRows);
    }

    await db.execute("COMMIT");
    return {
      conversationCount: conversations.length,
      messageCount: totalMessages,
    };
  } catch (err) {
    if (began) {
      try {
        await db.execute("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback of import failed:", rollbackErr);
      }
    }
    throw err;
  }
}

/**
 * Insert parsed conversations and their messages into SQLite.
 * Uses BEGIN IMMEDIATE for a proper exclusive write transaction.
 * Serialised via the shared DB lock so imports never overlap with
 * clear-all, reads, or other imports. Retries on database is locked (code 5).
 */
export function insertConversations(
  conversations: ParsedConversation[],
  opts: InsertConversationsOptions = {}
): Promise<{ conversationCount: number; messageCount: number }> {
  return withDbLock(async () => {
    const db = await getDb();
    let lastErr: unknown;
    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
    const chunkSize = Math.max(1, Math.floor(opts.chunkSize ?? DEFAULT_IMPORT_CHUNK_SIZE));

    const chunks = chunkArray(conversations, chunkSize);

    for (let attempt = 0; attempt < MAX_IMPORT_RETRIES; attempt++) {
      let conversationsDone = 0;
      let messagesDone = 0;
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, IMPORT_RETRY_DELAY_MS * attempt));
      }
      try {
        assertNotAborted(opts.signal);
        for (const chunk of chunks) {
          const result = await runImportChunkTransaction(db, chunk);
          conversationsDone += result.conversationCount;
          messagesDone += result.messageCount;
          opts.onProgress?.({
            phase: "write",
            conversationsDone,
            conversationsTotal: totalConversations,
            messagesDone,
            messagesTotal: totalMessages,
          });
          if (conversationsDone < totalConversations) {
            assertNotAborted(opts.signal);
          }
        }
        return {
          conversationCount: conversationsDone,
          messageCount: messagesDone,
        };
      } catch (err) {
        lastErr = err;
        if (!isDbLockedError(err) || attempt === MAX_IMPORT_RETRIES - 1) {
          throw err;
        }
      }
    }

    throw lastErr;
  });
}

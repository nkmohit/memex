import type { ParsedConversation } from "@memex/core";
import { getDb, withDbLock } from "./db";

const MAX_IMPORT_RETRIES = 6;
const IMPORT_RETRY_DELAY_MS = 500;

function isDbLockedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("database is locked") || msg.includes("SQLITE_BUSY") || msg.includes("code: 5");
}

async function runImportTransaction(
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
    for (const conv of conversations) {
      await db.execute(
        `INSERT OR REPLACE INTO conversations (id, source, title, created_at, updated_at, message_count)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          conv.id,
          conv.source,
          conv.title,
          conv.createdAt,
          conv.updatedAt,
          conv.messageCount,
        ]
      );

      // Re-import can replace an existing conversation. Clear stale FTS rows
      // so the index mirrors the current message set for this conversation.
      await db.execute(
        `DELETE FROM messages_fts WHERE conversation_id = $1`,
        [conv.id]
      );

      for (const msg of conv.messages) {
        await db.execute(
          `INSERT OR REPLACE INTO messages (id, conversation_id, sender, content, created_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            msg.id,
            msg.conversationId,
            msg.sender,
            msg.content,
            msg.createdAt,
          ]
        );
        await db.execute(
          `INSERT INTO messages_fts (content, title, conversation_id, message_id)
           VALUES ($1, $2, $3, $4)`,
          [msg.content, conv.title ?? "", msg.conversationId, msg.id]
        );
        totalMessages++;
      }
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
  conversations: ParsedConversation[]
): Promise<{ conversationCount: number; messageCount: number }> {
  return withDbLock(async () => {
    const db = await getDb();
    let lastErr: unknown;

    for (let attempt = 0; attempt < MAX_IMPORT_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, IMPORT_RETRY_DELAY_MS * attempt));
      }
      try {
        return await runImportTransaction(db, conversations);
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

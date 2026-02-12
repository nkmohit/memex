import type { ParsedConversation } from "@memex/core";
import { getDb, withDbLock } from "./db";

/**
 * Insert parsed conversations and their messages into SQLite.
 * Uses BEGIN IMMEDIATE for a proper exclusive write transaction.
 * Serialised via the shared DB lock so imports never overlap with
 * clear-all, reads, or other imports.
 */
export function insertConversations(
  conversations: ParsedConversation[]
): Promise<{ conversationCount: number; messageCount: number }> {
  return withDbLock(async () => {
    const db = await getDb();

    let totalMessages = 0;

    await db.execute("BEGIN IMMEDIATE");

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
            `INSERT INTO messages_fts (content, conversation_id, message_id)
             VALUES ($1, $2, $3)`,
            [msg.content, msg.conversationId, msg.id]
          );
          totalMessages++;
        }
      }

      await db.execute("COMMIT");
    } catch (err) {
      try {
        await db.execute("ROLLBACK");
      } catch (rollbackErr) {
        console.error("Rollback of import failed:", rollbackErr);
      }
      throw err;
    }

    return {
      conversationCount: conversations.length,
      messageCount: totalMessages,
    };
  });
}

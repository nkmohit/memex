import type { ParsedConversation } from "@memex/core";
import { getDb } from "./db";

/**
 * Insert parsed conversations and their messages into SQLite.
 * Wraps everything in a single transaction for atomicity.
 * Returns the total number of conversations inserted.
 */
export async function insertConversations(
  conversations: ParsedConversation[]
): Promise<{ conversationCount: number; messageCount: number }> {
  const db = await getDb();

  let totalMessages = 0;

  await db.execute("BEGIN");

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
      await db.execute(`DELETE FROM messages_fts WHERE conversation_id = $1`, [
        conv.id,
      ]);

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
    await db.execute("ROLLBACK");
    throw err;
  }

  return {
    conversationCount: conversations.length,
    messageCount: totalMessages,
  };
}

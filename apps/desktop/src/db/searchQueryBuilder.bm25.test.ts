// @vitest-environment node
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { buildRankedRowsSql } from "./searchQueryBuilder";

/**
 * Small FTS5 fixture. Lower bm25() is a better match.
 * Title weight 5 puts a title hit ahead of a long body that merely repeats the term.
 */
describe("FTS5 bm25 ranking", () => {
  it("orders a title hit ahead of a repetitive body and a long weak mention", () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        title TEXT,
        created_at INTEGER
      );
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER
      );
      CREATE VIRTUAL TABLE messages_fts USING fts5(
        content,
        title,
        conversation_id UNINDEXED,
        message_id UNINDEXED
      );
    `);

    const insertConversation = db.prepare(
      "INSERT INTO conversations (id, source, title, created_at) VALUES (?, ?, ?, ?)"
    );
    const insertMessage = db.prepare(
      "INSERT INTO messages (id, conversation_id, content, created_at) VALUES (?, ?, ?, ?)"
    );
    const insertFts = db.prepare(
      "INSERT INTO messages_fts (content, title, conversation_id, message_id) VALUES (?, ?, ?, ?)"
    );

    const rows: Array<[string, string, string, string]> = [
      [
        "c-body",
        "diary",
        "salary salary salary salary talks about salary repeatedly in a long message about work",
        "m-body",
      ],
      [
        "c-title",
        "salary review",
        "we discussed the weekend plans and grocery list only",
        "m-title",
      ],
      ["c-both", "salary", "notes on the salary discussion", "m-both"],
      [
        "c-weak",
        "misc",
        "one salary mention buried in a very long essay about gardening soil compost watering schedules and unrelated plants trees shrubs flowers vegetables fruit orchards seasons climate",
        "m-weak",
      ],
      ["c-noise", "plants", "gardening tips for the weekend", "m-noise"],
    ];

    for (const [id, title, content, messageId] of rows) {
      insertConversation.run(id, "claude", title, 1);
      insertMessage.run(messageId, id, content, 10);
      insertFts.run(content, title, id, messageId);
    }

    const sql = buildRankedRowsSql("messages_fts MATCH $1", "rank ASC", 10, 0);
    const ranked = db.prepare(sql).all({
      1: "salary",
      3: "salary",
    }) as Array<{ conversation_id: string; rank: number }>;

    expect(ranked.map((row) => row.conversation_id)).toEqual([
      "c-both",
      "c-title",
      "c-body",
      "c-weak",
    ]);
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1]!.rank).toBeLessThan(ranked[i]!.rank);
    }
    expect(ranked.every((row) => row.rank < 0)).toBe(true);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory fake DB that mimics @tauri-apps/plugin-sql for integration
class FakeDB {
  conversations: any[] = [];
  messages: any[] = [];
  messages_fts: any[] = [];
  app_meta = new Map<string, string>([["data_version", "0"]]);
  dashboard_cache = new Map<string, any>();

  async execute(sql: string, params: unknown[] = []) {
    const s = sql.trim().toLowerCase();
    if (s.includes("pragma")) return;
    if (s.includes("create table") || s.includes("create virtual table")) return;
    if (s.includes("insert or ignore into app_meta")) {
      if (!this.app_meta.has("data_version")) this.app_meta.set("data_version", "0");
      return;
    }
    if (s.includes("insert into app_meta") && s.includes("data_version")) {
      const v = String(params[0] ?? "0");
      this.app_meta.set("data_version", v);
      return;
    }
    if (s.includes("insert into dashboard_cache")) {
      const [key, payload, version, updated] = params as any[];
      this.dashboard_cache.set(key, { payload, data_version: version, updated_at: updated });
      return;
    }
    if (s.includes("delete from messages_fts")) {
      const inMatch = sql.match(/where conversation_id in \(([^)]+)\)/i);
      if (inMatch) {
        const ids = params as string[];
        this.messages_fts = this.messages_fts.filter((r) => !ids.includes(r.conversation_id));
      } else {
        this.messages_fts = [];
      }
      return;
    }
    if (s.includes("delete from messages") && !s.includes("messages_fts")) {
      // clear all for test
      if (s.includes("delete from messages") && !s.includes("where")) this.messages = [];
      return;
    }
    if (s.includes("delete from conversations")) {
      this.conversations = [];
      return;
    }
    if (s.includes("insert or replace into conversations")) {
      // params are flattened: 6 per row
      for (let i = 0; i < params.length; i += 6) {
        const [id, source, title, created_at, updated_at, message_count] = params.slice(i, i + 6) as any[];
        const idx = this.conversations.findIndex((c) => c.id === id);
        const row = { id, source, title, created_at, updated_at, message_count };
        if (idx >= 0) this.conversations[idx] = row;
        else this.conversations.push(row);
      }
      return;
    }
    if (s.includes("insert or replace into messages_vec")) {
      // vector embeddings — ignored in fake DB (no-op, but don't treat as messages)
      return;
    }
    if (s.includes("insert or replace into messages")) {
      for (let i = 0; i < params.length; i += 5) {
        const [id, conversation_id, sender, content, created_at] = params.slice(i, i + 5) as any[];
        const idx = this.messages.findIndex((m) => m.id === id);
        const row = { id, conversation_id, sender, content, created_at };
        if (idx >= 0) this.messages[idx] = row;
        else this.messages.push(row);
      }
      return;
    }
    if (s.includes("insert into messages_fts")) {
        // Handle rebuild case: INSERT INTO ... SELECT ...
      if (s.includes("select") && s.includes("from messages")) {
        // Repopulate from messages and conversations
        this.messages_fts = [];
        for (const m of this.messages) {
          const conv = this.conversations.find((c) => c.id === m.conversation_id);
          this.messages_fts.push({
            content: m.content,
            title: conv?.title ?? "",
            conversation_id: m.conversation_id,
            message_id: m.id,
          });
        }
        return;
      }
      for (let i = 0; i < params.length; i += 4) {
        const [content, title, conversation_id, message_id] = params.slice(i, i + 4) as any[];
        this.messages_fts.push({ content, title, conversation_id, message_id });
      }
      return;
    }
    if (s.startsWith("begin") || s.startsWith("commit") || s.startsWith("rollback")) return;
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T> {
    const s = sql.trim().toLowerCase();
    // pragma table_info
    if (s.includes("pragma table_info")) {
      if (s.includes("conversations")) return [{ name: "updated_at" } as any] as any;
      if (s.includes("messages_fts")) return [{ name: "title" } as any] as any;
      return [] as any;
    }
    if (s.includes("select count(*) as count from conversations")) {
      return [{ count: this.conversations.length } as any] as any;
    }
    if (s.includes("select count(*) as count from messages") && !s.includes("messages_fts")) {
      return [{ count: this.messages.length } as any] as any;
    }
    if (s.includes("select count(*) as count from messages_fts")) {
      return [{ count: this.messages_fts.length } as any] as any;
    }
    if (s.includes("select count(*) as count from messages")) {
      return [{ count: this.messages.length } as any] as any;
    }
    if (s.includes("select max(created_at) as latest from messages")) {
      const max = this.messages.reduce((m, r) => Math.max(m, r.created_at ?? 0), 0);
      return [{ latest: max || null } as any] as any;
    }
    if (s.includes("select max(created_at) as latest")) {
      const max = this.messages.reduce((m, r) => Math.max(m, r.created_at ?? 0), 0);
      return [{ latest: max || null } as any] as any;
    }
    if (s.includes("select value from app_meta where key = 'data_version'")) {
      return [{ value: this.app_meta.get("data_version") ?? "0" } as any] as any;
    }
    if (s.includes("from dashboard_cache where cache_key = 'overview:v1'")) {
      const row = this.dashboard_cache.get("overview:v1");
      if (!row) return [] as any;
      return [{ payload: row.payload, data_version: row.data_version } as any] as any;
    }
    if (s.includes("select") && s.includes("from conversations c") && s.includes("group by c.source")) {
      // sourceStats
      const map = new Map<string, any>();
      for (const c of this.conversations) {
        if (!map.has(c.source)) map.set(c.source, { source: c.source, conversationCount: 0, messageCount: 0, lastActivityTimestamp: null });
        map.get(c.source).conversationCount += 1;
      }
      for (const m of this.messages) {
        const conv = this.conversations.find((c) => c.id === m.conversation_id);
        if (!conv) continue;
        const entry = map.get(conv.source);
        if (entry) {
          entry.messageCount += 1;
          entry.lastActivityTimestamp = Math.max(entry.lastActivityTimestamp ?? 0, m.created_at ?? 0);
        }
      }
      return Array.from(map.values()) as any;
    }
    if (s.includes("select") && s.includes("from conversations c") && s.includes("order by last_message_at desc")) {
      // getConversations or getAllConversationsForSearch
      // Check if it's count query
      if (s.includes("select count(*) as total")) {
        return [{ total: this.conversations.length } as any] as any;
      }
      // otherwise return conversations with last_message_at
      return this.conversations
        .map((c) => {
          const msgs = this.messages.filter((m) => m.conversation_id === c.id);
          const last = msgs.reduce((m, r) => Math.max(m, r.created_at ?? 0), c.created_at ?? 0);
          return {
            id: c.id,
            conversation_id: c.id,
            source: c.source,
            title: c.title ?? "Untitled",
            created_at: c.created_at ?? 0,
            last_message_at: last,
            message_count: c.message_count ?? msgs.length,
          };
        })
        .slice(0, 20) as any;
    }
    if (s.includes("select") && s.includes("from messages") && s.includes("where conversation_id = $1")) {
      const convId = params[0] as string;
      return this.messages.filter((m) => m.conversation_id === convId).map((m) => ({ ...m, created_at: m.created_at ?? 0 })) as any;
    }
    if (s.includes("select count(distinct messages_fts.conversation_id) as total")) {
      // search count - simple: count distinct conversations where content includes query term
      const q = String(params[0] ?? "").replace(/\*/g, "").toLowerCase();
      const matched = new Set<string>();
      for (const r of this.messages_fts) {
        if (r.content.toLowerCase().includes(q)) matched.add(r.conversation_id);
      }
      return [{ total: matched.size } as any] as any;
    }
    if (s.includes("select coalesce(cast(sum(") && s.includes("as total")) {
      // totalOccurrences - count occurrences of raw query lower
      const raw = String(params[2] ?? "").toLowerCase();
      let total = 0;
      for (const r of this.messages_fts) {
        const content = r.content.toLowerCase();
        if (!raw) continue;
        let idx = 0;
        while ((idx = content.indexOf(raw, idx)) !== -1) {
          total += 1;
          idx += raw.length;
        }
      }
      return [{ total } as any] as any;
    }
    if (s.includes("with ranked_rows as")) {
      // searchMessages main query - simplified to return one row per conversation that matches
      const q = String(params[0] ?? "").replace(/\*/g, "").toLowerCase();
      const map = new Map<string, any>();
      for (const r of this.messages_fts) {
        if (!r.content.toLowerCase().includes(q)) continue;
        const conv = this.conversations.find((c) => c.id === r.conversation_id);
        if (!conv) continue;
        if (!map.has(r.conversation_id)) {
          map.set(r.conversation_id, {
            conversation_id: r.conversation_id,
            title: conv.title ?? "Untitled",
            source: conv.source,
            created_at: conv.created_at ?? 0,
            last_occurrence: 0,
            occurrence_count: 0,
            message_match_count: 0,
            rank: 0,
            first_match_message_id: r.message_id,
          });
        }
        const entry = map.get(r.conversation_id);
        entry.occurrence_count += 1;
        entry.message_match_count += 1;
      }
      return Array.from(map.values()) as any;
    }
    if (s.includes("select snippet(messages_fts")) {
      const q = String(params[0] ?? "").replace(/\*/g, "");
      const convId = params[1] as string;
      const rows = this.messages_fts
        .filter((r) => r.conversation_id === convId && r.content.toLowerCase().includes(q.toLowerCase().replace(/\*/g, "")))
        .slice(0, 3)
        .map((r) => ({ snippet: r.content.slice(0, 50) + (r.content.includes(q) ? `<mark>${q}</mark>` : "") }));
      return rows as any;
    }
    if (s.includes("select") && s.includes("sum(") && s.includes("as inputtokens")) {
      let input = 0, output = 0;
      for (const m of this.messages) {
        const tokens = Math.ceil((m.content?.length ?? 0) / 4);
        if (m.sender === "human") input += tokens;
        else output += tokens;
      }
      return [{ inputTokens: input, outputTokens: output } as any] as any;
    }
    if (s.includes("select m.id as message_id") && s.includes("from messages m")) {
      // semantic search — return all messages joined with conversations
      return this.messages.map((m) => {
        const conv = this.conversations.find((c) => c.id === m.conversation_id);
        return {
          message_id: m.id,
          conversation_id: m.conversation_id,
          content: m.content,
          message_created_at: m.created_at ?? 0,
          title: conv?.title ?? "Untitled",
          source: conv?.source ?? "claude",
          conv_created_at: conv?.created_at ?? 0,
        };
      }) as any;
    }
    if (s.includes("select") && s.includes("date(m.created_at")) {
      // activityTimeline - return empty for simplicity
      return [] as any;
    }
    // default
    return [] as any;
  }
}

const fakeDb = new FakeDB();

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn(async () => fakeDb),
  },
}));

describe("db integration — import to search", () => {
  beforeEach(() => {
    fakeDb.conversations = [];
    fakeDb.messages = [];
    fakeDb.messages_fts = [];
    fakeDb.app_meta.set("data_version", "0");
    fakeDb.dashboard_cache.clear();
  });

  it("imports a small Claude fixture and finds it via FTS search", async () => {
    const { initDatabase } = await import("./db/migrations");
    const { parseClaudeConversations } = await import("@memex/core");
    const { insertConversations } = await import("./dbInsert");
    const { searchMessages, getStats, rebuildSearchIndex, getConversations } = await import("./db");

    await initDatabase();

    const fixture = [
      {
        uuid: "conv-int-1",
        name: "Integration Test",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
        chat_messages: [
          { uuid: "m1", sender: "human", created_at: "2026-01-01T00:00:00Z", text: "hello from integration" },
          { uuid: "m2", sender: "assistant", created_at: "2026-01-01T00:01:00Z", text: "world reply with keyword salary" },
        ],
      },
    ];

    const parsed = parseClaudeConversations(fixture as any);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].messages).toHaveLength(2);

    const inserted = await insertConversations(parsed);
    expect(inserted.conversationCount).toBe(1);
    expect(inserted.messageCount).toBe(2);

    const stats = await getStats();
    expect(stats.conversationCount).toBe(1);
    expect(stats.messageCount).toBe(2);

    const convs = await getConversations(10);
    expect(convs).toHaveLength(1);
    expect(convs[0].title).toBe("Integration Test");

    await rebuildSearchIndex();

    const result = await searchMessages("salary", { limit: 10 });
    expect(result.totalMatches).toBeGreaterThanOrEqual(1);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows[0].conversation_id).toBe("conv-int-1");
    expect(result.totalOccurrences).toBeGreaterThanOrEqual(1);
  });

  it("handles empty query and no results gracefully", async () => {
    const { searchMessages } = await import("./db");
    const empty = await searchMessages("   ");
    expect(empty.rows).toHaveLength(0);
    const noMatch = await searchMessages("nonexistentkeywordxyz");
    expect(noMatch.totalMatches).toBe(0);
  });

  it("semantic search finds paraphrase via vector (vacation ~ holiday)", async () => {
    const { parseClaudeConversations } = await import("@memex/core");
    const { insertConversations } = await import("./dbInsert");
    const { searchMessages } = await import("./db");

    const fixture = [
      {
        uuid: "conv-vec-1",
        name: "Travel Chat",
        created_at: "2026-02-01T00:00:00Z",
        updated_at: "2026-02-01T01:00:00Z",
        chat_messages: [
          { uuid: "m10", sender: "human", created_at: "2026-02-01T00:00:00Z", text: "We went on a holiday trip last summer and loved it" },
        ],
      },
      {
        uuid: "conv-vec-2",
        name: "Other Chat",
        created_at: "2026-02-02T00:00:00Z",
        updated_at: "2026-02-02T01:00:00Z",
        chat_messages: [
          { uuid: "m11", sender: "human", created_at: "2026-02-02T00:00:00Z", text: "quantum physics discussion" },
        ],
      },
    ];

    const parsed = parseClaudeConversations(fixture as any);
    await insertConversations(parsed);

    // FTS alone should NOT find "vacation" when content is "holiday trip"
    const fts = await searchMessages("vacation", { mode: "fts" });
    expect(fts.totalMatches).toBe(0);

    // Semantic should find it via synonym-aware embedding
    const sem = await searchMessages("vacation", { mode: "semantic" });
    expect(sem.totalMatches).toBe(1);
    expect(sem.rows[0].conversation_id).toBe("conv-vec-1");

    // Hybrid should also find it (union of FTS + semantic)
    const hybrid = await searchMessages("vacation", { mode: "hybrid" });
    expect(hybrid.totalMatches).toBeGreaterThanOrEqual(1);
    expect(hybrid.rows.some((r) => r.conversation_id === "conv-vec-1")).toBe(true);
  });
});

// Notion plugin example — copy to ~/.memex/plugins/notion.js
registerImporter(
  { id: "notion", label: "Notion", available: true },
  function parseNotion(rawJson) {
    if (!Array.isArray(rawJson)) return [];
    return rawJson.map((row) => ({
      id: String(row.id),
      source: "notion",
      title: row.title || "Untitled",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: (row.blocks || []).length,
      messages: (row.blocks || []).map((b) => ({
        id: String(b.id),
        conversationId: String(row.id),
        sender: b.type === "user" ? "human" : "assistant",
        content: String(b.text || ""),
        createdAt: Date.now(),
      })),
    }));
  }
);

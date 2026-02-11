import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { getDb } from "./db";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

async function initDb() {
  const db = await getDb();

  // Migrate: drop old tables that lack the new columns.
  // Safe to do in early dev — no real data to preserve yet.
  const cols = await db.select<{ name: string }[]>(
    "PRAGMA table_info(conversations)"
  );
  const colNames = cols.map((c) => c.name);

  if (colNames.length > 0 && !colNames.includes("updated_at")) {
    console.log("Migrating: dropping old tables to recreate with new schema");
    await db.execute("DROP TABLE IF EXISTS messages");
    await db.execute("DROP TABLE IF EXISTS conversations");
  }

  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT,
      created_at INTEGER,
      updated_at INTEGER,
      message_count INTEGER DEFAULT 0
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );
  `);

  const convCount = await db.select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM conversations"
  );
  console.log("Conversations in DB:", convCount[0]?.count ?? 0);
}

initDb();

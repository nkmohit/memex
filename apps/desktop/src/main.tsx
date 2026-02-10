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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      title TEXT,
      created_at INTEGER
    );
  `);


  const rows = await db.select(`SELECT * FROM conversations`);
  console.log("DB rows:", rows);

  await db.execute(`DELETE FROM conversations`);

}

initDb();

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initDatabase } from "./db";

// Kick off DB initialisation (PRAGMAs, migrations, table creation).
// This runs inside the DB lock, so every subsequent withDbLock call
// in the App will automatically queue behind it — no race possible.
initDatabase().catch((err) => console.error("DB init failed:", err));

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

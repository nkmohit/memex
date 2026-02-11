import { useState } from "react";
import { importClaudeConversations, ImportResult } from "./importer";
import "./App.css";

function App() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const importResult = await importClaudeConversations();

      if (importResult) {
        setResult(importResult);
      }
    } catch (err) {
      console.error("Import failed:", err);
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <main className="container">
      <h1>Memex</h1>
      <p className="subtitle">Your personal knowledge base</p>

      <div className="import-section">
        <button
          className="import-button"
          onClick={handleImport}
          disabled={importing}
        >
          {importing ? "Importing..." : "Import Claude Conversations"}
        </button>

        {result && (
          <div className="result success">
            Imported {result.conversationCount} conversations with{" "}
            {result.messageCount} messages.
          </div>
        )}

        {error && <div className="result error">{error}</div>}
      </div>
    </main>
  );
}

export default App;

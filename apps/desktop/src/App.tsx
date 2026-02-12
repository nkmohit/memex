import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationRow,
  DbStats,
  MessageRow,
  SourceStats,
  getConversations,
  getMessages,
  getSourceStats,
  getStats,
} from "./db";
import {
  IMPORT_SOURCES,
  ImportSource,
  importConversations,
} from "./importer";
import { formatDate, formatTimestamp } from "./utils";
import "./App.css";

function App() {
  // ---- data state ----
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DbStats | null>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats[]>([]);
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  // ---- source filter ----
  const [activeSource, setActiveSource] = useState<string | null>(null);

  // ---- import state ----
  const [importing, setImporting] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const importMenuRef = useRef<HTMLDivElement>(null);

  // ---- derived ----
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) ?? null,
    [conversations, selectedConvId]
  );

  // ---- close import menu on outside click ----
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        importMenuRef.current &&
        !importMenuRef.current.contains(e.target as Node)
      ) {
        setImportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ---- data loading ----
  const loadData = useCallback(
    async (source?: string | null) => {
      setLoading(true);
      setLoadError(null);
      try {
        const [statsData, srcStats, convData] = await Promise.all([
          getStats(),
          getSourceStats(),
          getConversations(200, source ?? undefined),
        ]);
        setStats(statsData);
        setSourceStats(srcStats);
        setConversations(convData);

        if (selectedConvId) {
          const stillExists = convData.some((c) => c.id === selectedConvId);
          if (!stillExists) {
            setSelectedConvId(null);
            setMessages([]);
          }
        }
      } catch (err) {
        console.error("Failed to load data:", err);
        setLoadError(
          err instanceof Error ? err.message : "Failed to load data"
        );
      } finally {
        setLoading(false);
      }
    },
    [selectedConvId]
  );

  useEffect(() => {
    void loadData(activeSource);
  }, [activeSource]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- conversation click ----
  async function handleConversationClick(convId: string) {
    setSelectedConvId(convId);
    setMessagesLoading(true);
    try {
      const data = await getMessages(convId);
      setMessages(data);
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }

  // ---- import ----
  async function handleImportSource(source: ImportSource) {
    setImportMenuOpen(false);
    setImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const result = await importConversations(source);
      if (result) {
        setImportResult(
          `Imported ${result.conversationCount} conversations and ${result.messageCount} messages from ${source}.`
        );
        await loadData(activeSource);
      }
    } catch (err) {
      console.error("Import failed:", err);
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  // ---- source helpers ----
  const availableSources = useMemo(() => {
    const dbSources = sourceStats.map((s) => s.source);
    const all = new Set([
      ...dbSources,
      ...IMPORT_SOURCES.filter((s) => s.available).map((s) => s.id),
    ]);
    return Array.from(all);
  }, [sourceStats]);

  function sourceLabel(source: string): string {
    const meta = IMPORT_SOURCES.find((s) => s.id === source);
    return meta?.label ?? source.charAt(0).toUpperCase() + source.slice(1);
  }

  function sourceConvCount(source: string): number {
    return sourceStats.find((s) => s.source === source)?.conversationCount ?? 0;
  }

  // ---- render ----
  return (
    <div className="app-shell">
      {/* ---- LEFT NAV ---- */}
      <nav className="nav-rail">
        <div className="nav-brand">
          <span className="brand-mark">M</span>
          <span className="brand-text">Memex</span>
        </div>

        {/* Source tabs */}
        <div className="nav-sources">
          <button
            className={`nav-source-btn ${activeSource === null ? "active" : ""}`}
            onClick={() => setActiveSource(null)}
          >
            <span>All</span>
            {stats && <span className="nav-badge">{stats.conversationCount}</span>}
          </button>

          {availableSources.map((src) => (
            <button
              key={src}
              className={`nav-source-btn ${activeSource === src ? "active" : ""}`}
              onClick={() => setActiveSource(src)}
            >
              <span>{sourceLabel(src)}</span>
              <span className="nav-badge">{sourceConvCount(src)}</span>
            </button>
          ))}
        </div>

        {/* Import button */}
        <div className="nav-bottom">
          <div className="import-wrapper" ref={importMenuRef}>
            <button
              className="import-trigger"
              onClick={() => setImportMenuOpen((v) => !v)}
              disabled={importing}
            >
              {importing ? "Importing..." : "+ Import"}
            </button>

            {importMenuOpen && (
              <div className="import-menu">
                {IMPORT_SOURCES.map((src) => (
                  <button
                    key={src.id}
                    className="import-menu-item"
                    disabled={!src.available}
                    onClick={() => void handleImportSource(src.id)}
                  >
                    <span>{src.label}</span>
                    {!src.available && (
                      <span className="coming-soon">Coming soon</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ---- CONVERSATION LIST ---- */}
      <aside className="conv-panel">
        <div className="conv-panel-header">
          <h2>{activeSource ? sourceLabel(activeSource) : "All Conversations"}</h2>
          <span className="conv-count">{conversations.length}</span>
        </div>

        {loading ? (
          <div className="empty-text">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="empty-text">
            No conversations yet. Import to get started.
          </div>
        ) : (
          <div className="conv-list">
            {conversations.map((c) => (
              <button
                key={c.id}
                className={`conv-item ${selectedConvId === c.id ? "selected" : ""}`}
                onClick={() => void handleConversationClick(c.id)}
              >
                <span className="conv-title">{c.title || "Untitled"}</span>
                <span className="conv-meta">
                  <span className="source-tag">{sourceLabel(c.source)}</span>
                  <span>{c.message_count} msgs</span>
                  <span>{formatDate(c.created_at)}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* ---- MESSAGE VIEWER ---- */}
      <main className="viewer">
        {/* banner messages */}
        {(importResult || importError || loadError) && (
          <div className="banner-area">
            {importResult && <div className="banner success">{importResult}</div>}
            {importError && <div className="banner error">{importError}</div>}
            {loadError && <div className="banner error">{loadError}</div>}
          </div>
        )}

        {!selectedConversation ? (
          <div className="viewer-empty">
            <p className="viewer-empty-text">
              {stats && stats.conversationCount > 0
                ? "Select a conversation to view messages."
                : "Import conversations to get started."}
            </p>
            {stats && stats.conversationCount > 0 && (
              <p className="viewer-empty-stats">
                {stats.conversationCount} conversations
                {" \u00B7 "}
                {stats.messageCount} messages
                {" \u00B7 "}
                Last: {formatTimestamp(stats.latestMessageTimestamp)}
              </p>
            )}
          </div>
        ) : messagesLoading ? (
          <div className="viewer-empty">
            <p className="viewer-empty-text">Loading messages...</p>
          </div>
        ) : (
          <>
            <div className="viewer-header">
              <div>
                <h2>{selectedConversation.title || "Untitled"}</h2>
                <p className="viewer-header-meta">
                  <span className="source-tag">
                    {sourceLabel(selectedConversation.source)}
                  </span>
                  <span>{messages.length} messages</span>
                  <span>{formatDate(selectedConversation.created_at)}</span>
                </p>
              </div>
            </div>
            <div className="msg-list">
              {messages.map((m) => (
                <article
                  key={m.id}
                  className={`msg ${m.sender === "human" ? "human" : "assistant"}`}
                >
                  <div className="msg-top">
                    <span className="sender-pill">
                      {m.sender === "human" ? "You" : "Assistant"}
                    </span>
                    <time>{formatTimestamp(m.created_at)}</time>
                  </div>
                  <div className="msg-body">{m.content}</div>
                </article>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;

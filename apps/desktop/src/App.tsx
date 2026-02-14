import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ConversationRow,
  DbStats,
  MessageRow,
  SourceStats,
  clearAllData,
  getConversations,
  getMessages,
  getSourceStats,
  getStats,
} from "./db";
import { IMPORT_SOURCES, ImportSource, importConversations } from "./importer";
import SearchPage, { type SearchPageSnapshot } from "./SearchPage";
import { formatDate, formatTimestamp } from "./utils";
import "./App.css";

type ActiveView = "conversations" | "search";

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
  const [activeView, setActiveView] = useState<ActiveView>("conversations");
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchMatchIndex, setMessageSearchMatchIndex] = useState(0);
  const viewerSearchInputRef = useRef<HTMLInputElement>(null);

  // ---- search state ----
  const [searchPageQuery, setSearchPageQuery] = useState("");
  const [searchPageSnapshot, setSearchPageSnapshot] = useState<SearchPageSnapshot>({
    source: "",
    dateFrom: "",
    dateTo: "",
    sort: "last_occurrence_desc",
    results: [],
    totalMatches: 0,
    latencyMs: null,
  });
  const [searchFocusRequestId, setSearchFocusRequestId] = useState<number | null>(
    null
  );

  // ---- import state ----
  const [importing, setImporting] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const importMenuRef = useRef<HTMLDivElement>(null);
  const convItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});

  // ---- highlight state ----
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // ---- derived ----
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) ?? null,
    [conversations, selectedConvId]
  );

  const filteredMessages = useMemo(() => {
    if (!messageSearchQuery.trim()) return messages;
    
    const queryLower = messageSearchQuery.toLowerCase();
    return messages.filter((m) =>
      m.content.toLowerCase().includes(queryLower)
    );
  }, [messages, messageSearchQuery]);

  // Helper to highlight search query in text
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i}>{part}</mark> 
        : part
    );
  };

  const matchCount = filteredMessages.length;
  const currentMatchIndex = Math.min(messageSearchMatchIndex, Math.max(0, matchCount - 1));

  const goToPrevMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setMessageSearchMatchIndex((i) => (i <= 0 ? matchCount - 1 : i - 1));
  }, [matchCount]);

  const goToNextMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setMessageSearchMatchIndex((i) => (i >= matchCount - 1 ? 0 : i + 1));
  }, [matchCount]);

  // When query or filtered list changes, reset to first match
  useEffect(() => {
    setMessageSearchMatchIndex(0);
    if (!messageSearchQuery.trim()) setHighlightedMessageId(null);
  }, [messageSearchQuery, matchCount]);

  // Scroll to and highlight the message at current match index
  useEffect(() => {
    if (!messageSearchQuery.trim() || matchCount === 0) return;
    const msg = filteredMessages[currentMatchIndex];
    if (!msg) return;
    setHighlightedMessageId(msg.id);
    const el = messageRefs.current[msg.id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [messageSearchQuery, currentMatchIndex, matchCount, filteredMessages]);

  // Keyboard: Up/Down navigate between matches when searching in conversation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!messageSearchQuery.trim() || matchCount <= 0) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      const inViewer = (e.target as Node)?.parentElement?.closest(".viewer");
      if (!inViewer) return;
      e.preventDefault();
      if (e.key === "ArrowUp") goToPrevMatch();
      else goToNextMatch();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [messageSearchQuery, matchCount, goToPrevMatch, goToNextMatch]);

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
        // Run queries sequentially to avoid concurrent DB access that can
        // trigger "database is locked" in SQLite.
        const statsData = await getStats();
        const srcStats = await getSourceStats();
        const convData = await getConversations(200, source ?? undefined);

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
  const handleConversationClick = useCallback(async (convId: string, scrollToMessageId?: string | null) => {
    setSelectedConvId(convId);
    setMessagesLoading(true);
    setHighlightedMessageId(null);
    try {
      const data = await getMessages(convId);
      setMessages(data);
      
      // Scroll to and highlight the target message after a brief delay
      if (scrollToMessageId) {
        setTimeout(() => {
          const messageEl = messageRefs.current[scrollToMessageId];
          if (messageEl) {
            messageEl.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedMessageId(scrollToMessageId);
            
            // Remove highlight after 2 seconds
            setTimeout(() => {
              setHighlightedMessageId(null);
            }, 2000);
          }
        }, 100);
      }
    } catch (err) {
      console.error("Failed to load messages:", err);
      setMessages([]);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView !== "conversations" || !selectedConvId) return;
    convItemRefs.current[selectedConvId]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeView, selectedConvId]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setActiveView("search");
        setSearchFocusRequestId(Date.now());
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ---- import ----
  async function handleImportSource(source: ImportSource) {
    if (clearingData) return;

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

  function handleClearAllDataClick() {
    if (importing || clearingData || loading) return;
    setImportMenuOpen(false);
    setClearConfirmOpen(true);
  }

  async function handleClearAllDataConfirm() {
    if (importing || clearingData) return;

    setClearConfirmOpen(false);
    setClearingData(true);
    setImportError(null);
    setImportResult(null);

    try {
      // Actually delete data from DB first — only reset UI state after success.
      await clearAllData();

      setSearchPageQuery("");
      setSearchPageSnapshot({
        source: "",
        dateFrom: "",
        dateTo: "",
        sort: "last_occurrence_desc",
        results: [],
        totalMatches: 0,
        latencyMs: null,
      });
      setSelectedConvId(null);
      setMessages([]);
      setImportResult("All imported data was removed.");
      await loadData(activeSource);
    } catch (err) {
      console.error("Clear data failed:", err);
      setImportError(err instanceof Error ? err.message : "Clear data failed");
    } finally {
      setClearingData(false);
    }
  }

  async function handleOpenConversationFromSearchPage(
    conversationId: string,
    activeQuery: string,
    messageId?: string | null
  ) {
    setSearchPageQuery(activeQuery);
    setActiveView("conversations");
    if (activeSource !== null) {
      setActiveSource(null);
      await loadData(null);
    }

    // If the selected conversation is not in the currently loaded list,
    // inject it from search snapshot so the left panel can highlight it.
    setConversations((prev) => {
      if (prev.some((c) => c.id === conversationId)) {
        return prev;
      }
      const fromSearch = searchPageSnapshot.results.find(
        (row) => row.conversation_id === conversationId
      );
      if (!fromSearch) {
        return prev;
      }
      return [
        {
          id: fromSearch.conversation_id,
          source: fromSearch.source,
          title: fromSearch.title || "Untitled",
          created_at: fromSearch.created_at,
          message_count: 0,
        },
        ...prev,
      ];
    });

    await handleConversationClick(conversationId, messageId);
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

        <div className="nav-views">
          <button
            className={`nav-source-btn ${activeView === "conversations" ? "active" : ""}`}
            onClick={() => setActiveView("conversations")}
          >
            <span>Chats</span>
          </button>
          <button
            className={`nav-source-btn ${activeView === "search" ? "active" : ""}`}
            onClick={() => setActiveView("search")}
          >
            <span>Search</span>
          </button>
        </div>

        {/* Source tabs */}
        <div className="nav-sources">
          <button
            className={`nav-source-btn ${activeSource === null ? "active" : ""}`}
            onClick={() => {
              setActiveView("conversations");
              setActiveSource(null);
            }}
          >
            <span>All</span>
            {stats && <span className="nav-badge">{stats.conversationCount}</span>}
          </button>

          {availableSources.map((src) => (
            <button
              key={src}
              className={`nav-source-btn ${activeSource === src ? "active" : ""}`}
              onClick={() => {
                setActiveView("conversations");
                setActiveSource(src);
              }}
            >
              <span>{sourceLabel(src)}</span>
              <span className="nav-badge">{sourceConvCount(src)}</span>
            </button>
          ))}
        </div>

        {/* Import/Clear controls */}
        <div className="nav-bottom">
          <div className="import-wrapper" ref={importMenuRef}>
            <button
              type="button"
              className="import-trigger"
              onClick={() => setImportMenuOpen((v) => !v)}
              disabled={importing || clearingData}
            >
              {importing ? "Importing..." : "+ Import"}
            </button>

            {importMenuOpen && (
              <div className="import-menu">
                {IMPORT_SOURCES.map((src) => (
                  <button
                    type="button"
                    key={src.id}
                    className="import-menu-item"
                    disabled={!src.available || clearingData}
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

          <button
            type="button"
            className="clear-data-trigger"
            onClick={handleClearAllDataClick}
            disabled={importing || clearingData || loading}
          >
            {clearingData ? "Clearing..." : "Clear Data"}
          </button>
        </div>
      </nav>

      {activeView === "search" ? (
        <main className="search-main">
          <SearchPage
            query={searchPageQuery}
            onQueryChange={setSearchPageQuery}
            availableSources={availableSources}
            sourceLabel={sourceLabel}
            focusRequestId={searchFocusRequestId}
            snapshot={searchPageSnapshot}
            onSnapshotChange={setSearchPageSnapshot}
            onOpenConversation={(conversationId, activeQuery, messageId) => {
              void handleOpenConversationFromSearchPage(conversationId, activeQuery, messageId);
            }}
          />
        </main>
      ) : (
        <>
          {/* ---- CONVERSATION LIST ---- */}
          <aside className="conv-panel">
            <div className="conv-panel-header">
              <div className="conv-header-top">
                <h2>{activeSource ? sourceLabel(activeSource) : "All Conversations"}</h2>
                <span className="conv-count">{conversations.length}</span>
              </div>
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
                    ref={(element) => {
                      convItemRefs.current[c.id] = element;
                    }}
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
                      <span>{filteredMessages.length}{messageSearchQuery ? ` of ${messages.length}` : ""} messages</span>
                      <span>{formatDate(selectedConversation.created_at)}</span>
                    </p>
                  </div>
                  <div className="viewer-search">
                    <input
                      ref={viewerSearchInputRef}
                      type="search"
                      className="viewer-search-input"
                      placeholder="Search in conversation..."
                      value={messageSearchQuery}
                      onChange={(e) => setMessageSearchQuery(e.target.value)}
                    />
                    {messageSearchQuery.trim() && matchCount > 0 && (
                      <div className="viewer-search-nav">
                        <span className="viewer-search-count">
                          {currentMatchIndex + 1} of {matchCount}
                        </span>
                        <button
                          type="button"
                          className="viewer-search-nav-btn"
                          onClick={goToPrevMatch}
                          title="Previous match"
                          aria-label="Previous match"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          className="viewer-search-nav-btn"
                          onClick={goToNextMatch}
                          title="Next match"
                          aria-label="Next match"
                        >
                          ↓
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {filteredMessages.length === 0 ? (
                  <div className="viewer-empty">
                    <p className="viewer-empty-text">No messages match your search.</p>
                  </div>
                ) : (
                  <div className="msg-list">
                    {filteredMessages.map((m) => (
                      <article
                        key={m.id}
                        ref={(el) => {
                          messageRefs.current[m.id] = el;
                        }}
                        className={`msg ${m.sender === "human" ? "human" : "assistant"}${
                          highlightedMessageId === m.id ? " highlighted" : ""
                        }`}
                      >
                        <div className="msg-top">
                          <span className="sender-pill">
                            {m.sender === "human" ? "You" : "Assistant"}
                          </span>
                          <time>{formatTimestamp(m.created_at)}</time>
                        </div>
                        <div className="msg-body">{highlightText(m.content, messageSearchQuery)}</div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </main>
        </>
      )}

      {clearConfirmOpen && (
        <div className="confirm-overlay" role="presentation">
          <div
            className="confirm-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clear-data-title"
          >
            <h3 id="clear-data-title">Clear imported data?</h3>
            <p>
              This will permanently remove all imported conversations and
              messages from this app.
            </p>
            <div className="confirm-actions">
              <button
                type="button"
                className="confirm-cancel-btn"
                onClick={() => setClearConfirmOpen(false)}
                disabled={clearingData}
              >
                Cancel
              </button>
              <button
                type="button"
                className="confirm-danger-btn"
                onClick={() => void handleClearAllDataConfirm()}
                disabled={clearingData}
              >
                {clearingData ? "Clearing..." : "Clear Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

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

const SEARCH_STATE_KEY = "memex-search-state";

type PersistedSearchState = {
  query: string;
  source: string;
  dateFrom: string;
  dateTo: string;
  sort: SearchPageSnapshot["sort"];
};

function loadSearchState(): Partial<PersistedSearchState> | null {
  try {
    const raw = localStorage.getItem(SEARCH_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && "query" in parsed) {
      const p = parsed as Record<string, unknown>;
      return {
        query: typeof p.query === "string" ? p.query : "",
        source: typeof p.source === "string" ? p.source : "",
        dateFrom: typeof p.dateFrom === "string" ? p.dateFrom : "",
        dateTo: typeof p.dateTo === "string" ? p.dateTo : "",
        sort:
          typeof p.sort === "string" &&
          ["relevance", "last_occurrence_desc", "occurrence_count_desc", "title_az", "title_za"].includes(p.sort)
            ? (p.sort as PersistedSearchState["sort"])
            : "last_occurrence_desc",
      };
    }
  } catch {
    // ignore
  }
  return null;
}

function saveSearchState(state: PersistedSearchState) {
  try {
    localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

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

  // ---- search state (initialized from persisted state if present) ----
  const [searchPageQuery, setSearchPageQuery] = useState(() => {
    const loaded = loadSearchState();
    return loaded?.query ?? "";
  });
  const [searchPageSnapshot, setSearchPageSnapshot] = useState<SearchPageSnapshot>(() => {
    const loaded = loadSearchState();
    return {
      source: loaded?.source ?? "",
      dateFrom: loaded?.dateFrom ?? "",
      dateTo: loaded?.dateTo ?? "",
      sort: loaded?.sort ?? "last_occurrence_desc",
      results: [],
      totalMatches: 0,
      latencyMs: null,
    };
  });
  const [searchFocusRequestId, setSearchFocusRequestId] = useState<number | null>(
    null
  );
  const [openedConversationFromSearch, setOpenedConversationFromSearch] = useState(false);
  const skipSearchOnceRef = useRef(false);

  // ---- persist search state to localStorage ----
  useEffect(() => {
    saveSearchState({
      query: searchPageQuery,
      source: searchPageSnapshot.source,
      dateFrom: searchPageSnapshot.dateFrom,
      dateTo: searchPageSnapshot.dateTo,
      sort: searchPageSnapshot.sort,
    });
  }, [
    searchPageQuery,
    searchPageSnapshot.source,
    searchPageSnapshot.dateFrom,
    searchPageSnapshot.dateTo,
    searchPageSnapshot.sort,
  ]);

  // ---- clear skipSearchOnceRef after SearchPage has read it (when on search tab) ----
  useEffect(() => {
    if (activeView === "search") {
      const id = window.setTimeout(() => {
        skipSearchOnceRef.current = false;
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [activeView]);

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

  // ---- copy toast ----
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const copyToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyToClipboard(text: string): Promise<boolean> {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }

  function showCopyToast(message: string) {
    if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    setCopyToast(message);
    copyToastTimerRef.current = setTimeout(() => {
      setCopyToast(null);
      copyToastTimerRef.current = null;
    }, 2000);
  }

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) clearTimeout(copyToastTimerRef.current);
    };
  }, []);

  function copyMessageToClipboard(m: MessageRow) {
    const sender = m.sender === "human" ? "You" : "Assistant";
    const line = `${sender} (${formatTimestamp(m.created_at)}): ${m.content}`;
    copyToClipboard(line).then((ok) => ok && showCopyToast("Copied"));
  }

  function copyConversationToClipboard(format: "plain" | "markdown" = "plain") {
    const lines = messages.map((m) => {
      const sender = m.sender === "human" ? "You" : "Assistant";
      const ts = formatTimestamp(m.created_at);
      if (format === "markdown") {
        return `**${sender}** (${ts}):\n\n${m.content}`;
      }
      return `${sender} (${ts}): ${m.content}`;
    });
    const text = format === "markdown" ? lines.join("\n\n") : lines.join("\n\n");
    copyToClipboard(text).then((ok) => ok && showCopyToast("Copied"));
  }

  // ---- derived ----
  const selectedConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConvId) ?? null,
    [conversations, selectedConvId]
  );

  // One entry per occurrence of the search query (across all messages)
  const occurrences = useMemo(() => {
    if (!messageSearchQuery.trim()) return [];
    const escaped = messageSearchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    const result: { messageId: string; localIndex: number }[] = [];
    for (const m of messages) {
      re.lastIndex = 0;
      let count = 0;
      while (re.exec(m.content) !== null) {
        result.push({ messageId: m.id, localIndex: count });
        count += 1;
      }
    }
    return result;
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

  const matchCount = occurrences.length;
  const messageMatchCount = useMemo(
    () => new Set(occurrences.map((o) => o.messageId)).size,
    [occurrences]
  );
  const currentMatchIndex = Math.min(messageSearchMatchIndex, Math.max(0, matchCount - 1));

  const goToPrevMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setMessageSearchMatchIndex((i) => (i <= 0 ? matchCount - 1 : i - 1));
  }, [matchCount]);

  const goToNextMatch = useCallback(() => {
    if (matchCount <= 0) return;
    setMessageSearchMatchIndex((i) => (i >= matchCount - 1 ? 0 : i + 1));
  }, [matchCount]);

  // When query or occurrence list changes, reset to first match
  useEffect(() => {
    setMessageSearchMatchIndex(0);
    if (!messageSearchQuery.trim()) setHighlightedMessageId(null);
  }, [messageSearchQuery, matchCount]);

  // Scroll to the specific occurrence and mark it as current (others dimmed via CSS)
  useEffect(() => {
    if (!messageSearchQuery.trim()) return;
    // Clear current-match from all marks
    Object.values(messageRefs.current).forEach((msgEl) => {
      msgEl?.querySelectorAll("mark").forEach((m) => m.classList.remove("current-match"));
    });
    if (matchCount === 0) return;
    const occ = occurrences[currentMatchIndex];
    if (!occ) return;
    setHighlightedMessageId(occ.messageId);
    const el = messageRefs.current[occ.messageId];
    if (el) {
      const marks = el.querySelectorAll("mark");
      const mark = marks[occ.localIndex] ?? marks[0];
      if (mark) mark.classList.add("current-match");
      (mark || el).scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [messageSearchQuery, currentMatchIndex, matchCount, occurrences]);

  // Keyboard: Up/Down/Enter navigate between occurrences; Escape blurs search (keeps query)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inViewer = (e.target as Node)?.parentElement?.closest(".viewer");
      if (!inViewer) return;

      if (e.key === "Escape") {
        const searchInput = viewerSearchInputRef.current;
        if (searchInput && document.activeElement === searchInput) {
          e.preventDefault();
          searchInput.blur();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        } else if (messageSearchQuery.trim()) {
          e.preventDefault();
          setMessageSearchQuery("");
          setMessageSearchMatchIndex(0);
        }
        return;
      }

      if (!messageSearchQuery.trim() || matchCount <= 0) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        goToPrevMatch();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        goToNextMatch();
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) goToPrevMatch();
        else goToNextMatch();
      }
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
      
      // Scroll to the highlighted search term (first <mark>) in the target message, not the message center
      if (scrollToMessageId) {
        setTimeout(() => {
          const messageEl = messageRefs.current[scrollToMessageId];
          if (messageEl) {
            const mark = messageEl.querySelector("mark");
            (mark || messageEl).scrollIntoView({ behavior: "smooth", block: "center" });
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

  const goBackToSearch = useCallback(() => {
    setOpenedConversationFromSearch(false);
    skipSearchOnceRef.current = true;
    setActiveView("search");
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Back to search when current conversation was opened from Search (e.g. Backspace)
      if (
        event.key === "Backspace" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        if (activeView === "conversations" && selectedConvId && openedConversationFromSearch) {
          event.preventDefault();
          goBackToSearch();
        }
      }
      if (!(event.metaKey || event.ctrlKey)) return;
      const key = event.key.toLowerCase();
      if (key === "k") {
        event.preventDefault();
        setOpenedConversationFromSearch(false);
        setActiveView("search");
        setSearchFocusRequestId(Date.now());
      }
      if (key === "f") {
        event.preventDefault();
        if (activeView === "conversations" && selectedConvId) {
          viewerSearchInputRef.current?.focus();
          viewerSearchInputRef.current?.select();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeView, selectedConvId, openedConversationFromSearch, goBackToSearch]);

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
      saveSearchState({
        query: "",
        source: "",
        dateFrom: "",
        dateTo: "",
        sort: "last_occurrence_desc",
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
    setOpenedConversationFromSearch(true);
    setSearchPageQuery(activeQuery);
    setMessageSearchQuery(activeQuery);
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

    // Focus the conversation search bar and select its text so it stays "selected"
    setTimeout(() => {
      viewerSearchInputRef.current?.focus();
      viewerSearchInputRef.current?.select();
    }, 150);
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
            onClick={() => {
              setOpenedConversationFromSearch(false);
              setActiveView("search");
            }}
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
            skipSearchOnceRef={skipSearchOnceRef}
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
                    onClick={() => {
                      setOpenedConversationFromSearch(false);
                      void handleConversationClick(c.id);
                    }}
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
          <main className={`viewer${messageSearchQuery.trim() ? " viewer-has-search" : ""}`}>
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
                  <div className="viewer-header-left">
                    {openedConversationFromSearch && (
                      <button
                        type="button"
                        className="viewer-back-to-search-btn"
                        onClick={goBackToSearch}
                        title="Back to search (Backspace)"
                      >
                        ← Back to search
                      </button>
                    )}
                    <div>
                      <h2>{selectedConversation.title || "Untitled"}</h2>
                      <p className="viewer-header-meta">
                        <span className="source-tag">
                          {sourceLabel(selectedConversation.source)}
                        </span>
                        <span>{messageSearchQuery.trim() ? `${matchCount} occurrence${matchCount !== 1 ? "s" : ""} in ${messageMatchCount} message${messageMatchCount !== 1 ? "s" : ""}` : `${messages.length} messages`}</span>
                        <span>{formatDate(selectedConversation.created_at)}</span>
                      </p>
                    </div>
                  </div>
                  <div className="viewer-header-actions">
                    <div className="viewer-copy-conv-wrapper">
                      <button
                        type="button"
                        className="viewer-copy-conv-btn"
                        onClick={() => copyConversationToClipboard("plain")}
                        title="Copy conversation (plain text)"
                      >
                        Copy conversation
                      </button>
                      <select
                        className="viewer-copy-conv-format"
                        aria-label="Copy format"
                        value=""
                        onChange={(e) => {
                          const v = e.target.value as "plain" | "markdown";
                          if (v) copyConversationToClipboard(v);
                          e.target.value = "";
                        }}
                      >
                        <option value="">▼</option>
                        <option value="plain">Plain text</option>
                        <option value="markdown">Markdown</option>
                      </select>
                    </div>
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
                    {messageSearchQuery.trim() && matchCount === 0 && (
                      <span className="viewer-search-no-results">No results</span>
                    )}
                  </div>
                </div>
                {copyToast && (
                  <div className="copy-toast" role="status" aria-live="polite">
                    {copyToast}
                  </div>
                )}
                <div className="msg-list">
                  {messages.map((m) => (
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
                        <span className="msg-top-right">
                          <time>{formatTimestamp(m.created_at)}</time>
                          <button
                            type="button"
                            className="msg-copy-btn"
                            onClick={() => copyMessageToClipboard(m)}
                            title="Copy message"
                            aria-label="Copy message"
                          >
                            Copy
                          </button>
                        </span>
                      </div>
                      <div className="msg-body">{highlightText(m.content, messageSearchQuery)}</div>
                    </article>
                  ))}
                </div>
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

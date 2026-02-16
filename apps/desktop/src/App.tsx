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
import OverviewPage from "./OverviewPage";
import ImportPage from "./ImportPage";
import { formatTimestamp } from "./utils";
import "./App.css";

import Sidebar, { type ActiveView } from "./components/Sidebar";
import ClearDataConfirmDialog from "./panels/ClearDataConfirmDialog";
import ConversationListPanel from "./panels/ConversationListPanel";
import ConversationViewerPanel from "./panels/ConversationViewerPanel";
import SearchPanel from "./panels/SearchPanel";
import SettingsPanel from "./panels/SettingsPanel";

import { usePrefersReducedMotion } from "./hooks/usePrefersReducedMotion";
import { usePersistedSearchState } from "./hooks/usePersistedSearchState";
import { useThemeMode } from "./hooks/useThemeMode";

function App() {
  const { theme, setThemeAndPersist } = useThemeMode();
  const prefersReducedMotion = usePrefersReducedMotion();

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
  const [activeView, setActiveView] = useState<ActiveView>("overview");

  // ---- search: re-use the main conversation viewer panel ----
  // When browsing search results, selecting a result should open it in the
  // same viewer used by the Conversations tab (and preserve query highlights).
  const [searchSelectedConvId, setSearchSelectedConvId] = useState<string | null>(null);
  const [messageSearchQuery, setMessageSearchQuery] = useState("");
  const [messageSearchMatchIndex, setMessageSearchMatchIndex] = useState(0);
  const [viewerSearchOpen, setViewerSearchOpen] = useState(false);
  const [viewerMenuOpen, setViewerMenuOpen] = useState(false);
  const viewerSearchInputRef = useRef<HTMLInputElement>(null);
  const viewerMenuRef = useRef<HTMLDivElement>(null);

  const {
    query: searchPageQuery,
    setQuery: setSearchPageQuery,
    snapshot: searchPageSnapshot,
    setSnapshot: setSearchPageSnapshot,
    clearPersistedState: clearPersistedSearchState,
  } = usePersistedSearchState();
  const [searchFocusRequestId, setSearchFocusRequestId] = useState<number | null>(
    null
  );
  const [openedConversationFromSearch, setOpenedConversationFromSearch] = useState(false);
  const [searchRestoreConversationId, setSearchRestoreConversationId] = useState<string | null>(null);
  const [importRefreshKey, setImportRefreshKey] = useState(0);
  const skipSearchOnceRef = useRef(false);

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
  const [, setImportMenuOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<string | null>(null);
  const [clearError, setClearError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const convItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});
  const clearConfirmCancelBtnRef = useRef<HTMLButtonElement>(null);
  const clearConfirmDialogRef = useRef<HTMLDivElement>(null);
  const clearDataTriggerRef = useRef<HTMLButtonElement>(null);

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

  function copyMessageToClipboard(m: MessageRow, assistantLabel: string) {
    const sender = m.sender === "human" ? "You" : assistantLabel;
    const line = `${sender} (${formatTimestamp(m.created_at)}): ${m.content}`;
    // Note: we intentionally do not move focus when copying; the toast is
    // announced via aria-live and focus stays on the triggering button.
    copyToClipboard(line).then((ok) => ok && showCopyToast("Copied"));
  }

  function copyConversationToClipboard(assistantLabel: string) {
    const lines = messages.map((m) => {
      const sender = m.sender === "human" ? "You" : assistantLabel;
      const ts = formatTimestamp(m.created_at);
      return `**${sender}** (${ts}):\n\n${m.content}`;
    });
    const text = lines.join("\n\n");
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
    if (!viewerSearchOpen || !messageSearchQuery.trim()) return;
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
      (mark || el).scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "center",
      });
    }
  }, [viewerSearchOpen, messageSearchQuery, currentMatchIndex, matchCount, occurrences]);

  // Focus viewer search input when search panel opens
  useEffect(() => {
    if (viewerSearchOpen && selectedConvId) {
      const id = setTimeout(() => {
        viewerSearchInputRef.current?.focus();
        viewerSearchInputRef.current?.select();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [viewerSearchOpen, selectedConvId]);

  useEffect(() => {
    if (!viewerMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (viewerMenuRef.current && !viewerMenuRef.current.contains(e.target as Node)) {
        setViewerMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [viewerMenuOpen]);

  // Keyboard: Up/Down/Enter navigate between occurrences; Escape closes search UI (keeps query)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const inViewer = (e.target as Node)?.parentElement?.closest(".viewer");
      if (!inViewer) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (viewerMenuOpen) {
          setViewerMenuOpen(false);
          return;
        }
        if (viewerSearchOpen) {
          const searchInput = viewerSearchInputRef.current;
          if (searchInput) {
            searchInput.blur();
            searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
          }
          setViewerSearchOpen(false);
        }
        return;
      }

      if (!viewerSearchOpen || !messageSearchQuery.trim() || matchCount <= 0) return;
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
  }, [viewerSearchOpen, messageSearchQuery, matchCount, goToPrevMatch, goToNextMatch]);

  // ---- clear-data modal: focus on open, focus trap, Escape ----
  useEffect(() => {
    if (!clearConfirmOpen) return;
    const id = setTimeout(() => {
      clearConfirmCancelBtnRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [clearConfirmOpen]);

  useEffect(() => {
    if (!clearConfirmOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setClearConfirmOpen(false);
        clearDataTriggerRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !clearConfirmDialogRef.current) return;
      const dialog = clearConfirmDialogRef.current;
      const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [clearConfirmOpen]);

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
            (mark || messageEl).scrollIntoView({
              behavior: prefersReducedMotion ? "auto" : "smooth",
              block: "center",
            });
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
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }, [activeView, selectedConvId]);

  const goBackToSearch = useCallback(() => {
    if (selectedConvId) setSearchRestoreConversationId(selectedConvId);
    setOpenedConversationFromSearch(false);
    skipSearchOnceRef.current = true;
    setActiveView("search");
  }, [selectedConvId]);

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
          const searchInput = viewerSearchInputRef.current;
          const searchIsFocused = searchInput && document.activeElement === searchInput;
          if (!viewerSearchOpen) {
            setViewerSearchOpen(true);
          } else if (searchIsFocused) {
            setViewerSearchOpen(false);
          } else {
            searchInput?.focus();
            searchInput?.select();
          }
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [activeView, selectedConvId, openedConversationFromSearch, goBackToSearch, viewerSearchOpen]);

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
        setImportRefreshKey((k) => k + 1);
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
    setClearResult(null);
    setClearError(null);

    try {
      // Actually delete data from DB first — only reset UI state after success.
      await clearAllData();

      clearPersistedSearchState();
      setSelectedConvId(null);
      setMessages([]);
      setClearResult("All imported data was removed.");
      await loadData(activeSource);
    } catch (err) {
      console.error("Clear data failed:", err);
      setClearError(err instanceof Error ? err.message : "Clear data failed");
    } finally {
      setClearingData(false);
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

  async function handleSearchResultSelect(convId: string) {
    // Switch the right panel to the standard viewer with in-thread search open.
    setSearchSelectedConvId(convId);
    setSelectedConvId(convId);
    setOpenedConversationFromSearch(true);
    setViewerSearchOpen(true);
    setMessageSearchQuery(searchPageQuery);
    setMessageSearchMatchIndex(0);
    await handleConversationClick(convId, null);
  }

  function handleOverviewSelectConversation(convId: string) {
    setActiveView("conversations");
    setActiveSource(null);
    void loadData(null).then(() => {
      setSelectedConvId(convId);
      setMessagesLoading(true);
      getMessages(convId).then((data) => {
        setMessages(data);
        setMessagesLoading(false);
      }).catch(() => setMessagesLoading(false));
    });
  }

  const searchPanelClosed = activeView === "search" && !searchSelectedConvId;
  const shellLayoutClass =
    activeView === "search"
      ? searchPanelClosed
        ? "search-layout search-panel-closed"
        : "search-layout"
      : activeView === "overview"
        ? "overview-layout"
        : activeView === "settings"
          ? "settings-layout"
          : activeView === "import"
            ? "import-layout"
            : "conversations-layout";
  const hasGlobalError = Boolean(loadError);

  // ---- render ----
  return (
    <div className={`app-shell ${shellLayoutClass}${hasGlobalError ? " has-global-banner" : ""}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      {hasGlobalError && (
        <div className="global-banner-area" role="alert">
          {loadError && (
            <div className="banner error global-banner-item">
              <span>{loadError}</span>
              <button type="button" className="global-banner-dismiss" onClick={() => setLoadError(null)} aria-label="Dismiss">×</button>
            </div>
          )}
        </div>
      )}
      {/* ---- Collapsed sidebar ---- */}
      <Sidebar
        activeView={activeView}
        onSelectView={setActiveView}
        onOpenImport={() => {
          setActiveView("import");
          setImportMenuOpen(false);
        }}
      />

      {activeView === "overview" && (
        <OverviewPage
          onOpenImport={() => setActiveView("import")}
          onSelectConversation={handleOverviewSelectConversation}
        />
      )}

      {activeView === "import" && (
        <ImportPage
          onImport={(source) => void handleImportSource(source)}
          importing={importing}
          importError={importError}
          importResult={importResult}
          onDismissImportError={() => setImportError(null)}
          refreshKey={importRefreshKey}
        />
      )}

      {activeView === "settings" && (
        <SettingsPanel
          theme={theme}
          onSetTheme={setThemeAndPersist}
          clearResult={clearResult}
          clearError={clearError}
          clearingData={clearingData}
          importing={importing}
          loading={loading}
          onClearAllDataClick={handleClearAllDataClick}
          clearDataTriggerRef={clearDataTriggerRef}
        />
      )}

      {activeView === "search" && (
        <SearchPanel
          query={searchPageQuery}
          onQueryChange={setSearchPageQuery}
          availableSources={availableSources}
          sourceLabel={sourceLabel}
          onSelectResult={(convId) => void handleSearchResultSelect(convId)}
          selectedConversationId={searchSelectedConvId}
          focusRequestId={searchFocusRequestId}
          snapshot={searchPageSnapshot}
          onSnapshotChange={setSearchPageSnapshot}
          skipSearchOnceRef={skipSearchOnceRef}
          restoreSelectedConversationId={searchRestoreConversationId}
          onRestoreSelectionDone={() => setSearchRestoreConversationId(null)}
          viewer={{
            open: Boolean(searchSelectedConvId),
            onClose: () => {
              setSearchSelectedConvId(null);
              setSelectedConvId(null);
              setOpenedConversationFromSearch(false);
            },
            selectedConversation,
            messages,
            messagesLoading,
            viewerSearchOpen,
            onOpenViewerSearch: () => setViewerSearchOpen(true),
            messageSearchQuery,
            onMessageSearchQueryChange: setMessageSearchQuery,
            viewerSearchInputRef,
            matchCount,
            messageMatchCount,
            currentMatchIndex,
            onPrevMatch: goToPrevMatch,
            onNextMatch: goToNextMatch,
            copyToast,
            onCopyMessage: (m) => copyMessageToClipboard(m, sourceLabel(selectedConversation?.source ?? "")),
            messageRefs,
            highlightedMessageId,
            highlightText,
          }}
        />
      )}

      {activeView === "conversations" && (
        <>
          <ConversationListPanel
            conversations={conversations}
            loading={loading}
            selectedConvId={selectedConvId}
            activeSource={activeSource}
            availableSources={availableSources}
            sourceStats={sourceStats}
            convItemRefs={convItemRefs}
            onSelectSource={setActiveSource}
            onSelectConversation={(convId) => {
              setOpenedConversationFromSearch(false);
              void handleConversationClick(convId);
            }}
            sourceLabel={sourceLabel}
          />
          <ConversationViewerPanel
            stats={stats}
            selectedConversation={selectedConversation}
            messages={messages}
            messagesLoading={messagesLoading}
            openedConversationFromSearch={openedConversationFromSearch}
            onBackToSearch={goBackToSearch}
            viewerMenuOpen={viewerMenuOpen}
            onToggleViewerMenu={() => setViewerMenuOpen((open) => !open)}
            onCloseViewerMenu={() => setViewerMenuOpen(false)}
            viewerMenuRef={viewerMenuRef}
            viewerSearchOpen={viewerSearchOpen}
            onOpenViewerSearch={() => setViewerSearchOpen(true)}
            messageSearchQuery={messageSearchQuery}
            onMessageSearchQueryChange={setMessageSearchQuery}
            viewerSearchInputRef={viewerSearchInputRef}
            matchCount={matchCount}
            messageMatchCount={messageMatchCount}
            currentMatchIndex={currentMatchIndex}
            onPrevMatch={goToPrevMatch}
            onNextMatch={goToNextMatch}
            copyToast={copyToast}
            onCopyConversation={() => copyConversationToClipboard(sourceLabel(selectedConversation?.source ?? ""))}
            onCopyMessage={(m) => copyMessageToClipboard(m, sourceLabel(selectedConversation?.source ?? ""))}
            messageRefs={messageRefs}
            highlightedMessageId={highlightedMessageId}
            highlightText={highlightText}
            sourceLabel={sourceLabel}
          />
        </>
      )}

      <ClearDataConfirmDialog
        open={clearConfirmOpen}
        clearingData={clearingData}
        onCancel={() => setClearConfirmOpen(false)}
        onConfirm={() => void handleClearAllDataConfirm()}
        cancelBtnRef={clearConfirmCancelBtnRef}
        dialogRef={clearConfirmDialogRef}
      />
    </div>
  );
}

export default App;

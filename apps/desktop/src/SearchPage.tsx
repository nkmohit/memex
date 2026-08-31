import { useEffect, useRef, useState, type MutableRefObject } from "react";
import SearchFilters from "./SearchFilters";
import SearchResultsList from "./SearchResultsList";
import { useSearchPageQuery } from "./hooks/useSearchPageQuery";
import type { SearchResultRow } from "./db";

interface SearchPageProps {
  query: string;
  onQueryChange: (query: string) => void;
  availableSources: string[];
  sourceLabel: (source: string) => string;
  onOpenConversation?: (
    conversationId: string,
    activeQuery: string,
    messageId?: string | null
  ) => void;
  /** When provided, clicking a result only updates the detail panel (no view switch). */
  onSelectResult?: (
    conversationId: string,
    title: string,
    source: string,
    lastOccurrence: number
  ) => void;
  selectedConversationId?: string | null;
  focusRequestId?: number | null;
  snapshot: SearchPageSnapshot;
  onSnapshotChange: (snapshot: SearchPageSnapshot) => void;
  skipSearchOnceRef?: MutableRefObject<boolean>;
  restoreSelectedConversationId?: string | null;
  onRestoreSelectionDone?: () => void;
}

export interface SearchPageSnapshot {
  source: string;
  dateFrom: string;
  dateTo: string;
  sort: "relevance" | "last_occurrence_desc" | "occurrence_count_desc" | "title_az" | "title_za";
  results: SearchResultRow[];
  totalMatches: number;
  totalOccurrences: number;
  latencyMs: number | null;
}

export default function SearchPage({
  query,
  onQueryChange,
  availableSources,
  sourceLabel,
  onOpenConversation,
  onSelectResult,
  selectedConversationId = null,
  focusRequestId = null,
  snapshot,
  onSnapshotChange,
  skipSearchOnceRef,
  restoreSelectedConversationId = null,
  onRestoreSelectionDone,
}: SearchPageProps) {
  const {
    source,
    setSource,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    sort,
    setSort,
    results,
    totalMatches,
    totalOccurrences,
    loading,
    loadingMore,
    error,
    latencyMs,
    selectedIndex,
    setSelectedIndex,
    hasQuery,
    queryTooShort,
    MIN_QUERY_LENGTH,
    handleLoadMore,
  } = useSearchPageQuery({ query, snapshot, skipSearchOnceRef });

  const [filtersOpen, setFiltersOpen] = useState(() => {
    return Boolean(
      snapshot.source ||
      snapshot.dateFrom ||
      snapshot.dateTo ||
      snapshot.sort !== "last_occurrence_desc"
    );
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (focusRequestId === null) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [focusRequestId]);

  // Restore selection to the conversation we returned from (Back to search)
  useEffect(() => {
    if (!restoreSelectedConversationId || results.length === 0) return;
    const idx = results.findIndex((r) => r.conversation_id === restoreSelectedConversationId);
    if (idx >= 0) setSelectedIndex(idx);
    onRestoreSelectionDone?.();
  }, [restoreSelectedConversationId, results, onRestoreSelectionDone]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    resultRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior:
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
    });
  }, [selectedIndex]);

  useEffect(() => {
    function handleKeyboardNav(event: KeyboardEvent) {
      if (event.key === "Escape") {
        const searchInput = searchInputRef.current;
        if (searchInput && document.activeElement === searchInput) {
          event.preventDefault();
          searchInput.blur();
          searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
        }
        return;
      }

      if (!hasQuery || loading || results.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter" && selectedIndex >= 0) {
        const selected = results[selectedIndex];
        if (!selected) return;
        event.preventDefault();
        if (onSelectResult) {
          onSelectResult(
            selected.conversation_id,
            selected.title || "Untitled",
            selected.source,
            selected.last_occurrence
          );
        } else if (onOpenConversation) {
          onOpenConversation(selected.conversation_id, query, selected.first_match_message_id);
        }
      }
    }

    document.addEventListener("keydown", handleKeyboardNav);
    return () => document.removeEventListener("keydown", handleKeyboardNav);
  }, [hasQuery, loading, onOpenConversation, onSelectResult, query, results, selectedIndex]);

  const searchContext = source ? `Source: ${sourceLabel(source)}` : "Source: all";
  const dateContext =
    dateFrom && dateTo
      ? `Date: ${dateFrom} to ${dateTo}`
      : dateFrom
        ? `Date: from ${dateFrom}`
        : dateTo
          ? `Date: up to ${dateTo}`
          : "Date: all";

  useEffect(() => {
    onSnapshotChange({
      source,
      dateFrom,
      dateTo,
      sort,
      results,
      totalMatches,
      totalOccurrences,
      latencyMs,
    });
  }, [
    source,
    dateFrom,
    dateTo,
    sort,
    results,
    totalMatches,
    totalOccurrences,
    latencyMs,
    onSnapshotChange,
  ]);

  return (
    <section className="search-page">
      <header className="search-header">
        <h1 className="search-title">Search</h1>
        <input
          ref={searchInputRef}
          className="search-input"
          type="search"
          aria-label="Search all messages"
          placeholder="Search all messages..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <SearchFilters
          availableSources={availableSources}
          source={source}
          onSourceChange={setSource}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          sort={sort}
          onSortChange={setSort}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((open) => !open)}
          sourceLabel={sourceLabel}
        />

        <div className="search-meta">
          {queryTooShort ? (
            <span className="search-loading">
              Type at least {MIN_QUERY_LENGTH} characters to search.
            </span>
          ) : loading && results.length === 0 ? (
            <span className="search-loading">{hasQuery ? "Searching" : "Loading"}...</span>
          ) : !hasQuery ? (
            <span title={`${searchContext} · ${dateContext}`}>
              {`${totalMatches} conversations${latencyMs !== null ? ` • ${latencyMs} ms` : ""}`}
            </span>
          ) : (
            <span
              title={`${searchContext} · ${dateContext} · ${totalOccurrences} occurrence${totalOccurrences !== 1 ? "s" : ""}`}
            >
              {`${totalMatches} results${latencyMs !== null ? ` • ${latencyMs} ms` : ""}`}
            </span>
          )}
        </div>

        {error && (
          <div className="banner error" role="alert">
            {error}
          </div>
        )}
      </header>

      <SearchResultsList
        results={results}
        hasQuery={hasQuery}
        queryTooShort={queryTooShort}
        minQueryLength={MIN_QUERY_LENGTH}
        selectedConversationId={selectedConversationId}
        selectedIndex={selectedIndex}
        onSelectRow={(row) => {
          if (onSelectResult) {
            onSelectResult(
              row.conversation_id,
              row.title || "Untitled",
              row.source,
              row.last_occurrence
            );
          } else if (onOpenConversation) {
            onOpenConversation?.(row.conversation_id, query, row.first_match_message_id);
          }
        }}
        onHoverRow={(index) => setSelectedIndex(index)}
        resultRefs={resultRefs}
        sourceLabel={sourceLabel}
        loading={loading}
        loadingMore={loadingMore}
        totalMatches={totalMatches}
        onLoadMore={() => void handleLoadMore()}
      />
    </section>
  );
}

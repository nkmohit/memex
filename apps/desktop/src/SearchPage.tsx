import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { SearchResultRow, getAllConversationsForSearch, searchMessages } from "./db";
import SearchFilters from "./SearchFilters";
import SearchResultsList from "./SearchResultsList";

interface SearchPageProps {
  query: string;
  onQueryChange: (query: string) => void;
  availableSources: string[];
  sourceLabel: (source: string) => string;
  onOpenConversation?: (conversationId: string, activeQuery: string, messageId?: string | null) => void;
  /** When provided, clicking a result only updates the detail panel (no view switch). */
  onSelectResult?: (conversationId: string, title: string, source: string) => void;
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
  sort:
    | "relevance"
    | "last_occurrence_desc"
    | "occurrence_count_desc"
    | "title_az"
    | "title_za";
  results: SearchResultRow[];
  totalMatches: number;
  totalOccurrences: number;
  latencyMs: number | null;
}

function toStartOfDayTimestamp(dateValue: string): number | undefined {
  if (!dateValue) return undefined;
  const date = new Date(`${dateValue}T00:00:00`);
  const ts = date.getTime();
  return Number.isNaN(ts) ? undefined : ts;
}

function toEndOfDayTimestamp(dateValue: string): number | undefined {
  if (!dateValue) return undefined;
  const date = new Date(`${dateValue}T23:59:59.999`);
  const ts = date.getTime();
  return Number.isNaN(ts) ? undefined : ts;
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
  const [source, setSource] = useState(snapshot.source);
  const [dateFrom, setDateFrom] = useState(snapshot.dateFrom);
  const [dateTo, setDateTo] = useState(snapshot.dateTo);
  const [sort, setSort] = useState(snapshot.sort);
  const [results, setResults] = useState<SearchResultRow[]>(snapshot.results);
  const [totalMatches, setTotalMatches] = useState(snapshot.totalMatches);
  const [totalOccurrences, setTotalOccurrences] = useState(snapshot.totalOccurrences ?? 0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(snapshot.latencyMs);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [filtersOpen, setFiltersOpen] = useState(() => {
    return Boolean(snapshot.source || snapshot.dateFrom || snapshot.dateTo || snapshot.sort !== "last_occurrence_desc");
  });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const PAGE_SIZE = 50;

  const hasQuery = query.trim().length > 0;

  const searchParams = useMemo(
    () => ({
      source: source || undefined,
      dateFrom: toStartOfDayTimestamp(dateFrom),
      dateTo: toEndOfDayTimestamp(dateTo),
      sort,
    }),
    [source, dateFrom, dateTo, sort]
  );

  useEffect(() => {
    if (focusRequestId === null) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [focusRequestId]);

  useEffect(() => {
    if (skipSearchOnceRef?.current) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const debounceMs = 250;

    async function runSearch() {
      if (!hasQuery) {
        // Load all conversations sorted by last message date when no query
        setError(null);
        setLoading(true);
        const start = performance.now();

        try {
          const response = await getAllConversationsForSearch({
            ...searchParams,
            limit: PAGE_SIZE,
            offset: 0,
          });
          if (cancelled) return;
          
          // Convert ConversationListRow to SearchResultRow format
          const convertedResults: SearchResultRow[] = response.rows.map(row => ({
            conversation_id: row.conversation_id,
            title: row.title,
            source: row.source,
            snippet: "",
            snippets: [],
            created_at: row.created_at,
            last_occurrence: row.last_message_at,
            occurrence_count: row.message_count,
            message_match_count: 0,
            rank: 0,
            first_match_message_id: null,
          }));
          
          setResults(convertedResults);
          setTotalMatches(response.totalMatches);
          setTotalOccurrences(0);
          setSelectedIndex(convertedResults.length > 0 ? 0 : -1);
          setLatencyMs(Math.round(performance.now() - start));
        } catch (err) {
        if (cancelled) return;
        setResults([]);
        setTotalMatches(0);
        setTotalOccurrences(0);
        setLatencyMs(null);
        setError(err instanceof Error ? err.message : "Failed to load conversations");
        } finally {
          if (!cancelled) {
            setLoading(false);
            setLoadingMore(false);
          }
        }
        return;
      }

      setError(null);
      setLoading(true);
      const start = performance.now();

      try {
        const response = await searchMessages(query, {
          ...searchParams,
          limit: PAGE_SIZE,
          offset: 0,
        });
        if (cancelled) return;
        setResults(response.rows);
        setTotalMatches(response.totalMatches);
        setTotalOccurrences(response.totalOccurrences ?? 0);
        setSelectedIndex(response.rows.length > 0 ? 0 : -1);
        setLatencyMs(Math.round(performance.now() - start));
      } catch (err) {
        if (cancelled) return;
        setResults([]);
        setTotalMatches(0);
        setTotalOccurrences(0);
        setLatencyMs(null);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    // Show loading state immediately
    setLoading(true);

    const timeoutId = window.setTimeout(() => {
      void runSearch();
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [PAGE_SIZE, hasQuery, query, searchParams, skipSearchOnceRef]);

  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  // Restore selection to the conversation we returned from (Back to search)
  useEffect(() => {
    if (!restoreSelectedConversationId || results.length === 0) return;
    const idx = results.findIndex((r) => r.conversation_id === restoreSelectedConversationId);
    if (idx >= 0) setSelectedIndex(idx);
    onRestoreSelectionDone?.();
  }, [restoreSelectedConversationId, results]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    resultRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior: window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
    });
  }, [selectedIndex]);

  useEffect(() => {
    function handleKeyboardNav(event: KeyboardEvent) {
      // Escape: only remove selection / blur search input, do not clear the query
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
          onSelectResult(selected.conversation_id, selected.title || "Untitled", selected.source);
        } else if (onOpenConversation) {
          onOpenConversation(selected.conversation_id, query, selected.first_match_message_id);
        }
      }
    }

    document.addEventListener("keydown", handleKeyboardNav);
    return () => document.removeEventListener("keydown", handleKeyboardNav);
  }, [hasQuery, loading, onOpenConversation, onSelectResult, query, results, selectedIndex]);

  const searchContext = source
    ? `Searching in ${sourceLabel(source)}`
    : "Searching in all sources";
  const dateContext = dateFrom && dateTo
    ? `Date range: ${dateFrom} to ${dateTo}`
    : dateFrom
      ? `Date range: from ${dateFrom}`
      : dateTo
        ? `Date range: up to ${dateTo}`
        : null;

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

  async function handleLoadMore() {
    if (loading || loadingMore || results.length >= totalMatches) return;
    setLoadingMore(true);
    setError(null);
    try {
      if (!hasQuery) {
        // Load more conversations (browse mode)
        const response = await getAllConversationsForSearch({
          ...searchParams,
          limit: PAGE_SIZE,
          offset: results.length,
        });
        
        const convertedResults: SearchResultRow[] = response.rows.map(row => ({
          conversation_id: row.conversation_id,
          title: row.title,
          source: row.source,
          snippet: "",
          snippets: [],
          created_at: row.created_at,
          last_occurrence: row.last_message_at,
          occurrence_count: row.message_count,
          message_match_count: 0,
          rank: 0,
          first_match_message_id: null,
        }));
        
        setResults((prev) => [...prev, ...convertedResults]);
        setTotalMatches(response.totalMatches);
      } else {
        // Load more search results
        const response = await searchMessages(query, {
          ...searchParams,
          limit: PAGE_SIZE,
          offset: results.length,
        });
        setResults((prev) => [...prev, ...response.rows]);
        setTotalMatches(response.totalMatches);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="search-page">
      <header className="search-header">
        <h1>Search</h1>
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
          {loading && results.length === 0 ? (
            <span className="search-loading">{hasQuery ? "Searching" : "Loading"}... · {searchContext}{dateContext ? ` · ${dateContext}` : ""}</span>
          ) : !hasQuery ? (
            <>
              <span>
                {loading && <span className="search-loading-indicator">⟳ </span>}
                {`Showing ${results.length} of ${totalMatches} conversations`}
              </span>
              <span>
                {`All conversations sorted by last message`}
                {` · ${searchContext}`}
                {dateContext ? ` · ${dateContext}` : ""}
                {latencyMs !== null ? ` · ${latencyMs} ms` : ""}
              </span>
            </>
          ) : (
            <>
              <span>
                {loading && <span className="search-loading-indicator">⟳ </span>}
                {`Showing top ${results.length} of ${totalMatches} conversations`}
              </span>
              <span>
                {`${totalOccurrences} occurrence${totalOccurrences !== 1 ? "s" : ""} in ${totalMatches} conversation${totalMatches !== 1 ? "s" : ""}`}
                {` · ${searchContext}`}
                {dateContext ? ` · ${dateContext}` : ""}
                {latencyMs !== null ? ` · ${latencyMs} ms` : ""}
              </span>
            </>
          )}
        </div>

        {error && <div className="banner error" role="alert">{error}</div>}
      </header>

      <SearchResultsList
        results={results}
        hasQuery={hasQuery}
        selectedConversationId={selectedConversationId}
        selectedIndex={selectedIndex}
        onSelectRow={(row) => {
          if (onSelectResult) {
            onSelectResult(row.conversation_id, row.title || "Untitled", row.source);
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

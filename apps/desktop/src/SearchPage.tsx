import { useEffect, useMemo, useRef, useState } from "react";
import { SearchResultRow, searchMessages } from "./db";
import { formatDate } from "./utils";

interface SearchPageProps {
  query: string;
  onQueryChange: (query: string) => void;
  availableSources: string[];
  sourceLabel: (source: string) => string;
  onOpenConversation: (conversationId: string, activeQuery: string) => void;
  focusRequestId?: number | null;
  snapshot: SearchPageSnapshot;
  onSnapshotChange: (snapshot: SearchPageSnapshot) => void;
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

function renderHighlightedSnippet(snippet: string) {
  const parts = snippet.split(/(<mark>|<\/mark>)/g);
  let highlighted = false;
  let idx = 0;

  return parts.map((part) => {
    if (part === "<mark>") {
      highlighted = true;
      return null;
    }
    if (part === "</mark>") {
      highlighted = false;
      return null;
    }
    const key = `snippet-${idx++}`;
    return highlighted ? <mark key={key}>{part}</mark> : <span key={key}>{part}</span>;
  });
}

export default function SearchPage({
  query,
  onQueryChange,
  availableSources,
  sourceLabel,
  onOpenConversation,
  focusRequestId = null,
  snapshot,
  onSnapshotChange,
}: SearchPageProps) {
  const [source, setSource] = useState(snapshot.source);
  const [dateFrom, setDateFrom] = useState(snapshot.dateFrom);
  const [dateTo, setDateTo] = useState(snapshot.dateTo);
  const [sort, setSort] = useState(snapshot.sort);
  const [results, setResults] = useState<SearchResultRow[]>(snapshot.results);
  const [totalMatches, setTotalMatches] = useState(snapshot.totalMatches);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(snapshot.latencyMs);
  const [selectedIndex, setSelectedIndex] = useState(-1);
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
    let cancelled = false;
    const debounceMs = 250;

    async function runSearch() {
      if (!hasQuery) {
        setResults([]);
        setTotalMatches(0);
        setLatencyMs(null);
        setError(null);
        setSelectedIndex(-1);
        setLoading(false);
        setLoadingMore(false);
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
        setSelectedIndex(response.rows.length > 0 ? 0 : -1);
        setLatencyMs(Math.round(performance.now() - start));
      } catch (err) {
        if (cancelled) return;
        setResults([]);
        setTotalMatches(0);
        setLatencyMs(null);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    }

    // Show loading state immediately if there's a query
    if (hasQuery) {
      setLoading(true);
    }

    const timeoutId = window.setTimeout(() => {
      void runSearch();
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [PAGE_SIZE, hasQuery, query, searchParams]);

  useEffect(() => {
    setSelectedIndex(results.length > 0 ? 0 : -1);
  }, [results]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    resultRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex]);

  useEffect(() => {
    function handleKeyboardNav(event: KeyboardEvent) {
      if (!hasQuery || loading || results.length === 0) {
        if (event.key === "Escape" && hasQuery) {
          event.preventDefault();
          onQueryChange("");
          setResults([]);
          setTotalMatches(0);
          setSelectedIndex(-1);
          setLatencyMs(null);
          searchInputRef.current?.focus();
        }
        return;
      }

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
        onOpenConversation(selected.conversation_id, query);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onQueryChange("");
        setResults([]);
        setTotalMatches(0);
        setSelectedIndex(-1);
        setLatencyMs(null);
        searchInputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboardNav);
    return () => document.removeEventListener("keydown", handleKeyboardNav);
  }, [hasQuery, loading, onOpenConversation, onQueryChange, query, results, selectedIndex]);

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
  const loadedOccurrences = useMemo(
    () => results.reduce((total, row) => total + row.occurrence_count, 0),
    [results]
  );

  useEffect(() => {
    onSnapshotChange({
      source,
      dateFrom,
      dateTo,
      sort,
      results,
      totalMatches,
      latencyMs,
    });
  }, [
    source,
    dateFrom,
    dateTo,
    sort,
    results,
    totalMatches,
    latencyMs,
    onSnapshotChange,
  ]);

  async function handleLoadMore() {
    if (loading || loadingMore || !hasQuery || results.length >= totalMatches) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await searchMessages(query, {
        ...searchParams,
        limit: PAGE_SIZE,
        offset: results.length,
      });
      setResults((prev) => [...prev, ...response.rows]);
      setTotalMatches(response.totalMatches);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="search-page">
      <header className="search-header">
        <h2>Search</h2>
        <input
          ref={searchInputRef}
          className="search-input"
          type="search"
          placeholder="Search all messages..."
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />

        <div className="search-filters">
          <label>
            Source
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              <option value="">All</option>
              {availableSources.map((src) => (
                <option key={src} value={src}>
                  {sourceLabel(src)}
                </option>
              ))}
            </select>
          </label>

          <label>
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>

          <label>
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>

          <label>
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="last_occurrence_desc">Last occurrence</option>
              <option value="relevance">Relevance</option>
              <option value="occurrence_count_desc">Occurrence count</option>
              <option value="title_az">Title A-Z</option>
              <option value="title_za">Title Z-A</option>
            </select>
          </label>
        </div>

        <div className="search-meta">
          {!hasQuery ? (
            <span>Enter a query to search your imported messages.</span>
          ) : loading && results.length === 0 ? (
            <span className="search-loading">Searching... · {searchContext}{dateContext ? ` · ${dateContext}` : ""}</span>
          ) : (
            <>
              <span>
                {loading && <span className="search-loading-indicator">⟳ </span>}
                {`Showing top ${results.length} of ${totalMatches} conversations`}
              </span>
              <span>
                {`${loadedOccurrences} occurrences loaded`}
                {` · ${searchContext}`}
                {dateContext ? ` · ${dateContext}` : ""}
                {latencyMs !== null ? ` · ${latencyMs} ms` : ""}
              </span>
            </>
          )}
        </div>

        {error && <div className="banner error">{error}</div>}
      </header>

      <div className="search-results">
        {hasQuery && !loading && results.length === 0 ? (
          <div className="search-empty-state">
            <p className="search-empty-title">No matches found.</p>
            <p>Try:</p>
            <ul className="search-empty-tips">
              <li>Shorter keywords</li>
              <li>Different wording</li>
              <li>Removing filters</li>
            </ul>
          </div>
        ) : (
          results.map((row, index) => (
            <button
              type="button"
              key={row.conversation_id}
              ref={(element) => {
                resultRefs.current[index] = element;
              }}
              className={`search-result ${selectedIndex === index ? "selected" : ""}`}
              onClick={() => onOpenConversation(row.conversation_id, query)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="search-result-header">
                <div className="search-result-title">{row.title || "Untitled"}</div>
                <div className="search-result-occurrences">
                  {row.occurrence_count}{" "}
                  {row.occurrence_count === 1 ? "occurrence" : "occurrences"}
                </div>
              </div>
              <div className="search-result-snippets">
                {(row.snippets.length > 0 ? row.snippets : [row.snippet]).map(
                  (snippet, snippetIndex) => (
                  <div
                    key={`${row.conversation_id}-snippet-${snippetIndex}`}
                    className="search-result-snippet"
                  >
                    {renderHighlightedSnippet(snippet)}
                  </div>
                  )
                )}
              </div>
              <div className="search-result-meta">
                <span className="source-tag">{sourceLabel(row.source)}</span>
                <span>{formatDate(row.last_occurrence)}</span>
              </div>
            </button>
          ))
        )}

        {hasQuery && !loading && results.length > 0 && totalMatches > results.length && (
          <button
            type="button"
            className="search-load-more-btn"
            onClick={() => void handleLoadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? (
              "Loading..."
            ) : (
              <>
                <span className="load-more-icon" aria-hidden="true">
                  v
                </span>{" "}
                Load more
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}

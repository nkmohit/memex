import { useEffect, useMemo, useRef, useState } from "react";
import { SearchResultRow, searchMessages } from "./db";
import { formatDate } from "./utils";

interface SearchPageProps {
  availableSources: string[];
  sourceLabel: (source: string) => string;
  onOpenConversation: (conversationId: string, activeQuery: string) => void;
  focusRequestId?: number | null;
}

interface GroupedSearchResult {
  conversationId: string;
  title: string;
  source: string;
  createdAt: number;
  snippets: string[];
  occurrenceCount: number;
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
  availableSources,
  sourceLabel,
  onOpenConversation,
  focusRequestId = null,
}: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const MAX_SNIPPETS_PER_CONVERSATION = 3;

  const hasQuery = query.trim().length > 0;

  const searchParams = useMemo(
    () => ({
      source: source || undefined,
      dateFrom: toStartOfDayTimestamp(dateFrom),
      dateTo: toEndOfDayTimestamp(dateTo),
    }),
    [source, dateFrom, dateTo]
  );

  useEffect(() => {
    if (focusRequestId === null) return;
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [focusRequestId]);

  useEffect(() => {
    let cancelled = false;
    const debounceMs = 300;

    async function runSearch() {
      if (!hasQuery) {
        setResults([]);
        setTotalMatches(0);
        setLatencyMs(null);
        setError(null);
        setSelectedIndex(-1);
        setLoading(false);
        return;
      }

      setError(null);
      const start = performance.now();

      try {
        const response = await searchMessages(query, { ...searchParams, limit: 50 });
        if (cancelled) return;
        setResults(response.rows);
        setTotalMatches(response.totalMatches);
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
        }
      }
    }

    const timeoutId = window.setTimeout(() => {
      setLoading(true);
      void runSearch();
    }, debounceMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [hasQuery, query, searchParams]);

  const groupedResults = useMemo<GroupedSearchResult[]>(() => {
    const byConversation = new Map<string, GroupedSearchResult>();

    for (const row of results) {
      const existing = byConversation.get(row.conversation_id);
      if (!existing) {
        byConversation.set(row.conversation_id, {
          conversationId: row.conversation_id,
          title: row.title || "Untitled",
          source: row.source,
          createdAt: row.created_at,
          snippets: [row.snippet],
          occurrenceCount: 1,
        });
        continue;
      }

      existing.occurrenceCount += 1;
      if (existing.snippets.length < MAX_SNIPPETS_PER_CONVERSATION) {
        existing.snippets.push(row.snippet);
      }
    }

    return Array.from(byConversation.values());
  }, [results]);

  useEffect(() => {
    setSelectedIndex(groupedResults.length > 0 ? 0 : -1);
  }, [groupedResults]);

  useEffect(() => {
    if (selectedIndex < 0) return;
    resultRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [selectedIndex]);

  useEffect(() => {
    function handleKeyboardNav(event: KeyboardEvent) {
      if (!hasQuery || loading || groupedResults.length === 0) {
        if (event.key === "Escape" && hasQuery) {
          event.preventDefault();
          setQuery("");
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
        setSelectedIndex((prev) => Math.min(prev + 1, groupedResults.length - 1));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      }

      if (event.key === "Enter" && selectedIndex >= 0) {
        const selected = groupedResults[selectedIndex];
        if (!selected) return;
        event.preventDefault();
        onOpenConversation(selected.conversationId, query);
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setQuery("");
        setResults([]);
        setTotalMatches(0);
        setSelectedIndex(-1);
        setLatencyMs(null);
        searchInputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyboardNav);
    return () => document.removeEventListener("keydown", handleKeyboardNav);
  }, [groupedResults, hasQuery, loading, onOpenConversation, selectedIndex]);

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
          onChange={(e) => setQuery(e.target.value)}
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
        </div>

        <div className="search-meta">
          {!hasQuery ? (
            <span>Enter a query to search your imported messages.</span>
          ) : loading ? (
            <span>Searching... · {searchContext}{dateContext ? ` · ${dateContext}` : ""}</span>
          ) : (
            <>
              <span>
                {totalMatches > results.length
                  ? `Showing top ${results.length} of ${totalMatches} results`
                  : `${totalMatches} results`}
              </span>
              <span>
                {`${totalMatches} occurrences in ${groupedResults.length} conversations`}
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
        {hasQuery && !loading && totalMatches > results.length && results.length > 0 && (
          <div className="search-truncation-notice">
            Showing top {results.length} of {totalMatches} results
          </div>
        )}
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
          groupedResults.map((group, index) => (
            <button
              type="button"
              key={group.conversationId}
              ref={(element) => {
                resultRefs.current[index] = element;
              }}
              className={`search-result ${selectedIndex === index ? "selected" : ""}`}
              onClick={() => onOpenConversation(group.conversationId, query)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="search-result-header">
                <div className="search-result-title">{group.title}</div>
                <div className="search-result-occurrences">
                  {group.occurrenceCount}{" "}
                  {group.occurrenceCount === 1 ? "occurrence" : "occurrences"}
                </div>
              </div>
              <div className="search-result-snippets">
                {group.snippets.map((snippet, snippetIndex) => (
                  <div
                    key={`${group.conversationId}-snippet-${snippetIndex}`}
                    className="search-result-snippet"
                  >
                    {renderHighlightedSnippet(snippet)}
                  </div>
                ))}
              </div>
              <div className="search-result-meta">
                <span className="source-tag">{sourceLabel(group.source)}</span>
                <span>{formatDate(group.createdAt)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

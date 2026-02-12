import { useEffect, useMemo, useState } from "react";
import { SearchResultRow, searchMessages } from "./db";
import { formatDate } from "./utils";

interface SearchPageProps {
  availableSources: string[];
  sourceLabel: (source: string) => string;
  onOpenConversation: (conversationId: string) => void;
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
}: SearchPageProps) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [results, setResults] = useState<SearchResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

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
    let cancelled = false;

    async function runSearch() {
      if (!hasQuery) {
        setResults([]);
        setLatencyMs(null);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      const start = performance.now();

      try {
        const rows = await searchMessages(query, { ...searchParams, limit: 50 });
        if (cancelled) return;
        setResults(rows);
        setLatencyMs(Math.round(performance.now() - start));
      } catch (err) {
        if (cancelled) return;
        setResults([]);
        setLatencyMs(null);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void runSearch();
    return () => {
      cancelled = true;
    };
  }, [hasQuery, query, searchParams]);

  return (
    <section className="search-page">
      <header className="search-header">
        <h2>Search</h2>
        <input
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
            <span>Searching...</span>
          ) : (
            <span>
              {results.length} results
              {latencyMs !== null ? ` · ${latencyMs} ms` : ""}
            </span>
          )}
        </div>

        {error && <div className="banner error">{error}</div>}
      </header>

      <div className="search-results">
        {hasQuery && !loading && results.length === 0 ? (
          <div className="empty-text">No matching messages found.</div>
        ) : (
          results.map((row) => (
            <button
              type="button"
              key={`${row.conversation_id}-${row.snippet}-${row.rank}`}
              className="search-result"
              onClick={() => onOpenConversation(row.conversation_id)}
            >
              <div className="search-result-title">{row.title || "Untitled"}</div>
              <div className="search-result-snippet">
                {renderHighlightedSnippet(row.snippet)}
              </div>
              <div className="search-result-meta">
                <span className="source-tag">{sourceLabel(row.source)}</span>
                <span>{formatDate(row.created_at)}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}

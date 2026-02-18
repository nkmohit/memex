import { useRef, type MutableRefObject } from "react";
import type { SearchResultRow } from "./db";
import { formatDate } from "./utils";

interface SearchResultsListProps {
  results: SearchResultRow[];
  hasQuery: boolean;
  selectedConversationId?: string | null;
  selectedIndex: number;
  onSelectRow: (row: SearchResultRow) => void;
  onHoverRow: (index: number) => void;
  resultRefs: MutableRefObject<Array<HTMLButtonElement | null>>;
  sourceLabel: (source: string) => string;
  loading: boolean;
  loadingMore: boolean;
  totalMatches: number;
  onLoadMore: () => void;
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

export default function SearchResultsList({
  results,
  hasQuery,
  selectedConversationId = null,
  selectedIndex,
  onSelectRow,
  onHoverRow,
  resultRefs,
  sourceLabel,
  loading,
  loadingMore,
  totalMatches,
  onLoadMore,
}: SearchResultsListProps) {
  const hasResults = results.length > 0;
  const showEmptyState = hasQuery && !loading && !hasResults;

  return (
    <ul className="search-results">
      {showEmptyState ? (
        <div className="search-empty-state" role="status" aria-live="polite">
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
          <li key={row.conversation_id}>
            <button
              type="button"
              ref={(element) => {
                resultRefs.current[index] = element;
              }}
              className={`search-result ${selectedIndex === index || row.conversation_id === selectedConversationId ? "selected" : ""}`}
              data-selected={row.conversation_id === selectedConversationId ? "true" : "false"}
              onClick={() => onSelectRow(row)}
              onMouseEnter={() => onHoverRow(index)}
            >
              <div className="search-result-header">
                <div className="search-result-title">{row.title || "Untitled"}</div>
                {hasQuery ? (
                  <div className="search-result-occurrences">
                    {row.occurrence_count}{" "}
                    {row.occurrence_count === 1 ? "occurrence" : "occurrences"}
                    {" in "}
                    {row.message_match_count}{" "}
                    {row.message_match_count === 1 ? "message" : "messages"}
                  </div>
                ) : (
                  <div className="search-result-occurrences">
                    {row.occurrence_count}{" "}
                    {row.occurrence_count === 1 ? "message" : "messages"}
                  </div>
                )}
              </div>
              {hasQuery && (
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
              )}
              <div className="search-result-meta">
                <span className="source-tag">{sourceLabel(row.source)}</span>
                <span>{formatDate(row.last_occurrence)}</span>
              </div>
            </button>
          </li>
        ))
      )}

      {!loading && hasResults && totalMatches > results.length && (
        <button
          type="button"
          className="search-load-more-btn"
          onClick={onLoadMore}
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
    </ul>
  );
}


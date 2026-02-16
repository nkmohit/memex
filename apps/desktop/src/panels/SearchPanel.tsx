import type React from "react";
import type { ConversationRow, MessageRow } from "../db";
import SearchPage, { type SearchPageSnapshot } from "../SearchPage";
import { formatDate, formatTimestamp } from "../utils";

type SearchViewerProps = {
  selectedConversation: ConversationRow | null;
  messages: MessageRow[];
  messagesLoading: boolean;
  viewerSearchOpen: boolean;
  onOpenViewerSearch: () => void;
  messageSearchQuery: string;
  onMessageSearchQueryChange: (q: string) => void;
  viewerSearchInputRef: React.RefObject<HTMLInputElement | null>;
  matchCount: number;
  messageMatchCount: number;
  currentMatchIndex: number;
  onPrevMatch: () => void;
  onNextMatch: () => void;
  copyToast: string | null;
  onClose: () => void;
  onCopyMessage: (m: MessageRow) => void;
  messageRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
  highlightedMessageId: string | null;
  highlightText: (text: string, query: string) => React.ReactNode;
  sourceLabel: (src: string) => string;
};

function SearchViewer({
  selectedConversation,
  messages,
  messagesLoading,
  viewerSearchOpen,
  onOpenViewerSearch,
  messageSearchQuery,
  onMessageSearchQueryChange,
  viewerSearchInputRef,
  matchCount,
  messageMatchCount,
  currentMatchIndex,
  onPrevMatch,
  onNextMatch,
  copyToast,
  onClose,
  onCopyMessage,
  messageRefs,
  highlightedMessageId,
  highlightText,
  sourceLabel,
}: SearchViewerProps) {
  return (
    <main className={`viewer${viewerSearchOpen && messageSearchQuery.trim() ? " viewer-has-search" : ""}`}>
      {!selectedConversation ? (
        <div className="viewer-empty">
          <p className="viewer-empty-text" aria-live="polite">
            Select a conversation to view messages.
          </p>
        </div>
      ) : messagesLoading ? (
        <div className="viewer-empty">
          <p className="viewer-empty-text">Loading messages...</p>
        </div>
      ) : (
        <>
          <div className="viewer-header">
            <div className="viewer-header-left">
              <div>
                <h2>{selectedConversation.title || "Untitled"}</h2>
                <p className="viewer-header-meta">
                  <span className="source-tag">{sourceLabel(selectedConversation.source)}</span>
                  <span>
                    {viewerSearchOpen && messageSearchQuery.trim()
                      ? `${matchCount} occurrence${matchCount !== 1 ? "s" : ""} in ${messageMatchCount} message${
                          messageMatchCount !== 1 ? "s" : ""
                        }`
                      : `${messages.length} messages`}
                  </span>
                  <span>{formatDate(selectedConversation.last_message_at)}</span>
                </p>
              </div>
            </div>
            <div className="viewer-header-actions">
              {viewerSearchOpen ? (
                <div className="viewer-search">
                  <input
                    ref={viewerSearchInputRef}
                    type="search"
                    className="viewer-search-input"
                    placeholder="Search in conversation..."
                    value={messageSearchQuery}
                    onChange={(e) => onMessageSearchQueryChange(e.target.value)}
                  />
                  {messageSearchQuery.trim() && matchCount > 0 && (
                    <div className="viewer-search-nav">
                      <span className="viewer-search-count">
                        {currentMatchIndex + 1} of {matchCount}
                      </span>
                      <button
                        type="button"
                        className="viewer-search-nav-btn"
                        onClick={onPrevMatch}
                        title="Previous match"
                        aria-label="Previous match"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="viewer-search-nav-btn"
                        onClick={onNextMatch}
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
              ) : (
                <button
                  type="button"
                  className="viewer-search-icon-btn"
                  onClick={onOpenViewerSearch}
                  title="Search in conversation (⌘F)"
                  aria-label="Search in conversation"
                >
                  <span className="viewer-search-icon" aria-hidden="true">
                    ⌕
                  </span>
                </button>
              )}

              <button
                type="button"
                className="viewer-close-panel-btn"
                onClick={onClose}
                title="Close panel"
                aria-label="Close panel"
              >
                ×
              </button>
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
                    {m.sender === "human" ? "You" : sourceLabel(selectedConversation.source)}
                  </span>
                  <span className="msg-top-right">
                    <time>{formatTimestamp(m.created_at)}</time>
                    <button
                      type="button"
                      className="msg-copy-btn"
                      onClick={() => onCopyMessage(m)}
                      title="Copy message"
                      aria-label="Copy message"
                    >
                      Copy
                    </button>
                  </span>
                </div>
                <div className="msg-body">{highlightText(m.content, viewerSearchOpen ? messageSearchQuery : "")}</div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

type SearchPanelProps = {
  query: string;
  onQueryChange: (q: string) => void;
  availableSources: string[];
  sourceLabel: (source: string) => string;
  onSelectResult: (convId: string) => void;
  selectedConversationId: string | null;
  focusRequestId: number | null;
  snapshot: SearchPageSnapshot;
  onSnapshotChange: (s: SearchPageSnapshot) => void;
  skipSearchOnceRef: React.MutableRefObject<boolean>;
  restoreSelectedConversationId: string | null;
  onRestoreSelectionDone: () => void;

  viewer: {
    open: boolean;
    onClose: () => void;
    selectedConversation: ConversationRow | null;
    messages: MessageRow[];
    messagesLoading: boolean;
    viewerSearchOpen: boolean;
    onOpenViewerSearch: () => void;
    messageSearchQuery: string;
    onMessageSearchQueryChange: (q: string) => void;
    viewerSearchInputRef: React.RefObject<HTMLInputElement | null>;
    matchCount: number;
    messageMatchCount: number;
    currentMatchIndex: number;
    onPrevMatch: () => void;
    onNextMatch: () => void;
    copyToast: string | null;
    onCopyMessage: (m: MessageRow) => void;
    messageRefs: React.MutableRefObject<Record<string, HTMLElement | null>>;
    highlightedMessageId: string | null;
    highlightText: (text: string, query: string) => React.ReactNode;
  };
};

export default function SearchPanel({
  query,
  onQueryChange,
  availableSources,
  sourceLabel,
  onSelectResult,
  selectedConversationId,
  focusRequestId,
  snapshot,
  onSnapshotChange,
  skipSearchOnceRef,
  restoreSelectedConversationId,
  onRestoreSelectionDone,
  viewer,
}: SearchPanelProps) {
  return (
    <>
      <main className="search-main" id="main-content">
        <SearchPage
          query={query}
          onQueryChange={onQueryChange}
          availableSources={availableSources}
          sourceLabel={sourceLabel}
          onSelectResult={onSelectResult}
          selectedConversationId={selectedConversationId}
          focusRequestId={focusRequestId}
          snapshot={snapshot}
          onSnapshotChange={onSnapshotChange}
          skipSearchOnceRef={skipSearchOnceRef}
          restoreSelectedConversationId={restoreSelectedConversationId}
          onRestoreSelectionDone={onRestoreSelectionDone}
        />
      </main>
      {viewer.open && (
        <SearchViewer
          selectedConversation={viewer.selectedConversation}
          messages={viewer.messages}
          messagesLoading={viewer.messagesLoading}
          viewerSearchOpen={viewer.viewerSearchOpen}
          onOpenViewerSearch={viewer.onOpenViewerSearch}
          messageSearchQuery={viewer.messageSearchQuery}
          onMessageSearchQueryChange={viewer.onMessageSearchQueryChange}
          viewerSearchInputRef={viewer.viewerSearchInputRef}
          matchCount={viewer.matchCount}
          messageMatchCount={viewer.messageMatchCount}
          currentMatchIndex={viewer.currentMatchIndex}
          onPrevMatch={viewer.onPrevMatch}
          onNextMatch={viewer.onNextMatch}
          copyToast={viewer.copyToast}
          onClose={viewer.onClose}
          onCopyMessage={viewer.onCopyMessage}
          messageRefs={viewer.messageRefs}
          highlightedMessageId={viewer.highlightedMessageId}
          highlightText={viewer.highlightText}
          sourceLabel={sourceLabel}
        />
      )}
    </>
  );
}
